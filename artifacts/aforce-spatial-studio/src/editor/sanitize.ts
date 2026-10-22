import {
  ACTIVATION_20x20,
  FIXTURE_KINDS,
  type Asset,
  type AssetKind,
  type Fixture,
  type FixtureKind,
  type FloorPlan,
  type SceneDocument,
  type Vec3,
} from "@/scene/model";
import {
  DEFAULT_STYLE,
  FINISHES,
  KEY_TEMPERATURES,
  sanitizeFixtureStyle,
  sanitizeStyle,
  type Finish,
  type FixtureStyle,
  type SceneStyle,
} from "@/scene/style";

import { MIN_DIM, clampPosition, normalizeAngle, round } from "./geometry";

/**
 * Every fixture write passes through here: minimum size, wrapped rotation,
 * rotated footprint clamped inside the floor, empty overrides dropped.
 */
export function sanitizeFixture(fixture: Fixture, floor: FloorPlan): Fixture {
  const footprint = {
    width: Math.max(MIN_DIM, round(fixture.footprint.width)),
    depth: Math.max(MIN_DIM, round(fixture.footprint.depth)),
    height: Math.max(MIN_DIM, round(fixture.footprint.height)),
  };
  const rotated: Fixture = {
    ...fixture,
    footprint,
    rotationY: round(normalizeAngle(fixture.rotationY), 5),
  };
  const [x, , z] = clampPosition(rotated, floor);
  const out: Fixture = { ...rotated, position: [round(x), 0, round(z)] };
  const style = sanitizeFixtureStyle(fixture.style);
  if (style) out.style = style;
  else delete out.style;
  if (fixture.slots && Object.keys(fixture.slots).length > 0) out.slots = fixture.slots;
  else delete out.slots;
  return out;
}

// ---- Loading untrusted documents (IndexedDB, imported JSON) ---------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function num(v: unknown, fallback: number, lo = -Infinity, hi = Infinity): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

const ASSET_KINDS: readonly AssetKind[] = ["logo", "texture", "product"];

