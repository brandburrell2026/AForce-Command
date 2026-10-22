/**
 * AForce Spatial Studio: the edit-operation contract between the model,
 * this server and the studio client.
 *
 * The model returns a flat list of operations (every field present,
 * unused ones null) so the structured-output schema stays simple. This
 * module validates each operation against the document the client sent,
 * resolves asset names to ids, and drops anything that cannot apply. It
 * imports no SDK so it is unit-testable in isolation. The studio client
 * mirrors these types in `artifacts/aforce-spatial-studio/src/ai/types.ts`.
 */
// zod/v4: the Anthropic SDK's zodOutputFormat helper types against zod v4, which zod 3.25 ships under this subpath.
import { z } from "zod/v4";

export const FIXTURE_KINDS = [
  "centerpiece",
  "hydration-bar",
  "lock-in-tunnel",
  "os-demo-station",
  "apparel-gallery",
  "content-studio",
] as const;
export type FixtureKind = (typeof FIXTURE_KINDS)[number];

/** Image slot keys per fixture kind. Mirrors FIXTURE_SLOTS in the studio. */
export const FIXTURE_SLOTS: Record<FixtureKind, readonly string[]> = {
  centerpiece: ["logo", "texture"],
  "hydration-bar": ["logo", "niche-0", "niche-1", "niche-2", "texture"],
  "lock-in-tunnel": ["logo", "texture"],
  "os-demo-station": ["screen", "logo", "texture"],
  "apparel-gallery": ["logo", "texture"],
  "content-studio": ["logo", "texture"],
};

export const FINISHES = ["matte", "satin", "gloss"] as const;
export const KEY_TEMPERATURES = ["warm", "neutral", "cool"] as const;
export const CAMERA_PRESETS = ["hero", "front", "overhead", "iso-left", "bar", "tunnel", "centerpiece"] as const;
export const ASSET_KINDS = ["logo", "texture", "product"] as const;

export const OP_KINDS = [
  "move",
  "rotate",
  "resize",
  "add",
  "remove",
  "duplicate",
  "rename",
  "note",
  "fixture_style",
  "scene_style",
  "set_slot",
  "floor",
  "camera",
] as const;
export type OpKind = (typeof OP_KINDS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex color like #C1281B");

// ---- What the client sends ------------------------------------------------

const SlimFixtureSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(FIXTURE_KINDS),
  label: z.string().max(120),
  description: z.string().max(400).optional(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationDeg: z.number(),
  footprint: z.object({ width: z.number(), depth: z.number(), height: z.number() }),
  style: z.record(z.string(), z.unknown()).optional(),
  slots: z.record(z.string(), z.string().nullable()).optional(),
});

const SlimAssetSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(ASSET_KINDS),
  name: z.string().max(120),
});

export const SlimDocumentSchema = z.object({
  name: z.string().max(120),
  floor: z.object({ width: z.number(), depth: z.number(), wallHeight: z.number() }),
  style: z.record(z.string(), z.unknown()),
  fixtures: z.array(SlimFixtureSchema).max(60),
  assets: z.array(SlimAssetSchema).max(100),
});
export type SlimDocument = z.infer<typeof SlimDocumentSchema>;

export const HistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(1200),
});

