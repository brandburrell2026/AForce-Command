import { useSyncExternalStore } from "react";

import {
  ACTIVATION_20x20,
  createFixture,
  type Fixture,
  type FixtureKind,
  type FloorPlan,
  type SceneDocument,
} from "@/scene/model";

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
}

export type FixturePatch = Partial<
  Pick<Fixture, "label" | "description" | "position" | "rotationY" | "footprint">
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
};

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
  return { ...rotated, position: [round(x), 0, round(z)] };
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
};
