/**
 * The scene document.
 *
 * A plain, serializable description of an activation. Everything the studio
 * renders, measures, exports or lets the AI edit reads from and writes to
 * this one structure. Section 1 ships a single static document; section 2
 * makes it editable; section 5 persists it.
 *
 * Units: feet. Origin: center of the floor. +x right, +y up, +z toward the
 * open front of the activation (toward the viewer).
 */

import { DEFAULT_STYLE, type FixtureStyle, type SceneStyle } from "./style";

export type Vec3 = [number, number, number];

export type FixtureKind =
  | "centerpiece"
  | "hydration-bar"
  | "lock-in-tunnel"
  | "os-demo-station"
  | "apparel-gallery"
  | "content-studio";

export interface Footprint {
  /** Extent along local x, feet. */
  width: number;
  /** Extent along local z, feet. */
  depth: number;
  /** Overall height above the floor, feet. */
  height: number;
}

export interface Fixture {
  id: string;
  kind: FixtureKind;
  label: string;
  description: string;
  /** Center of the footprint on the floor plane (y is always 0 for now). */
  position: Vec3;
  /** Rotation about the vertical axis, radians. */
  rotationY: number;
  footprint: Footprint;
  /** Color, finish and LED overrides. Absent keys inherit the scene style. */
  style?: FixtureStyle;
  /**
   * Image slots by slot key (see FIXTURE_SLOTS). A string is an asset id,
   * null hides the slot, an absent key inherits (the scene brand logo for
   * the "logo" slot, empty for the rest).
   */
  slots?: Record<string, string | null>;
}

export type AssetKind = "logo" | "texture" | "product";

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  /** Image data URL, downscaled on import. */
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface SlotDef {
  key: string;
  label: string;
  accepts: AssetKind;
}

const TEXTURE_SLOT: SlotDef = { key: "texture", label: "Surface texture", accepts: "texture" };

export interface FloorPlan {
  width: number;
  depth: number;
  wallHeight: number;
}

export interface SceneDocument {
  schemaVersion: 1;
  name: string;
  unit: "ft";
  floor: FloorPlan;
  fixtures: Fixture[];
  style: SceneStyle;
  assets: Asset[];
}

export type FlavorId = "watermelon" | "soursop" | "berry";

export interface Flavor {
  id: FlavorId;
  label: string;
  /** Accent used for the backlit niche and product tower. */
  color: string;
}

export const FLAVORS: readonly Flavor[] = [
  { id: "watermelon", label: "Watermelon", color: "#E8455A" },
  { id: "soursop", label: "Soursop", color: "#1FA35A" },
  { id: "berry", label: "Berry", color: "#1E5BFF" },
];

export const ACTIVATION_20x20: SceneDocument = {
  schemaVersion: 1,
  name: "AForce 20 × 20 Activation",
  unit: "ft",
  floor: { width: 20, depth: 20, wallHeight: 10 },
  style: DEFAULT_STYLE,
  assets: [],
  fixtures: [
    {
      id: "centerpiece",
      kind: "centerpiece",
      label: "Inverted-N centerpiece",
      description:
        "Illuminated Signal Red channel-letter inverted N on a matte black plinth. The hero of the floor.",
      position: [0, 0, 0.5],
      rotationY: 0,
      footprint: { width: 6, depth: 6, height: 7.5 },
    },
    {
      id: "hydration-bar",
      kind: "hydration-bar",
      label: "Hydration Bar",
      description:
        "Premium AForce hydration bar. Three backlit flavor niches: Watermelon, Soursop, Berry. Brushed-metal counter, red toe-kick.",
      position: [-1.5, 0, -7],
      rotationY: 0,
      footprint: { width: 12, depth: 6, height: 9 },
    },
    {
      id: "lock-in-tunnel",
      kind: "lock-in-tunnel",
      label: "Lock-In Tunnel",
      description:
        "Immersive red LED tunnel. Guests pause, hydrate and lock in before they reach the floor.",
      position: [-7.5, 0, 2.5],
      rotationY: 0,
      footprint: { width: 5, depth: 13, height: 8.5 },
    },
    {
      id: "os-demo-station",
      kind: "os-demo-station",
      label: "AForce OS demo",
      description:
        "Technology demonstration station: portrait totem running AForce OS, tablet for hands-on.",
      position: [6.5, 0, 6],
      rotationY: -0.5,
      footprint: { width: 5, depth: 3, height: 7 },
    },
    {
      id: "apparel-gallery",
      kind: "apparel-gallery",
      label: "Wear the Standard",
      description:
        "Apparel gallery on a backlit matte black panel. Brushed-metal rail, five pieces, folded stacks on a plinth.",
      position: [8.75, 0, -0.5],
      rotationY: 0,
      footprint: { width: 2.5, depth: 9, height: 9 },
    },
    {
      id: "content-studio",
      kind: "content-studio",
      label: "Content studio",
      description:
        "Branded photography and content corner: black cyc, ring light, camera, softbox key.",
      position: [7.5, 0, -7.5],
      rotationY: 0,
      footprint: { width: 5, depth: 5, height: 9 },
    },
  ],
};

