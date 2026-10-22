/**
 * Scene style: the colors, finishes and lighting the whole activation is
 * built from, plus per-fixture overrides. Lives inside the scene document
 * so it saves, exports and can be edited by the AI alongside the layout.
 */

export type Finish = "matte" | "satin" | "gloss";
export type KeyTemperature = "warm" | "neutral" | "cool";

export interface SceneStyle {
  /** LED and accent color. Signal Red by default. */
  accent: string;
  /** Primary architectural surface. */
  surface: string;
  /** Walls and back panels. */
  panel: string;
  /** Trim, rails, counter tops. */
  metal: string;
  /** Activation floor. */
  floor: string;
  finish: Finish;
  floorFinish: Finish;
  /** Multiplier on every LED surface and LED light, 0.1–4. */
  ledIntensity: number;
  /** Multiplier on the shadow-casting key light, 0–3. */
  keyIntensity: number;
  /** Multiplier on fill, ambient and hemisphere light, 0–3. */
  fillIntensity: number;
  /** Multiplier on the reflection environment, 0–3. */
  envIntensity: number;
  keyTemperature: KeyTemperature;
  /** Default logo for every fixture's logo slot. */
  brandLogoId: string | null;
  floorTextureId: string | null;
  /** Feet covered by one repeat of the floor texture. */
  floorTextureScale: number;
  wallTextureId: string | null;
}

export interface FixtureStyle {
  accent?: string;
  surface?: string;
  metal?: string;
  finish?: Finish;
  ledIntensity?: number;
}

/** What a fixture's materials are actually built from, after overrides. */
export interface ResolvedStyle {
  accent: string;
  surface: string;
  panel: string;
  metal: string;
  finish: Finish;
  ledIntensity: number;
}

export const DEFAULT_STYLE: SceneStyle = {
  accent: "#C1281B",
  surface: "#0D0D0D",
  panel: "#141414",
  metal: "#9A9A9A",
  floor: "#0D0D0D",
  finish: "matte",
  floorFinish: "satin",
  ledIntensity: 1,
  keyIntensity: 1,
  fillIntensity: 1,
  envIntensity: 1,
  keyTemperature: "neutral",
  brandLogoId: null,
  floorTextureId: null,
  floorTextureScale: 4,
  wallTextureId: null,
};

export const FINISHES: Record<Finish, { label: string; roughness: number; metalness: number }> = {
  matte: { label: "Matte", roughness: 0.92, metalness: 0.08 },
  satin: { label: "Satin", roughness: 0.55, metalness: 0.18 },
  gloss: { label: "Gloss", roughness: 0.25, metalness: 0.35 },
};

export const KEY_TEMPERATURES: Record<KeyTemperature, { label: string; color: string }> = {
  warm: { label: "Warm 3200K", color: "#FFD9B3" },
  neutral: { label: "Neutral 4300K", color: "#FFF6EA" },
  cool: { label: "Cool 5600K", color: "#E9F0FF" },
};

export function resolveFixtureStyle(scene: SceneStyle, fixture?: FixtureStyle): ResolvedStyle {
  return {
    accent: fixture?.accent ?? scene.accent,
    surface: fixture?.surface ?? scene.surface,
    panel: scene.panel,
    metal: fixture?.metal ?? scene.metal,
    finish: fixture?.finish ?? scene.finish,
    ledIntensity: scene.ledIntensity * (fixture?.ledIntensity ?? 1),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function sanitizeStyle(style: SceneStyle): SceneStyle {
  return {
    ...style,
    ledIntensity: clamp(style.ledIntensity, 0.1, 4),
    keyIntensity: clamp(style.keyIntensity, 0, 3),
    fillIntensity: clamp(style.fillIntensity, 0, 3),
    envIntensity: clamp(style.envIntensity, 0, 3),
    floorTextureScale: clamp(style.floorTextureScale, 0.5, 40),
  };
}

export function sanitizeFixtureStyle(style: FixtureStyle | undefined): FixtureStyle | undefined {
  if (!style) return undefined;
  const out: FixtureStyle = { ...style };
  if (out.ledIntensity !== undefined) out.ledIntensity = clamp(out.ledIntensity, 0.1, 4);
  // Drop empty overrides so "inherit" stays the default.
  for (const key of Object.keys(out) as Array<keyof FixtureStyle>) {
    if (out[key] === undefined) delete out[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
