import type { SceneDocument } from "@/scene/model";

/**
 * Account-backed project storage on api-server
 * (/api/spatial-studio/projects). Same-origin, cookie-authenticated.
 * Errors carry the HTTP status and the server's error code so the flows can
 * tell "not signed in" from "table not pushed yet" from "changed elsewhere".
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const BASE = `${API_BASE}/api/spatial-studio/projects`;

export interface RemoteProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fixtureCount: number;
  assetCount: number;
  bytes: number;
  thumbnail: string | null;
}

export interface RemoteProjectRecord extends RemoteProjectMeta {
  document: unknown;
}

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly current: RemoteProjectMeta | null = null,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  unauthorized: "Sign in on this host to keep projects in your account.",
  storage_unavailable: "Account storage is not set up on the server yet.",
  conflict: "This project changed in another window. Open it again to load the latest version.",
  project_too_large: "This project is too large to store in your account (11 MB limit). Remove some images.",
  not_found: "That project is no longer in your account.",
  network: "Could not reach the API server.",
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: "include", ...init });
  } catch {
    throw new RemoteError(MESSAGES.network!, 0, "network");
  }
  if (res.status === 204) return undefined as T;
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const code =
      (typeof body.code === "string" && body.code) ||
      (typeof body.error === "string" && body.error) ||
      (res.status === 401 ? "unauthorized" : res.status === 503 ? "storage_unavailable" : "error");
    const current = code === "conflict" && body.current ? (body.current as RemoteProjectMeta) : null;
    throw new RemoteError(MESSAGES[code] ?? `Account storage failed (${res.status}).`, res.status, code, current);
  }
  return body as T;
}

export const remote = {
  async list(): Promise<RemoteProjectMeta[]> {
    const { projects } = await call<{ projects: RemoteProjectMeta[] }>("");
    return projects;
  },
  async get(id: string): Promise<RemoteProjectRecord> {
    const { project } = await call<{ project: RemoteProjectRecord }>(`/${encodeURIComponent(id)}`);
    return project;
  },
  async put(
    id: string,
    body: { name: string; document: SceneDocument; thumbnail: string | null; expectedUpdatedAt: string | null },
  ): Promise<RemoteProjectMeta> {
    const { project } = await call<{ project: RemoteProjectMeta }>(`/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return project;
  },
  async remove(id: string): Promise<void> {
    await call<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

export type ProjectSource = "unknown" | "account" | "local";

/** One cheap list call decides where projects live for this session. */
export async function probeAccount(): Promise<{ source: ProjectSource; note: string | null }> {
  try {
    await remote.list();
    return { source: "account", note: null };
  } catch (err) {
    const message = err instanceof RemoteError ? err.message : MESSAGES.network!;
    return { source: "local", note: message };
  }
}
