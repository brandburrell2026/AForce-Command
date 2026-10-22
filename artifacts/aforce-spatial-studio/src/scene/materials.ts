import * as THREE from "three";

/** AForce surface palette for the 3D world. Hexes match the brand system. */
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

// Shared material instances. Sharing keeps draw-call state changes low and
// means a palette change in one place restyles the whole activation.

export const matteBlack = new THREE.MeshStandardMaterial({
  color: PALETTE.black,
  roughness: 0.92,
  metalness: 0.08,
});

export const panelBlack = new THREE.MeshStandardMaterial({
  color: PALETTE.panel,
  roughness: 0.85,
  metalness: 0.1,
});

export const glossBlack = new THREE.MeshStandardMaterial({
  color: PALETTE.gloss,
  roughness: 0.25,
  metalness: 0.35,
});

export const floorBlack = new THREE.MeshStandardMaterial({
  color: PALETTE.black,
  roughness: 0.5,
  metalness: 0.2,
});

export const groundBlack = new THREE.MeshStandardMaterial({
  color: "#050505",
  roughness: 1,
  metalness: 0,
});

export const brushedMetal = new THREE.MeshStandardMaterial({
  color: PALETTE.metal,
  roughness: 0.32,
  metalness: 1,
});

export const darkMetal = new THREE.MeshStandardMaterial({
  color: PALETTE.darkMetal,
  roughness: 0.4,
  metalness: 0.9,
});

export const clothBlack = new THREE.MeshStandardMaterial({
  color: "#161616",
  roughness: 1,
  metalness: 0,
});

export const clothBone = new THREE.MeshStandardMaterial({
  color: PALETTE.bone,
  roughness: 1,
  metalness: 0,
});

export const clothRed = new THREE.MeshStandardMaterial({
  color: PALETTE.signalRed,
  roughness: 1,
  metalness: 0,
});

export const screenGlass = new THREE.MeshStandardMaterial({
  color: "#070707",
  roughness: 0.15,
  metalness: 0.6,
  emissive: "#120404",
  emissiveIntensity: 0.6,
});

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

export const signalRedLed = led(PALETTE.signalRed, 2.4);
export const signalRedLedSoft = led(PALETTE.signalRed, 1.1);
export const warmWhiteLed = led("#F4EFE6", 1.5);
export const coolWhiteLed = led("#FFFFFF", 2.0);

const flavorLeds = new Map<string, THREE.MeshStandardMaterial>();

export function flavorLed(color: string): THREE.MeshStandardMaterial {
  let m = flavorLeds.get(color);
  if (!m) {
    m = led(color, 1.6);
    flavorLeds.set(color, m);
  }
  return m;
}
