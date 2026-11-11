import { useSyncExternalStore } from "react";

import {
  ACTIVATION_20x20,
  createFixture,
  nextFixtureId,
  type Asset,
  type Fixture,
  type FixtureKind,
  type SceneDocument,
} from "@/scene/model";
import { sanitizeStyle, type SceneStyle } from "@/scene/style";

import type { CameraMode, CameraPresetId, CameraRequest } from "./camera";
import type { AssistantTurn } from "@/ai/types";

import type { ProjectSource } from "./remote";
import { DEFAULT_RENDER_SETTINGS, type RenderSettings } from "./renderSettings";
import { sanitizeFixture } from "./sanitize";

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
  /** Saved project this document belongs to, or null for an unsaved one. */
  projectId: string | null;
  /** The document as last written to storage; dirty when doc !== lastSavedDoc. */
  lastSavedDoc: SceneDocument | null;
  savedAt: number | null;
  autosave: boolean;
  saving: boolean;
  saveError: string | null;
  projectsOpen: boolean;
  /** Where saves go this session: the account (api-server) or this browser. */
  projectSource: ProjectSource;
  /** Why the account is not in use, when it is not. */
  accountNote: string | null;
  renderSettings: RenderSettings;
  /** Show the render frame overlay (the Export tab is open). */
  exportPreview: boolean;
  /** Progress line for an export or render in flight. */
  exportStatus: string | null;
  exportBusy: boolean;
  /** AI assistant transcript for this session (not persisted). */
  assistantTurns: AssistantTurn[];
  assistantBusy: boolean;
  /** Ask the inspector to show a tab (Cmd+K opens the assistant). */
  inspectorTabRequest: { tab: string; nonce: number } | null;
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
  projectId: null,
  lastSavedDoc: null,
  savedAt: null,
  autosave: true,
  saving: false,
  saveError: null,
  projectsOpen: false,
  projectSource: "unknown",
  accountNote: null,
  renderSettings: DEFAULT_RENDER_SETTINGS,
  exportPreview: false,
  exportStatus: null,
  exportBusy: false,
  assistantTurns: [],
  assistantBusy: false,
  inspectorTabRequest: null,
};

let tabNonce = 0;

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

function replaceFixture(
  doc: SceneDocument,
  id: string,
  updater: (f: Fixture) => Fixture,
): SceneDocument {
  return {
    ...doc,
    fixtures: doc.fixtures.map((f) => (f.id === id ? sanitizeFixture(updater(f), doc.floor) : f)),
  };
}

export function findFixture(id: string | null): Fixture | null {
  if (!id) return null;
  return state.doc.fixtures.find((f) => f.id === id) ?? null;
}

export const editor = {
  /** The current state, for callers that only read once. */
  snapshot(): EditorState {
    return state;
  },

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
    const id = nextFixtureId(state.doc, kind);
    const fixture = sanitizeFixture(createFixture(kind, id, [0, 0, 6]), state.doc.floor);
    withHistory({ ...state.doc, fixtures: [...state.doc.fixtures, fixture] });
    set({ selectedId: id });
  },

  duplicate(id: string) {
    const source = findFixture(id);
    if (!source) return;
    const copyId = nextFixtureId(state.doc, source.kind);
    const copy = sanitizeFixture(
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
      return sanitizeFixture({ ...f, slots }, doc.floor);
    });
    withHistory({ ...doc, style, fixtures, assets: doc.assets.filter((a) => a.id !== id) });
  },

  // ---- Projects -----------------------------------------------------------

  /** Replace the document wholesale (open, new, import). History resets. */
  loadDocument(doc: SceneDocument, projectId: string | null, savedAt: number | null) {
    set({
      doc,
      past: [],
      future: [],
      selectedId: null,
      hoveredId: null,
      editing: false,
      projectId,
      lastSavedDoc: projectId ? doc : null,
      savedAt,
      saving: false,
      saveError: null,
    });
  },

  setDocName(name: string) {
    const next = name.trim();
    if (!next || next === state.doc.name) return;
    withHistory({ ...state.doc, name: next });
  },

  setSaving(saving: boolean, error: string | null = null) {
    set({ saving, saveError: error });
  },

  /** Record a successful write of `doc` (the snapshot that was saved, not the live one). */
  markSaved(projectId: string, savedAt: number, doc: SceneDocument) {
    set({ projectId, lastSavedDoc: doc, savedAt, saving: false, saveError: null });
  },

  /** The current project was deleted from storage; keep editing it unsaved. */
  detachProject() {
    set({ projectId: null, lastSavedDoc: null, savedAt: null });
  },

  setAutosave(on: boolean) {
    if (state.autosave !== on) set({ autosave: on });
  },

  setProjectsOpen(open: boolean) {
    if (state.projectsOpen !== open) set({ projectsOpen: open });
  },

  setProjectSource(source: ProjectSource, note: string | null) {
    set({ projectSource: source, accountNote: note });
  },

  /** Clear a save error so autosave can resume (after the user acts on a conflict). */
  clearSaveError() {
    if (state.saveError) set({ saveError: null });
  },

  // ---- Whole-document commits and the assistant ----------------------------

  /** Replace the document as one undo step (AI edits, batch operations). */
  commitDocument(next: SceneDocument, selectId: string | null | undefined = undefined) {
    withHistory(next);
    if (selectId !== undefined) {
      const exists = selectId === null || next.fixtures.some((f) => f.id === selectId);
      set({ selectedId: exists ? selectId : null });
    }
  },

  assistantPush(turn: AssistantTurn) {
    set({ assistantTurns: [...state.assistantTurns, turn].slice(-40) });
  },

  assistantSetBusy(busy: boolean) {
    if (state.assistantBusy !== busy) set({ assistantBusy: busy });
  },

  assistantClear() {
    set({ assistantTurns: [] });
  },

  requestInspectorTab(tab: string) {
    tabNonce += 1;
    set({ inspectorTabRequest: { tab, nonce: tabNonce } });
  },

  // ---- Export -------------------------------------------------------------

  setRenderSettings(patch: Partial<RenderSettings>) {
    set({ renderSettings: { ...state.renderSettings, ...patch } });
  },

  setExportPreview(on: boolean) {
    if (state.exportPreview !== on) set({ exportPreview: on });
  },

  setExportStatus(status: string | null, busy = false) {
    set({ exportStatus: status, exportBusy: busy });
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
