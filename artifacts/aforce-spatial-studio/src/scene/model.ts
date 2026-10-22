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
}

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
