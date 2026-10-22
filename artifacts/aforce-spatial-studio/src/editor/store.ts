import { useSyncExternalStore } from "react";

import {
  ACTIVATION_20x20,
  createFixture,
  type Asset,
  type Fixture,
  type FixtureKind,
  type FloorPlan,
  type SceneDocument,
} from "@/scene/model";
import { sanitizeFixtureStyle, sanitizeStyle, type SceneStyle } from "@/scene/style";

import type { CameraMode, CameraPresetId, CameraRequest } from "./camera";
import { MIN_DIM, clampPosition, normalizeAngle, round } from "./geometry";

/**
 * Editor state: the scene document plus selection, gizmo mode and undo
 * history. A minimal external store (no library) so the canvas, the HUD
 * and the floor plan can each subscribe to exactly the slice they render.
 */

export type GizmoMode = "translate" | "rotate" | "scale";

export interface EditorState {
  doc: SceneDocument;
  selectedId: string | null;
  hoveredId: string | null;
  mode: GizmoMode;
  snap: boolean;
  past: SceneDocument[];
  future: SceneDocument[];
  /** True between beginEdit and endEdit: a gizmo or plan drag is in progress. */
  editing: boolean;
  cameraMode: CameraMode;
  /** Slow turntable around the orbit target. */
  autoOrbit: boolean;
  /** Pointer lock is engaged in walk mode. */
  walkLocked: boolean;
  /** One-shot camera move; the orbit rig animates to it. */
  cameraRequest: CameraRequest | null;
}

export type FixturePatch = Partial<
  Pick<Fixture, "label" | "description" | "position" | "rotationY" | "footprint" | "style" | "slots">
>;

const HISTORY_LIMIT = 100;

let state: EditorState = {
  doc: ACTIVATION_20x20,
  selectedId: null,
  hoveredId: null,
  mode: "translate",
  snap: true,
  past: [],
  future: [],
  editing: false,
  cameraMode: "orbit",
  autoOrbit: false,
  walkLocked: false,
  cameraRequest: null,
};

let cameraNonce = 0;

/** Clicks that land right after a gizmo interaction must not clear the selection. */
let gizmoBusyUntil = 0;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function set(patch: Partial<EditorState>) {
  state = { ...state, ...patch };
  emit();
}

export function getEditorState(): EditorState {
  return state;
}

export function subscribeEditor(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to a slice. Selectors must return primitives or stored references. */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useSyncExternalStore(
    subscribeEditor,
    () => selector(state),
    () => selector(state),
  );
}

function pushPast(past: SceneDocument[], doc: SceneDocument): SceneDocument[] {
  return [...past.slice(-(HISTORY_LIMIT - 1)), doc];
}

function withHistory(next: SceneDocument) {
  set({ doc: next, past: pushPast(state.past, state.doc), future: [] });
}