export const FIXTURE_KINDS: readonly FixtureKind[] = [
  "centerpiece",
  "hydration-bar",
  "lock-in-tunnel",
  "os-demo-station",
  "apparel-gallery",
  "content-studio",
];

export const KIND_LABELS: Record<FixtureKind, string> = {
  centerpiece: "Inverted-N centerpiece",
  "hydration-bar": "Hydration bar",
  "lock-in-tunnel": "Lock-In tunnel",
  "os-demo-station": "AForce OS demo station",
  "apparel-gallery": "Apparel gallery",
  "content-studio": "Content studio",
};

/** A fresh fixture of the given kind, sized from the default activation's template. */
export function createFixture(kind: FixtureKind, id: string, position: Vec3 = [0, 0, 0]): Fixture {
  const template = ACTIVATION_20x20.fixtures.find((f) => f.kind === kind);
  if (!template) {
    throw new Error(`No template for fixture kind "${kind}"`);
  }
  return {
    ...template,
    id,
    position,
    rotationY: 0,
    footprint: { ...template.footprint },
  };
}

/** Where uploaded images can go on each fixture kind. */
export const FIXTURE_SLOTS: Record<FixtureKind, SlotDef[]> = {
  centerpiece: [{ key: "logo", label: "Plinth logo", accepts: "logo" }, TEXTURE_SLOT],
  "hydration-bar": [
    { key: "logo", label: "Fascia logo", accepts: "logo" },
    { key: "niche-0", label: "Watermelon niche image", accepts: "product" },
    { key: "niche-1", label: "Soursop niche image", accepts: "product" },
    { key: "niche-2", label: "Berry niche image", accepts: "product" },
    TEXTURE_SLOT,
  ],
  "lock-in-tunnel": [{ key: "logo", label: "Outer wall graphic", accepts: "logo" }, TEXTURE_SLOT],
  "os-demo-station": [
    { key: "screen", label: "Totem screen image", accepts: "product" },
    { key: "logo", label: "Counter logo", accepts: "logo" },
    TEXTURE_SLOT,
  ],
  "apparel-gallery": [{ key: "logo", label: "Panel logo", accepts: "logo" }, TEXTURE_SLOT],
  "content-studio": [{ key: "logo", label: "Backdrop logo", accepts: "logo" }, TEXTURE_SLOT],
};

/** Asset id for a slot after inheritance, or null for nothing. */
export function resolveSlot(fixture: Fixture, style: SceneStyle, key: string): string | null {
  const value = fixture.slots?.[key];
  if (value !== undefined) return value;
  return key === "logo" ? style.brandLogoId : null;
}

/** First unused `${kind}-${n}` id in the document. */
export function nextFixtureId(doc: SceneDocument, kind: FixtureKind): string {
  const ids = new Set(doc.fixtures.map((f) => f.id));
  let n = 1;
  while (ids.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}
