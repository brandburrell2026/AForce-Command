import * as THREE from "three";

import { FINISHES, type ResolvedStyle } from "./style";

/** AForce surface palette. Hexes match the brand system. */
export const PALETTE = {
  black: "#0D0D0D",
  panel: "#141414",
  gloss: "#0A0A0A",
  hairline: "#2D2A25",
  bone: "#EDEAE3",
  muted: "#A19C91",
  signalRed: "#C1281B",
  soursop: "#1FA35A",
  berry: "#1E5BFF",
  metal: "#9A9A9A",
  darkMetal: "#3A3A3A",
} as const;

/** Self-lit LED surface. toneMapped off so the color stays saturated. */
export function led(color: string, intensity = 2.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
    toneMapped: false,
  });
}

/**
 * Every material a fixture (or the room) is built from, derived from one
 * resolved style. Sets are created per fixture so overrides and surface
 * textures apply locally, and disposed when the style changes.
 */
export interface MaterialSet {
  accentHex: string;
  ledIntensity: number;
  surface: THREE.MeshStandardMaterial;
  panel: THREE.MeshStandardMaterial;
  gloss: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  accentSoft: THREE.MeshStandardMaterial;
  warmWhite: THREE.MeshStandardMaterial;
  coolWhite: THREE.MeshStandardMaterial;
  screen: THREE.MeshStandardMaterial;
  clothBlack: THREE.MeshStandardMaterial;
  clothBone: THREE.MeshStandardMaterial;
  clothAccent: THREE.MeshStandardMaterial;
  flavorLed(color: string): THREE.MeshStandardMaterial;
  dispose(): void;
}

export function createMaterialSet(
  style: ResolvedStyle,
  surfaceMap: THREE.Texture | null = null,
): MaterialSet {
  const finish = FINISHES[style.finish];
  // A texture carries its own color, so textured surfaces start from white.
  const surfaceColor = surfaceMap ? "#FFFFFF" : style.surface;
  const panelColor = surfaceMap ? "#FFFFFF" : style.panel;

  const surface = new THREE.MeshStandardMaterial({
    color: surfaceColor,
    roughness: finish.roughness,
    metalness: finish.metalness,
    map: surfaceMap ?? null,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: panelColor,
    roughness: Math.min(0.95, finish.roughness + 0.05),
    metalness: finish.metalness,
    map: surfaceMap ?? null,
  });
  const gloss = new THREE.MeshStandardMaterial({
    color: style.surface,
    roughness: 0.25,
    metalness: 0.35,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: style.metal,
    roughness: 0.32,
    metalness: 1,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: PALETTE.darkMetal,
    roughness: 0.4,
    metalness: 0.9,
  });
  const accent = led(style.accent, 2.4 * style.ledIntensity);
  const accentSoft = led(style.accent, 1.1 * style.ledIntensity);
  const warmWhite = led("#F4EFE6", 1.5 * style.ledIntensity);
  const coolWhite = led("#FFFFFF", 2.0 * style.ledIntensity);
  const screen = new THREE.MeshStandardMaterial({
    color: "#070707",
    roughness: 0.15,
    metalness: 0.6,
    emissive: "#120404",
    emissiveIntensity: 0.6,
  });
  const clothBlack = new THREE.MeshStandardMaterial({ color: "#161616", roughness: 1, metalness: 0 });
  const clothBone = new THREE.MeshStandardMaterial({ color: PALETTE.bone, roughness: 1, metalness: 0 });
  const clothAccent = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 1, metalness: 0 });

  const flavors = new Map<string, THREE.MeshStandardMaterial>();
  const all = [
    surface, panel, gloss, metal, darkMetal, accent, accentSoft, warmWhite, coolWhite,
    screen, clothBlack, clothBone, clothAccent,
  ];

  return {
    accentHex: style.accent,
    ledIntensity: style.ledIntensity,
    surface,
    panel,
    gloss,
    metal,
    darkMetal,
    accent,
    accentSoft,
    warmWhite,
    coolWhite,
    screen,
    clothBlack,
    clothBone,
    clothAccent,
    flavorLed(color: string) {
      let m = flavors.get(color);
      if (!m) {
        m = led(color, 1.6 * style.ledIntensity);
        flavors.set(color, m);
      }
      return m;
    },
    dispose() {
      for (const m of all) m.dispose();
      for (const m of flavors.values()) m.dispose();
      flavors.clear();
    },
  };
}
