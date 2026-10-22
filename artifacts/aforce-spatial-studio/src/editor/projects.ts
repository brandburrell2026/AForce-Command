import { useEffect } from "react";

import { ACTIVATION_20x20, type SceneDocument } from "@/scene/model";

import * as db from "./db";
import { downloadBlob, slugify } from "./download";
import { normalizeDocument } from "./sanitize";
import { captureSnapshot } from "./snapshot";
import { editor, getEditorState, subscribeEditor } from "./store";

const LAST_PROJECT_KEY = "aforce-spatial-studio:last-project";
const AUTOSAVE_QUIET_MS = 1500;
const FILE_SUFFIX = ".aforce.json";

let projectCounter = 0;

function newProjectId(): string {
  projectCounter += 1;
  return `project-${Date.now().toString(36)}-${projectCounter}`;
}

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* private mode or blocked storage: reopening on load just will not work */
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Write the current document. `asNew` forks a new project; `name` renames
 * first. Returns whether the write succeeded; failures land in saveError.
 */
export async function saveProject(options: { asNew?: boolean; name?: string } = {}): Promise<boolean> {
  if (options.name) editor.setDocName(options.name);
  const state = getEditorState();
  if (state.saving) return false;
  const doc = state.doc;
  const id = options.asNew || !state.projectId ? newProjectId() : state.projectId;
  editor.setSaving(true);
  try {
    const existing = options.asNew ? null : await db.getProjectMeta(id);
    const now = Date.now();
    const thumbnail = captureSnapshot({ width: 480, type: "image/jpeg", quality: 0.72 });
    const meta: db.ProjectMeta = {
      id,
      name: doc.name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      fixtureCount: doc.fixtures.length,
      assetCount: doc.assets.length,
      bytes: JSON.stringify(doc).length,
      thumbnail: thumbnail ?? existing?.thumbnail ?? null,
    };
    await db.putProject(meta, doc);
    editor.markSaved(id, now, doc);
    remember(id);
    return true;
  } catch (err) {
    editor.setSaving(false, errorMessage(err));
    return false;
  }
}

export async function openProject(id: string): Promise<boolean> {
  const record = await db.loadProject(id);
  if (!record) return false;
  const doc = normalizeDocument(record.doc);
  editor.loadDocument(doc, id, record.meta.updatedAt);
  remember(id);
  return true;
}

export function newProject(template: "activation" | "empty") {
  const base: SceneDocument =
    template === "activation"
      ? { ...ACTIVATION_20x20, name: "Untitled activation" }
      : { ...ACTIVATION_20x20, name: "Empty 20 × 20", fixtures: [] };
  editor.loadDocument(base, null, null);
  remember(null);
}

export async function deleteProject(id: string): Promise<void> {
  await db.deleteProject(id);
  if (getEditorState().projectId === id) editor.detachProject();
  try {
    if (localStorage.getItem(LAST_PROJECT_KEY) === id) remember(null);
  } catch {
    /* ignore */
  }
}

/** On load: reopen whatever was open last time, if it still exists. */
export async function restoreLastProject(): Promise<void> {
  try {
    const id = localStorage.getItem(LAST_PROJECT_KEY);
    if (id) await openProject(id);
  } catch {
    /* a broken record or blocked storage: start from the template */
  }
}

// ---- JSON files ------------------------------------------------------------

export function exportProjectFile() {
  const doc = getEditorState().doc;
  const payload = {
    app: "aforce-spatial-studio",
    schemaVersion: doc.schemaVersion,
    exportedAt: new Date().toISOString(),
    doc,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${slugify(doc.name)}${FILE_SUFFIX}`);
}

/** Load a document from an exported file. It opens unsaved; save to keep it. */
export async function importProjectFile(file: File): Promise<void> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${file.name} is not valid JSON.`);
  }
  const raw =
    parsed && typeof parsed === "object" && "doc" in parsed ? (parsed as { doc: unknown }).doc : parsed;
  const doc = normalizeDocument(raw);
  editor.loadDocument(doc, null, null);
  remember(null);
}

// ---- Autosave --------------------------------------------------------------

/** Save a quiet period after any change to a project that already has an id. */
export function useAutosave() {
  useEffect(() => {
    let timer: number | null = null;
    const unsubscribe = subscribeEditor(() => {
      const s = getEditorState();
      if (!s.autosave || !s.projectId || s.saving || s.editing || s.doc === s.lastSavedDoc) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const latest = getEditorState();
        if (latest.autosave && latest.projectId && !latest.editing && latest.doc !== latest.lastSavedDoc) {
          void saveProject();
        }
      }, AUTOSAVE_QUIET_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);
}

export function useRestoreLastProject() {
  useEffect(() => {
    void restoreLastProject();
  }, []);
}