/** Enforce minimum size, wrapped rotation and floor bounds on every write. */
function sanitize(fixture: Fixture, floor: FloorPlan): Fixture {
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

function replaceFixture(
  doc: SceneDocument,
  id: string,
  updater: (f: Fixture) => Fixture,
): SceneDocument {
  return {
    ...doc,
    fixtures: doc.fixtures.map((f) => (f.id === id ? sanitize(updater(f), doc.floor) : f)),
  };
}

function nextId(kind: FixtureKind): string {
  const ids = new Set(state.doc.fixtures.map((f) => f.id));
  let n = 1;
  while (ids.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}

export function findFixture(id: string | null): Fixture | null {
  if (!id) return null;
  return state.doc.fixtures.find((f) => f.id === id) ?? null;
}

export const editor = {
  select(id: string | null) {
    if (state.selectedId !== id) set({ selectedId: id });
  },

  hover(id: string | null) {
    if (state.hoveredId !== id) set({ hoveredId: id });
  },

  setMode(mode: GizmoMode) {
    if (state.mode !== mode) set({ mode });
  },

  toggleSnap() {
    set({ snap: !state.snap });
  },

  /** One discrete change, one undo step. Used by the panel and keyboard. */
  update(id: string, patch: FixturePatch) {
    withHistory(replaceFixture(state.doc, id, (f) => ({ ...f, ...patch })));
  },

  /** Live change during a drag. No undo step: wrap with beginEdit / endEdit. */
  updateLive(id: string, patch: FixturePatch) {
    set({ doc: replaceFixture(state.doc, id, (f) => ({ ...f, ...patch })) });
  },

  beginEdit() {
    if (state.editing) return;
    set({ editing: true, past: pushPast(state.past, state.doc), future: [] });
  },

  endEdit() {
    if (!state.editing) return;
    const last = state.past[state.past.length - 1];
    if (last === state.doc) {
      // Nothing changed during the drag: drop the snapshot.
      set({ editing: false, past: state.past.slice(0, -1) });
    } else {
      set({ editing: false });
    }
  },

  markGizmoBusy() {
    gizmoBusyUntil = performance.now() + 250;
  },

  isGizmoBusy(): boolean {
    return performance.now() < gizmoBusyUntil;
  },

  nudge(id: string, dx: number, dz: number) {
    withHistory(
      replaceFixture(state.doc, id, (f) => ({
        ...f,
        position: [f.position[0] + dx, 0, f.position[2] + dz],
      })),
    );
  },

  rotateBy(id: string, rad: number) {
    withHistory(replaceFixture(state.doc, id, (f) => ({ ...f, rotationY: f.rotationY + rad })));
  },

  add(kind: FixtureKind) {
    const id = nextId(kind);
    const fixture = sanitize(createFixture(kind, id, [0, 0, 6]), state.doc.floor);
    withHistory({ ...state.doc, fixtures: [...state.doc.fixtures, fixture] });
    set({ selectedId: id });
  },

  duplicate(id: string) {
    const source = findFixture(id);
    if (!source) return;
    const copyId = nextId(source.kind);
    const copy = sanitize(
      {
        ...source,
        id: copyId,
        position: [source.position[0] + 2, 0, source.position[2] + 2],
        footprint: { ...source.footprint },
      },
      state.doc.floor,
    );
    withHistory({ ...state.doc, fixtures: [...state.doc.fixtures, copy] });
    set({ selectedId: copyId });
  },

  remove(id: string) {
    if (!findFixture(id)) return;
    withHistory({ ...state.doc, fixtures: state.doc.fixtures.filter((f) => f.id !== id) });
    set({
      selectedId: state.selectedId === id ? null : state.selectedId,
      hoveredId: state.hoveredId === id ? null : state.hoveredId,
    });
  },

  undo() {
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    set({
      doc: previous,
      past: state.past.slice(0, -1),
      future: [state.doc, ...state.future].slice(0, HISTORY_LIMIT),
      selectedId: previous.fixtures.some((f) => f.id === state.selectedId) ? state.selectedId : null,
      editing: false,
    });
  },

  redo() {
    const next = state.future[0];
    if (!next) return;
    set({
      doc: next,
      past: pushPast(state.past, state.doc),
      future: state.future.slice(1),
      selectedId: next.fixtures.some((f) => f.id === state.selectedId) ? state.selectedId : null,
      editing: false,
    });
  },

  resetLayout() {
    withHistory(ACTIVATION_20x20);
    set({ selectedId: null, hoveredId: null });
  },

  // ---- Style and assets ---------------------------------------------------

  /** One discrete style change, one undo step. */
  setStyle(patch: Partial<SceneStyle>) {
    withHistory({ ...state.doc, style: sanitizeStyle({ ...state.doc.style, ...patch }) });
  },

  /** Live style change during a slider or color drag; wrap with beginEdit / endEdit. */
  setStyleLive(patch: Partial<SceneStyle>) {
    set({ doc: { ...state.doc, style: sanitizeStyle({ ...state.doc.style, ...patch }) } });
  },

  addAssets(assets: Asset[]) {
    if (assets.length === 0) return;
    withHistory({ ...state.doc, assets: [...state.doc.assets, ...assets] });
  },

  renameAsset(id: string, name: string) {
    withHistory({
      ...state.doc,
      assets: state.doc.assets.map((a) => (a.id === id ? { ...a, name } : a)),
    });
  },

  /** Remove an asset and every reference to it. */
  removeAsset(id: string) {
    const doc = state.doc;
    const style: SceneStyle = {
      ...doc.style,
      brandLogoId: doc.style.brandLogoId === id ? null : doc.style.brandLogoId,
      floorTextureId: doc.style.floorTextureId === id ? null : doc.style.floorTextureId,
      wallTextureId: doc.style.wallTextureId === id ? null : doc.style.wallTextureId,
    };
    const fixtures = doc.fixtures.map((f) => {
      if (!f.slots) return f;
      const slots: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(f.slots)) {
        if (value !== id) slots[key] = value;
      }
      return sanitize({ ...f, slots }, doc.floor);
    });
    withHistory({ ...doc, style, fixtures, assets: doc.assets.filter((a) => a.id !== id) });
  },

  // ---- Camera -----------------------------------------------------------

  goToPreset(id: CameraPresetId) {
    cameraNonce += 1;
    set({ cameraRequest: { nonce: cameraNonce, kind: "preset", id }, autoOrbit: false });
  },

  /** Frame the selected fixture, or return to the hero view with nothing selected. */
  frameSelection() {
    cameraNonce += 1;
    set({
      cameraRequest: { nonce: cameraNonce, kind: "frame", fixtureId: state.selectedId },
      autoOrbit: false,
    });
  },

  toggleAutoOrbit() {
    set({ autoOrbit: !state.autoOrbit });
  },

  enterWalk() {
    if (state.cameraMode === "walk") return;
    set({ cameraMode: "walk", walkLocked: false, selectedId: null, hoveredId: null, autoOrbit: false });
  },

  exitWalk() {
    if (state.cameraMode !== "walk") return;
    set({ cameraMode: "orbit", walkLocked: false });
  },

  setWalkLocked(locked: boolean) {
    if (state.walkLocked !== locked) set({ walkLocked: locked });
  },
};
