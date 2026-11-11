import { radToDeg } from "@/editor/geometry";
import type { SceneDocument } from "@/scene/model";

import type { AssistantTurn, EditResponse, SlimDocument } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const EDIT_URL = `${API_BASE}/api/spatial-studio/edit`;

/** Strip image data and round numbers so the request stays well under the API body cap. */
export function slimDocument(doc: SceneDocument): SlimDocument {
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    name: doc.name,
    floor: doc.floor,
    style: { ...doc.style },
    fixtures: doc.fixtures.map((f) => ({
      id: f.id,
      kind: f.kind,
      label: f.label,
      description: f.description ? f.description.slice(0, 200) : undefined,
      position: [r(f.position[0]), 0, r(f.position[2])],
      rotationDeg: Math.round(radToDeg(f.rotationY) * 10) / 10,
      footprint: { width: r(f.footprint.width), depth: r(f.footprint.depth), height: r(f.footprint.height) },
      style: f.style ? { ...f.style } : undefined,
      slots: f.slots,
    })),
    assets: doc.assets.map((a) => ({ id: a.id, kind: a.kind, name: a.name })),
  };
}

export class EditRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  ai_unavailable: "AI edits are not configured on the server yet. Add ANTHROPIC_API_KEY to api-server.",
  ai_rate_limited: "The model is busy. Try again in a few seconds.",
  ai_unparseable: "The assistant answered in a shape the studio could not read. Try rephrasing.",
  ai_error: "The model service returned an error. Try again.",
  unauthorized: "Sign in on this host to use AI edits.",
  rate_limited: "Too many requests. Wait a moment and try again.",
  invalid_request: "The request was rejected. Try a shorter instruction.",
};

/** Last few turns as plain text so the model keeps thread context. */
function historyFor(turns: AssistantTurn[]): Array<{ role: "user" | "assistant"; content: string }> {
  return turns
    .filter((t) => !t.error)
    .slice(-6)
    .map((t) => ({
      role: t.role,
      content: (t.role === "assistant" && t.applied?.length ? `${t.text} (${t.applied.join("; ")})` : t.text).slice(0, 1200),
    }));
}

export async function requestEdit(
  doc: SceneDocument,
  instruction: string,
  selectedId: string | null,
  turns: AssistantTurn[],
): Promise<EditResponse> {
  let res: Response;
  try {
    res = await fetch(EDIT_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: slimDocument(doc), instruction, selectedId, history: historyFor(turns) }),
    });
  } catch {
    throw new EditRequestError("Could not reach the API server.", 0, "network");
  }

  if (!res.ok) {
    let code = res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : "ai_error";
    try {
      const body = (await res.json()) as { code?: string; error?: string };
      code = body.code ?? body.error ?? code;
    } catch {
      /* non-JSON error body */
    }
    throw new EditRequestError(MESSAGES[code] ?? `Request failed (${res.status}).`, res.status, code);
  }
  return (await res.json()) as EditResponse;
}
