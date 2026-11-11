import * as THREE from "three";

import { PALETTE } from "@/scene/materials";

/** Unlit hairline used by dimension callouts so it reads in any lighting. */
export const labelLine = new THREE.MeshBasicMaterial({
  color: PALETTE.muted,
  toneMapped: false,
});
