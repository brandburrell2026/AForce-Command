import type * as THREE from "three";

/**
 * Live handles to the renderer, scene and camera, installed by the
 * Snapshot component inside the Canvas. Renders and exports run against
 * these from DOM-side code.
 */
export interface SceneHandles {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

export const sceneBridge: { handles: SceneHandles | null } = { handles: null };

/** Objects that belong to the editor, not the design: hidden in renders, dropped from exports. */
export function isEditorOnly(object: THREE.Object3D): boolean {
  if (object.userData.editorOnly === true) return true;
  return object.type.startsWith("TransformControls");
}

/** Objects that render but have no business in a 3D model file (the venue ground). */
export function isExportExcluded(object: THREE.Object3D): boolean {
  return object.userData.exportExclude === true || isEditorOnly(object);
}
