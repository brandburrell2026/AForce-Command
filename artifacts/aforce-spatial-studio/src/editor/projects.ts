import { useEffect } from "react";

import { ACTIVATION_20x20, type SceneDocument } from "@/scene/model";

import * as local from "./db";
import type { ProjectMeta } from "./db";
import { downloadBlob, slugify } from "./download";
import { probeAccount, remote, RemoteError, type ProjectSource, type RemoteProjectMeta } from "./remote";
import { normalizeDocument } from "./sanitize";
import { captureSnapshot } from "./snapshot";
import { editor, getEditorState, subscribeEditor } from "./store";

/**
 * Project flows over two sources: the member's account (api-server, when
 * the host has a session and the table exists) or this browser's IndexedDB.
 * The source is decided once per page load by probeAccount; every flow
 * below dispatches on it. Local projects remain visible in account mode so
 * they can be moved across.
 */

const LAST_PROJECT_KEY = "aforce-spatial-studio:last-project";
const LAST_SOURCE_KEY = "aforce-spatial-studio:last-source";
const AUTOSAVE_QUIET_MS = 1500;
const FILE_SUFFIX = ".aforce.json";

let projectCounter = 0;

function newProjectId(): string {
  projectCounter += 1;
  return `project-${Date.now().toString(36)}-${projectCounter}`;
}

function remember(id: string | null, source: ProjectSource | null = null) {
  try {
    if (id) {
      localStorage.setItem(LAST_PROJECT_KEY, id);
      if (source) localStorage.setItem(LAST_SOURCE_KEY, source);
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY);
      localStorage.removeItem(LAST_SOURCE_KEY);
    }
  } catch {
    /* private mode or blocked storage: reopening on load just will not work */
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function fromRemote(meta: RemoteProjectMeta): ProjectMeta {
  return {
    id: meta.id,
    name: meta.name,
    createdAt: Date.parse(meta.createdAt),
    updatedAt: Date.parse(meta.updatedAt),
    fixtureCount: meta.fixtureCount,
    assetCount: meta.assetCount,
    bytes: meta.bytes,
    thumbnail: meta.thumbnail,
  };
}

function activeSource(): ProjectSource {
  const { projectSource } = getEditorState();
  return projectSource === "account" ? "account" : "local";
}

// ---- Source -----------------------------------------------------------------

/** Decide where projects live, then reopen the last one if it is still there. */
export async function initProjects(): Promise<void> {
  const { source, note } = await probeAccount();
  editor.setProjectSource(source, note);
  await restoreLastProject();
}

export async function restoreLastProject(): Promise<void> {
  try {
    const id = localStorage.getItem(LAST_PROJECT_KEY);
    const source = (localStorage.getItem(LAST_SOURCE_KEY) as ProjectSource | null) ?? "local";
    if (!id) return;
    if (source === "account" && activeSource() !== "account") return;
    await openProject(id, source === "account" ? "account" : "local");
  } catch {
    /* a broken record or blocked storage: start from the template */
  }
}

// ---- Listing ----------------------------------------------------------------

export async function listProjects(source: ProjectSource = activeSource()): Promise<ProjectMeta[]> {
  if (source === "account") return (await remote.list()).map(fromRemote);
  return local.listProjects();
}

// ---- Save -------------------------------------------------------------------

/**
 * Write the current document to the active source. `asNew` forks a new
 * project; `name` renames first. A stale write against the account answers
 * 409 and is reported, never forced.
 */
export async function saveProject(options: { asNew?: boolean; name?: string } = {}): Promise<boolean> {
  if (options.name) editor.setDocName(options.name);
  const state = getEditorState();
  if (state.saving) return false;
  const doc = state.doc;
  const source = activeSource();
  const id = options.asNew || !state.projectId ? newProjectId() : state.projectId;
  editor.setSaving(true);
  try {
    const thumbnail = captureSnapshot({ width: 480, type: "image/jpeg", quality: 0.72 });
    if (source === "account") {
      const expectedUpdatedAt =
        !options.asNew && state.projectId === id && state.savedAt ? new Date(state.savedAt).toISOString() : null;
      const meta = await remote.put(id, { name: doc.name, document: doc, thumbnail, expectedUpdatedAt });
      editor.markSaved(id, Date.parse(meta.updatedAt), doc);
    } else {
      const existing = options.asNew ? null : await local.getProjectMeta(id);
      const now = Date.now();
      await local.putProject(
        {
          id,
          name: doc.name,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          fixtureCount: doc.fixtures.length,
          assetCount: doc.assets.length,
          bytes: JSON.stringify(doc).length,
          thumbnail: thumbnail ?? existing?.thumbnail ?? null,
        },
        doc,
      );
      editor.markSaved(id, now, doc);
    }
    remember(id, source);
    return true;
  } catch (err) {
    editor.setSaving(false, errorMessage(err));
    return false;
  }
}

// ---- Open / new / delete ----------------------------------------------------

export async function openProject(id: string, source: ProjectSource = activeSource()): Promise<boolean> {
  if (source === "account") {
    const record = await remote.get(id);
    const doc = normalizeDocument(record.document);
    editor.loadDocument(doc, id, Date.parse(record.updatedAt));
    remember(id, "account");
    return true;
  }
  const record = await local.loadProject(id);
  if (!record) return false;
  const doc = normalizeDocument(record.doc);
  editor.loadDocument(doc, id, record.meta.updatedAt);
  remember(id, "local");
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

export async function deleteProject(id: string, source: ProjectSource = activeSource()): Promise<void> {
  if (source === "account") await remote.remove(id);
  else await local.deleteProject(id);
  if (getEditorState().projectId === id) editor.detachProject();
  try {
    if (localStorage.getItem(LAST_PROJECT_KEY) === id) remember(null);
  } catch {
    /* ignore */
  }
}

/**
 * Copy a browser-local project into the account, then drop the local copy.
 * The id is kept so links and the last-project memory stay valid.
 */
export async function moveProjectToAccount(id: string): Promise<void> {
  const record = await local.loadProject(id);
  if (!record) throw new Error("That local project no longer exists.");
  const doc = normalizeDocument(record.doc);
  const meta = await remote.put(id, {
    name: record.meta.name,
    document: doc,
    thumbnail: record.meta.thumbnail,
    expectedUpdatedAt: null,
  });
  await local.deleteProject(id);
  if (getEditorState().projectId === id) {
    // The uploaded copy is what is saved; live edits since stay dirty and
    // autosave carries them to the account next.
    editor.markSaved(id, Date.parse(meta.updatedAt), doc);
    remember(id, "account");
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
      // A conflict needs a human decision; do not keep retrying over it.
      if (s.saveError) return;
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

export function useInitProjects() {
  useEffect(() => {
    void initProjects();
  }, []);
}

export { RemoteError };