export const EditRequestSchema = z.object({
  doc: SlimDocumentSchema,
  instruction: z.string().trim().min(1).max(2000),
  selectedId: z.string().max(80).nullable().optional(),
  history: z.array(HistoryTurnSchema).max(8).optional(),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;

// ---- What the model returns -----------------------------------------------

const FixtureStylePatchSchema = z.object({
  accent: hex.nullable(),
  surface: hex.nullable(),
  metal: hex.nullable(),
  finish: z.enum(FINISHES).nullable(),
  ledIntensity: z.number().nullable(),
  /** Clear every override on the fixture before applying the rest. */
  clear: z.boolean().nullable(),
});

const SceneStylePatchSchema = z.object({
  accent: hex.nullable(),
  surface: hex.nullable(),
  panel: hex.nullable(),
  metal: hex.nullable(),
  floor: hex.nullable(),
  finish: z.enum(FINISHES).nullable(),
  floorFinish: z.enum(FINISHES).nullable(),
  ledIntensity: z.number().nullable(),
  keyIntensity: z.number().nullable(),
  fillIntensity: z.number().nullable(),
  envIntensity: z.number().nullable(),
  keyTemperature: z.enum(KEY_TEMPERATURES).nullable(),
  /** Asset name or id for the scene brand logo; "" clears it. */
  brandLogo: z.string().nullable(),
});

/**
 * One operation. Flat and fully nullable so the schema is simple for the
 * model; `validateOps` enforces which fields each op actually needs.
 */
export const EditOpSchema = z.object({
  op: z.enum(OP_KINDS),
  /** Target fixture id (every op except add, scene_style, floor, camera). */
  id: z.string().nullable(),
  /** add: fixture kind. */
  kind: z.enum(FIXTURE_KINDS).nullable(),
  /** add / rename: label. */
  label: z.string().nullable(),
  /** note: description text. */
  text: z.string().nullable(),
  /** move / add: absolute floor position in feet. */
  x: z.number().nullable(),
  z: z.number().nullable(),
  /** move / duplicate: relative offset in feet. */
  dx: z.number().nullable(),
  dz: z.number().nullable(),
  /** rotate / add: absolute heading in degrees. */
  degrees: z.number().nullable(),
  /** rotate: relative turn in degrees. */
  by: z.number().nullable(),
  /** resize / add: feet. */
  width: z.number().nullable(),
  depth: z.number().nullable(),
  height: z.number().nullable(),
  style: FixtureStylePatchSchema.nullable(),
  scene: SceneStylePatchSchema.nullable(),
  /** set_slot: slot key. */
  slot: z.string().nullable(),
  /** set_slot: asset name or id; null with inherit=false hides the slot. */
  asset: z.string().nullable(),
  /** set_slot: true returns the slot to the scene default. */
  inherit: z.boolean().nullable(),
  /** floor: new floor dimensions in feet. */
  floorWidth: z.number().nullable(),
  floorDepth: z.number().nullable(),
  wallHeight: z.number().nullable(),
  /** camera: preset id. */
  preset: z.enum(CAMERA_PRESETS).nullable(),
});
export type EditOp = z.infer<typeof EditOpSchema>;

export const EditResultSchema = z.object({
  /** One or two plain sentences on what was done or why nothing was. */
  summary: z.string(),
  ops: z.array(EditOpSchema),
  /** Clarifying questions when the instruction is ambiguous; ops is then empty. */
  questions: z.array(z.string()),
});
export type EditResult = z.infer<typeof EditResultSchema>;

// ---- Semantic validation ---------------------------------------------------

export interface ValidatedOps {
  ops: EditOp[];
  warnings: string[];
}

const MAX_OPS = 40;
const DIM_MIN = 0.5;
const DIM_MAX = 200;

function finite(v: number | null): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clampNum(v: number | null, lo: number, hi: number): number | null {
  return finite(v) ? Math.min(hi, Math.max(lo, v)) : null;
}

/**
 * Keep only the operations that can apply to this document. Resolves
 * asset names to ids (case-insensitive), clamps dimensions, and explains
 * each drop in `warnings` so the client can show them.
 */
export function validateOps(doc: SlimDocument, raw: readonly EditOp[]): ValidatedOps {
  const fixtures = new Map(doc.fixtures.map((f) => [f.id, f]));
  const assetsById = new Map(doc.assets.map((a) => [a.id, a]));
  const assetsByName = new Map(doc.assets.map((a) => [a.name.trim().toLowerCase(), a]));
  const warnings: string[] = [];
  const ops: EditOp[] = [];

  const resolveAsset = (ref: string): string | null => {
    const byId = assetsById.get(ref);
    if (byId) return byId.id;
    const byName = assetsByName.get(ref.trim().toLowerCase());
    return byName ? byName.id : null;
  };

  for (const op of raw.slice(0, MAX_OPS)) {
    const needsTarget = !["add", "scene_style", "floor", "camera"].includes(op.op);
    const target = op.id ? fixtures.get(op.id) : undefined;
    if (needsTarget && !target) {
      warnings.push(`${op.op}: no fixture with id "${op.id ?? ""}".`);
      continue;
    }

    switch (op.op) {
      case "move": {
        if (![op.x, op.z, op.dx, op.dz].some(finite)) {
          warnings.push(`move ${op.id}: no position or offset given.`);
          continue;
        }
        ops.push(op);
        break;
      }
      case "rotate": {
        if (!finite(op.degrees) && !finite(op.by)) {
          warnings.push(`rotate ${op.id}: no angle given.`);
          continue;
        }
        ops.push(op);
        break;
      }
      case "resize": {
        const width = clampNum(op.width, DIM_MIN, DIM_MAX);
        const depth = clampNum(op.depth, DIM_MIN, DIM_MAX);
        const height = clampNum(op.height, DIM_MIN, 60);
        if (width === null && depth === null && height === null) {
          warnings.push(`resize ${op.id}: no dimension given.`);
          continue;
        }
        ops.push({ ...op, width, depth, height });
        break;
      }
      case "add": {
        if (!op.kind) {
          warnings.push("add: no fixture kind given.");
          continue;
        }
        ops.push({
          ...op,
          x: finite(op.x) ? op.x : 0,
          z: finite(op.z) ? op.z : 0,
          width: clampNum(op.width, DIM_MIN, DIM_MAX),
          depth: clampNum(op.depth, DIM_MIN, DIM_MAX),
          height: clampNum(op.height, DIM_MIN, 60),
        });
        break;
      }
      case "remove":
      case "duplicate":
        ops.push(op);
        break;
      case "rename": {
        if (!op.label?.trim()) {
          warnings.push(`rename ${op.id}: empty label.`);
          continue;
        }
        ops.push({ ...op, label: op.label.trim().slice(0, 80) });
        break;
      }
      case "note": {
        if (!op.text?.trim()) {
          warnings.push(`note ${op.id}: empty text.`);
          continue;
        }
        ops.push({ ...op, text: op.text.trim().slice(0, 400) });
        break;
      }
      case "fixture_style": {
        if (!op.style) {
          warnings.push(`fixture_style ${op.id}: no style given.`);
          continue;
        }
        ops.push({ ...op, style: { ...op.style, ledIntensity: clampNum(op.style.ledIntensity, 0.1, 4) } });
        break;
      }
      case "scene_style": {
        if (!op.scene) {
          warnings.push("scene_style: no patch given.");
          continue;
        }
        let brandLogo = op.scene.brandLogo;
        if (brandLogo) {
          const resolved = resolveAsset(brandLogo);
          if (!resolved) {
            warnings.push(`scene_style: no logo asset named "${brandLogo}"; brand logo left unchanged.`);
            brandLogo = null;
          } else {
            brandLogo = resolved;
          }
        }
        ops.push({
          ...op,
          scene: {
            ...op.scene,
            brandLogo,
            ledIntensity: clampNum(op.scene.ledIntensity, 0.1, 4),
            keyIntensity: clampNum(op.scene.keyIntensity, 0, 3),
            fillIntensity: clampNum(op.scene.fillIntensity, 0, 3),
            envIntensity: clampNum(op.scene.envIntensity, 0, 3),
          },
        });
        break;
      }
      case "set_slot": {
        if (!target || !op.slot || !FIXTURE_SLOTS[target.kind].includes(op.slot)) {
          warnings.push(`set_slot ${op.id}: "${op.slot ?? ""}" is not a slot on a ${target?.kind ?? "fixture"}.`);
          continue;
        }
        if (op.inherit) {
          ops.push({ ...op, asset: null });
          break;
        }
        if (op.asset === null || op.asset === "") {
          ops.push({ ...op, asset: null, inherit: false });
          break;
        }
        const resolved = resolveAsset(op.asset);
        if (!resolved) {
          warnings.push(`set_slot ${op.id}: no uploaded image named "${op.asset}".`);
          continue;
        }
        ops.push({ ...op, asset: resolved, inherit: false });
        break;
      }
      case "floor": {
        const floorWidth = clampNum(op.floorWidth, 4, 200);
        const floorDepth = clampNum(op.floorDepth, 4, 200);
        const wallHeight = clampNum(op.wallHeight, 4, 40);
        if (floorWidth === null && floorDepth === null && wallHeight === null) {
          warnings.push("floor: no dimension given.");
          continue;
        }
        ops.push({ ...op, floorWidth, floorDepth, wallHeight });
        break;
      }
      case "camera": {
        if (!op.preset) {
          warnings.push("camera: no preset given.");
          continue;
        }
        ops.push(op);
        break;
      }
      default:
        warnings.push(`unknown op ${(op as { op: string }).op}.`);
    }
  }

  if (raw.length > MAX_OPS) warnings.push(`Only the first ${MAX_OPS} operations were applied.`);
  return { ops, warnings };
}
