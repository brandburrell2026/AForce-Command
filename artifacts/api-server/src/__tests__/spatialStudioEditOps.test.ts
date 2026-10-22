import { describe, expect, it } from "vitest";

import {
  EditOpSchema,
  EditRequestSchema,
  validateOps,
  type EditOp,
  type SlimDocument,
} from "../lib/spatialStudio/editOps";

const nullOp: Omit<EditOp, "op"> = {
  id: null,
  kind: null,
  label: null,
  text: null,
  x: null,
  z: null,
  dx: null,
  dz: null,
  degrees: null,
  by: null,
  width: null,
  depth: null,
  height: null,
  style: null,
  scene: null,
  slot: null,
  asset: null,
  inherit: null,
  floorWidth: null,
  floorDepth: null,
  wallHeight: null,
  preset: null,
};

const doc: SlimDocument = {
  name: "Test",
  floor: { width: 20, depth: 20, wallHeight: 10 },
  style: {},
  fixtures: [
    {
      id: "hydration-bar",
      kind: "hydration-bar",
      label: "Hydration Bar",
      position: [-1.5, 0, -7],
      rotationDeg: 0,
      footprint: { width: 12, depth: 6, height: 9 },
    },
    {
      id: "lock-in-tunnel",
      kind: "lock-in-tunnel",
      label: "Lock-In Tunnel",
      position: [-7.5, 0, 2.5],
      rotationDeg: 0,
      footprint: { width: 5, depth: 13, height: 8.5 },
    },
  ],
  assets: [{ id: "asset-1", kind: "logo", name: "AForce Monogram" }],
};

describe("spatial studio edit ops", () => {
  it("accepts a valid request body and rejects an oversized instruction", () => {
    expect(EditRequestSchema.safeParse({ doc, instruction: "move the bar left" }).success).toBe(true);
    expect(EditRequestSchema.safeParse({ doc, instruction: "x".repeat(2001) }).success).toBe(false);
  });

  it("keeps ops that target real fixtures and drops the rest with a warning", () => {
    const { ops, warnings } = validateOps(doc, [
      { ...nullOp, op: "move", id: "hydration-bar", dx: -2 },
      { ...nullOp, op: "move", id: "ghost", dx: 1 },
      { ...nullOp, op: "rotate", id: "lock-in-tunnel" },
    ]);
    expect(ops.map((o) => o.op)).toEqual(["move"]);
    expect(warnings).toHaveLength(2);
  });

  it("resolves asset names to ids on slots and the brand logo, case-insensitively", () => {
    const { ops, warnings } = validateOps(doc, [
      { ...nullOp, op: "set_slot", id: "hydration-bar", slot: "logo", asset: "aforce monogram" },
      { ...nullOp, op: "set_slot", id: "hydration-bar", slot: "screen", asset: "AForce Monogram" },
      {
        ...nullOp,
        op: "scene_style",
        scene: {
          accent: null, surface: null, panel: null, metal: null, floor: null, finish: null,
          floorFinish: null, ledIntensity: 9, keyIntensity: null, fillIntensity: null,
          envIntensity: null, keyTemperature: null, brandLogo: "AForce Monogram",
        },
      },
    ]);
    expect(ops[0]?.asset).toBe("asset-1");
    expect(ops[1]?.op).toBe("scene_style");
    expect(ops[1]?.scene?.brandLogo).toBe("asset-1");
    expect(ops[1]?.scene?.ledIntensity).toBe(4);
    expect(warnings.some((w) => w.includes("screen"))).toBe(true);
  });

  it("clamps dimensions and fills add defaults", () => {
    const { ops } = validateOps(doc, [
      { ...nullOp, op: "resize", id: "hydration-bar", width: 1000, height: 0.1 },
      { ...nullOp, op: "add", kind: "centerpiece" },
      { ...nullOp, op: "floor", floorWidth: 2 },
    ]);
    expect(ops[0]?.width).toBe(200);
    expect(ops[0]?.height).toBe(0.5);
    expect(ops[1]?.x).toBe(0);
    expect(ops[2]?.floorWidth).toBe(4);
  });

  it("round-trips an op through the output schema", () => {
    const parsed = EditOpSchema.safeParse({ ...nullOp, op: "camera", preset: "tunnel" });
    expect(parsed.success).toBe(true);
  });
});
