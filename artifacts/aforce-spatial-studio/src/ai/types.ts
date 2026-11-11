import type { CameraPresetId } from "@/editor/camera";
import type { AssetKind, FixtureKind, Vec3 } from "@/scene/model";
import type { Finish, KeyTemperature } from "@/scene/style";

/**
 * Mirror of the server contract in
 * artifacts/api-server/src/lib/spatialStudio/editOps.ts. Every op field is
 * present and null when unused; the server has already validated targets,
 * resolved asset names to ids and clamped dimensions.
 */

export type OpKind =
  | "move"
  | "rotate"
  | "resize"
  | "add"
  | "remove"
  | "duplicate"
  | "rename"
  | "note"
  | "fixture_style"
  | "scene_style"
  | "set_slot"
  | "floor"
  | "camera";

export interface FixtureStylePatch {
  accent: string | null;
  surface: string | null;
  metal: string | null;
  finish: Finish | null;
  ledIntensity: number | null;
  clear: boolean | null;
}

export interface SceneStylePatch {
  accent: string | null;
  surface: string | null;
  panel: string | null;
  metal: string | null;
  floor: string | null;
  finish: Finish | null;
  floorFinish: Finish | null;
  ledIntensity: number | null;
  keyIntensity: number | null;
  fillIntensity: number | null;
  envIntensity: number | null;
  keyTemperature: KeyTemperature | null;
  /** Asset id (resolved by the server), "" to clear, null to leave alone. */
  brandLogo: string | null;
}

export interface EditOp {
  op: OpKind;
  id: string | null;
  kind: FixtureKind | null;
  label: string | null;
  text: string | null;
  x: number | null;
  z: number | null;
  dx: number | null;
  dz: number | null;
  degrees: number | null;
  by: number | null;
  width: number | null;
  depth: number | null;
  height: number | null;
  style: FixtureStylePatch | null;
  scene: SceneStylePatch | null;
  slot: string | null;
  asset: string | null;
  inherit: boolean | null;
  floorWidth: number | null;
  floorDepth: number | null;
  wallHeight: number | null;
  preset: CameraPresetId | null;
}

export interface EditResponse {
  summary: string;
  ops: EditOp[];
  questions: string[];
  warnings: string[];
  refused: boolean;
  model?: string;
  usage?: { input: number; output: number; cacheRead: number };
}

/** What the server receives: the document without image data. */
export interface SlimFixture {
  id: string;
  kind: FixtureKind;
  label: string;
  description?: string;
  position: Vec3;
  rotationDeg: number;
  footprint: { width: number; depth: number; height: number };
  style?: Record<string, unknown>;
  slots?: Record<string, string | null>;
}

export interface SlimDocument {
  name: string;
  floor: { width: number; depth: number; wallHeight: number };
  style: Record<string, unknown>;
  fixtures: SlimFixture[];
  assets: Array<{ id: string; kind: AssetKind; name: string }>;
}

export interface AssistantTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Human-readable lines for each applied operation. */
  applied?: string[];
  warnings?: string[];
  questions?: string[];
  error?: boolean;
}
