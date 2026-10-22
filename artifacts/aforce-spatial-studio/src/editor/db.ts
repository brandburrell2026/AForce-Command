import type { SceneDocument } from "@/scene/model";

/**
 * IndexedDB persistence. Two object stores: "projects" holds light
 * metadata and a thumbnail for listing; "docs" holds the full scene
 * document (with its image data URLs) keyed by the same id.
 */

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fixtureCount: number;
  assetCount: number;
  /** Approximate serialized size of the document. */
  bytes: number;
  thumbnail: string | null;
}

const DB_NAME = "aforce-spatial-studio";
const DB_VERSION = 1;
const PROJECTS = "projects";
const DOCS = "docs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser has no IndexedDB, so projects cannot be saved."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open the project database."));
    request.onblocked = () => reject(new Error("The project database is open in another tab."));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Database request failed."));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Database transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Database transaction aborted."));
  });
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openDb();
  const metas = await wrap(db.transaction(PROJECTS, "readonly").objectStore(PROJECTS).getAll() as IDBRequest<ProjectMeta[]>);
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProjectMeta(id: string): Promise<ProjectMeta | null> {
  const db = await openDb();
  const meta = await wrap(db.transaction(PROJECTS, "readonly").objectStore(PROJECTS).get(id) as IDBRequest<ProjectMeta | undefined>);
  return meta ?? null;
}

export async function loadProject(id: string): Promise<{ meta: ProjectMeta; doc: unknown } | null> {
  const db = await openDb();
  const tx = db.transaction([PROJECTS, DOCS], "readonly");
  const meta = await wrap(tx.objectStore(PROJECTS).get(id) as IDBRequest<ProjectMeta | undefined>);
  const record = await wrap(tx.objectStore(DOCS).get(id) as IDBRequest<{ id: string; doc: unknown } | undefined>);
  if (!meta || !record) return null;
  return { meta, doc: record.doc };
}

export async function putProject(meta: ProjectMeta, doc: SceneDocument): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROJECTS, DOCS], "readwrite");
  tx.objectStore(PROJECTS).put(meta);
  tx.objectStore(DOCS).put({ id: meta.id, doc });
  await done(tx);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PROJECTS, DOCS], "readwrite");
  tx.objectStore(PROJECTS).delete(id);
  tx.objectStore(DOCS).delete(id);
  await done(tx);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage ?? 0, quota: quota ?? 0 };
  } catch {
    return null;
  }
}
