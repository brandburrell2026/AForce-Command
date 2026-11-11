import { degToRad, radToDeg } from "@/editor/geometry";
import { sanitizeFixture } from "@/editor/sanitize";
import {
  createFixture,
  nextFixtureId,
  type Fixture,
  type SceneDocument,
} from "@/scene/model";
import { sanitizeStyle, type FixtureStyle, type SceneStyle } from "@/scene/style";
import { formatFeet } from "@/scene/units";

import type { EditOp } from "./types";

export interface ApplyResult {
  doc: SceneDocument;
  /** One line per applied op, for the transcript. */
  applied: string[];
  /** Fixture to select afterward (the last one added or edited). */
  selectId: string | null;
  cameraPreset: EditOp["preset"];
}

const ft = (v: number) => formatFeet(v);

/**
 * Apply validated operations to a document, purely. The editor commits the
 * result as one undo step. Every fixture write goes through sanitizeFixture,
 * so clamping and minimum sizes hold exactly as for manual edits.
 */
export function applyOps(start: SceneDocument, ops: readonly EditOp[]): ApplyResult {
  let doc = start;
  const applied: string[] = [];
  let selectId: string | null = null;
  let cameraPreset: EditOp["preset"] = null;

  const find = (id: string | null) => (id ? doc.fixtures.find((f) => f.id === id) : undefined);
  const replace = (id: string, updater: (f: Fixture) => Fixture) => {
    doc = {
      ...doc,
      fixtures: doc.fixtures.map((f) => (f.id === id ? sanitizeFixture(updater(f), doc.floor) : f)),
    };
  };
  const nameOf = (f: Fixture) => f.label;

  for (const op of ops) {
    const target = find(op.id);
    switch (op.op) {
      case "move": {
        if (!target) break;
        const x = op.x ?? target.position[0] + (op.dx ?? 0);
        const z = op.z ?? target.position[2] + (op.dz ?? 0);
        replace(target.id, (f) => ({ ...f, position: [x, 0, z] }));
        const after = find(target.id);
        if (after) applied.push(`Moved ${nameOf(after)} to (${ft(after.position[0])}, ${ft(after.position[2])}).`);
        selectId = target.id;
        break;
      }
      case "rotate": {
        if (!target) break;
        const rad = op.degrees !== null ? degToRad(op.degrees) : target.rotationY + degToRad(op.by ?? 0);
        replace(target.id, (f) => ({ ...f, rotationY: rad }));
        const after = find(target.id);
        if (after) applied.push(`Rotated ${nameOf(after)} to ${Math.round(radToDeg(after.rotationY))}°.`);
        selectId = target.id;
        break;
      }
      case "resize": {
        if (!target) break;
        replace(target.id, (f) => ({
          ...f,
          footprint: {
            width: op.width ?? f.footprint.width,
            depth: op.depth ?? f.footprint.depth,
            height: op.height ?? f.footprint.height,
          },
        }));
        const after = find(target.id);
        if (after) {
          const { width, depth, height } = after.footprint;
          applied.push(`Resized ${nameOf(after)} to ${ft(width)} × ${ft(depth)} × ${ft(height)}.`);
        }
        selectId = target.id;
        break;
      }
      case "add": {
        if (!op.kind) break;
        const id = nextFixtureId(doc, op.kind);
        const base = createFixture(op.kind, id, [op.x ?? 0, 0, op.z ?? 0]);
        const fixture = sanitizeFixture(
          {
            ...base,
            label: op.label?.trim() || base.label,
            rotationY: op.degrees !== null ? degToRad(op.degrees) : 0,
            footprint: {
              width: op.width ?? base.footprint.width,
              depth: op.depth ?? base.footprint.depth,
              height: op.height ?? base.footprint.height,
            },
          },
          doc.floor,
        );
        doc = { ...doc, fixtures: [...doc.fixtures, fixture] };
        applied.push(`Added ${fixture.label} at (${ft(fixture.position[0])}, ${ft(fixture.position[2])}).`);
        selectId = id;
        break;
      }
      case "remove": {
        if (!target) break;
        doc = { ...doc, fixtures: doc.fixtures.filter((f) => f.id !== target.id) };
        applied.push(`Removed ${nameOf(target)}.`);
        if (selectId === target.id) selectId = null;
        break;
      }
      case "duplicate": {
        if (!target) break;
        const id = nextFixtureId(doc, target.kind);
        const copy = sanitizeFixture(
          {
            ...target,
            id,
            position: [target.position[0] + (op.dx ?? 2), 0, target.position[2] + (op.dz ?? 2)],
            footprint: { ...target.footprint },
          },
          doc.floor,
        );
        doc = { ...doc, fixtures: [...doc.fixtures, copy] };
        applied.push(`Duplicated ${nameOf(target)}.`);
        selectId = id;
        break;
      }
      case "rename": {
        if (!target || !op.label) break;
        replace(target.id, (f) => ({ ...f, label: op.label ?? f.label }));
        applied.push(`Renamed ${nameOf(target)} to ${op.label}.`);
        selectId = target.id;
        break;
      }
      case "note": {
        if (!target || !op.text) break;
        replace(target.id, (f) => ({ ...f, description: op.text ?? f.description }));
        applied.push(`Updated notes on ${nameOf(target)}.`);
        selectId = target.id;
        break;
      }
      case "fixture_style": {
        if (!target || !op.style) break;
        const patch = op.style;
        replace(target.id, (f) => {
          const next: FixtureStyle = patch.clear ? {} : { ...f.style };
          if (patch.accent !== null) next.accent = patch.accent;
          if (patch.surface !== null) next.surface = patch.surface;
          if (patch.metal !== null) next.metal = patch.metal;
          if (patch.finish !== null) next.finish = patch.finish;
          if (patch.ledIntensity !== null) next.ledIntensity = patch.ledIntensity;
          return { ...f, style: next };
        });
        applied.push(`Restyled ${nameOf(target)}.`);
        selectId = target.id;
        break;
      }
      case "scene_style": {
        if (!op.scene) break;
        const s = op.scene;
        const next: SceneStyle = { ...doc.style };
        if (s.accent !== null) next.accent = s.accent;
        if (s.surface !== null) next.surface = s.surface;
        if (s.panel !== null) next.panel = s.panel;
        if (s.metal !== null) next.metal = s.metal;
        if (s.floor !== null) next.floor = s.floor;
        if (s.finish !== null) next.finish = s.finish;
        if (s.floorFinish !== null) next.floorFinish = s.floorFinish;
        if (s.ledIntensity !== null) next.ledIntensity = s.ledIntensity;
        if (s.keyIntensity !== null) next.keyIntensity = s.keyIntensity;
        if (s.fillIntensity !== null) next.fillIntensity = s.fillIntensity;
        if (s.envIntensity !== null) next.envIntensity = s.envIntensity;
        if (s.keyTemperature !== null) next.keyTemperature = s.keyTemperature;
        if (s.brandLogo !== null) next.brandLogoId = s.brandLogo || null;
        doc = { ...doc, style: sanitizeStyle(next) };
        applied.push("Updated the scene style.");
        break;
      }
      case "set_slot": {
        if (!target || !op.slot) break;
        const slot = op.slot;
        replace(target.id, (f) => {
          const slots: Record<string, string | null> = { ...f.slots };
          if (op.inherit) delete slots[slot];
          else slots[slot] = op.asset;
          return { ...f, slots };
        });
        const asset = op.asset ? doc.assets.find((a) => a.id === op.asset) : null;
        applied.push(
          op.inherit
            ? `Reset ${slot} on ${nameOf(target)} to the scene default.`
            : asset
              ? `Set ${slot} on ${nameOf(target)} to ${asset.name}.`
              : `Cleared ${slot} on ${nameOf(target)}.`,
        );
        selectId = target.id;
        break;
      }
      case "floor": {
        const floor = {
          width: op.floorWidth ?? doc.floor.width,
          depth: op.floorDepth ?? doc.floor.depth,
          wallHeight: op.wallHeight ?? doc.floor.wallHeight,
        };
        doc = { ...doc, floor, fixtures: doc.fixtures.map((f) => sanitizeFixture(f, floor)) };
        applied.push(`Floor is now ${ft(floor.width)} × ${ft(floor.depth)}, walls ${ft(floor.wallHeight)}.`);
        break;
      }
      case "camera": {
        if (op.preset) {
          cameraPreset = op.preset;
          applied.push(`Camera to the ${op.preset} view.`);
        }
        break;
      }
      default:
        break;
    }
  }

  return { doc, applied, selectId, cameraPreset };
}