function normalizeAsset(raw: unknown): Asset | null {
  if (!isObject(raw)) return null;
  const id = raw.id;
  const dataUrl = raw.dataUrl;
  if (typeof id !== "string" || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return null;
  const kind = ASSET_KINDS.includes(raw.kind as AssetKind) ? (raw.kind as AssetKind) : "texture";
  return {
    id,
    kind,
    name: str(raw.name, "Untitled image"),
    dataUrl,
    width: num(raw.width, 0, 0),
    height: num(raw.height, 0, 0),
    bytes: num(raw.bytes, Math.round(dataUrl.length * 0.75), 0),
  };
}

function normalizeStyle(raw: unknown, assetIds: Set<string>): SceneStyle {
  const r = isObject(raw) ? raw : {};
  const idOrNull = (v: unknown) => (typeof v === "string" && assetIds.has(v) ? v : null);
  const finish = (v: unknown, fallback: Finish): Finish => (typeof v === "string" && v in FINISHES ? (v as Finish) : fallback);
  return sanitizeStyle({
    accent: str(r.accent, DEFAULT_STYLE.accent),
    surface: str(r.surface, DEFAULT_STYLE.surface),
    panel: str(r.panel, DEFAULT_STYLE.panel),
    metal: str(r.metal, DEFAULT_STYLE.metal),
    floor: str(r.floor, DEFAULT_STYLE.floor),
    finish: finish(r.finish, DEFAULT_STYLE.finish),
    floorFinish: finish(r.floorFinish, DEFAULT_STYLE.floorFinish),
    ledIntensity: num(r.ledIntensity, DEFAULT_STYLE.ledIntensity),
    keyIntensity: num(r.keyIntensity, DEFAULT_STYLE.keyIntensity),
    fillIntensity: num(r.fillIntensity, DEFAULT_STYLE.fillIntensity),
    envIntensity: num(r.envIntensity, DEFAULT_STYLE.envIntensity),
    keyTemperature:
      typeof r.keyTemperature === "string" && r.keyTemperature in KEY_TEMPERATURES
        ? (r.keyTemperature as SceneStyle["keyTemperature"])
        : DEFAULT_STYLE.keyTemperature,
    brandLogoId: idOrNull(r.brandLogoId),
    floorTextureId: idOrNull(r.floorTextureId),
    floorTextureScale: num(r.floorTextureScale, DEFAULT_STYLE.floorTextureScale),
    wallTextureId: idOrNull(r.wallTextureId),
  });
}

function normalizeFixture(raw: unknown, floor: FloorPlan, assetIds: Set<string>): Fixture | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== "string" || !FIXTURE_KINDS.includes(raw.kind as FixtureKind)) return null;
  const kind = raw.kind as FixtureKind;
  const template = ACTIVATION_20x20.fixtures.find((f) => f.kind === kind);
  if (!template) return null;

  const pos = Array.isArray(raw.position) ? raw.position : [];
  const position: Vec3 = [num(pos[0], 0), 0, num(pos[2], 0)];
  const fp = isObject(raw.footprint) ? raw.footprint : {};

  let style: FixtureStyle | undefined;
  if (isObject(raw.style)) {
    const s = raw.style;
    style = {
      accent: typeof s.accent === "string" ? s.accent : undefined,
      surface: typeof s.surface === "string" ? s.surface : undefined,
      metal: typeof s.metal === "string" ? s.metal : undefined,
      finish: typeof s.finish === "string" && s.finish in FINISHES ? (s.finish as Finish) : undefined,
      ledIntensity: typeof s.ledIntensity === "number" ? s.ledIntensity : undefined,
    };
  }

  let slots: Record<string, string | null> | undefined;
  if (isObject(raw.slots)) {
    slots = {};
    for (const [key, value] of Object.entries(raw.slots)) {
      if (value === null) slots[key] = null;
      else if (typeof value === "string" && assetIds.has(value)) slots[key] = value;
    }
  }

  return sanitizeFixture(
    {
      id: raw.id,
      kind,
      label: str(raw.label, template.label),
      description: typeof raw.description === "string" ? raw.description : template.description,
      position,
      rotationY: num(raw.rotationY, 0),
      footprint: {
        width: num(fp.width, template.footprint.width, MIN_DIM, 200),
        depth: num(fp.depth, template.footprint.depth, MIN_DIM, 200),
        height: num(fp.height, template.footprint.height, MIN_DIM, 60),
      },
      style,
      slots,
    },
    floor,
  );
}

/**
 * Turn anything that claims to be a scene document into a valid one, or
 * throw. Missing parts fall back to the defaults; dangling asset
 * references are dropped; fixtures are sanitized like live edits.
 */
export function normalizeDocument(raw: unknown): SceneDocument {
  if (!isObject(raw) || !Array.isArray(raw.fixtures)) {
    throw new Error("This file is not an AForce Spatial Studio document.");
  }
  const floorRaw = isObject(raw.floor) ? raw.floor : {};
  const floor: FloorPlan = {
    width: num(floorRaw.width, 20, 4, 200),
    depth: num(floorRaw.depth, 20, 4, 200),
    wallHeight: num(floorRaw.wallHeight, 10, 4, 40),
  };
  const assets: Asset[] = [];
  const assetIds = new Set<string>();
  if (Array.isArray(raw.assets)) {
    for (const a of raw.assets) {
      const asset = normalizeAsset(a);
      if (asset && !assetIds.has(asset.id)) {
        assetIds.add(asset.id);
        assets.push(asset);
      }
    }
  }
  const fixtures: Fixture[] = [];
  const seen = new Set<string>();
  for (const f of raw.fixtures) {
    const fixture = normalizeFixture(f, floor, assetIds);
    if (fixture && !seen.has(fixture.id)) {
      seen.add(fixture.id);
      fixtures.push(fixture);
    }
  }
  return {
    schemaVersion: 1,
    name: str(raw.name, "Untitled activation"),
    unit: "ft",
    floor,
    fixtures,
    style: normalizeStyle(raw.style, assetIds),
    assets,
  };
}
