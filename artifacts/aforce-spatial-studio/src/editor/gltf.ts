import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

import { METERS_PER_FOOT } from "@/scene/units";

import { isExportExcluded, sceneBridge } from "./sceneBridge";
import { getEditorState } from "./store";

export interface GlbOptions {
  includeLights: boolean;
}

/** Name of the group in the Studio scene that holds the room and fixtures. */
export const ACTIVATION_NODE = "activation";

function prune(root: THREE.Object3D, includeLights: boolean) {
  const doomed: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o === root) return;
    if (isExportExcluded(o)) doomed.push(o);
    else if (!includeLights && (o as THREE.Light).isLight) doomed.push(o);
  });
  for (const o of doomed) o.parent?.remove(o);
}

/**
 * Export the activation as a binary glTF in meters. Clones the scene's
 * activation subtree, drops editor-only objects and the venue ground,
 * scales feet to meters at the root, and embeds the scene document (minus
 * image data) as extras so the file carries its own plan.
 */
export async function exportGLB(options: GlbOptions): Promise<Blob | null> {
  const handles = sceneBridge.handles;
  if (!handles) return null;
  const source = handles.scene.getObjectByName(ACTIVATION_NODE);
  if (!source) return null;

  const doc = getEditorState().doc;
  const clone = source.clone(true);
  prune(clone, options.includeLights);

  const root = new THREE.Group();
  root.name = doc.name;
  root.scale.setScalar(METERS_PER_FOOT);
  root.add(clone);
  root.userData = {
    aforceSpatialStudio: {
      exportedAt: new Date().toISOString(),
      unit: "m",
      sourceUnit: "ft",
      metersPerFoot: METERS_PER_FOOT,
      document: {
        ...doc,
        assets: doc.assets.map(({ id, kind, name, width, height }) => ({ id, kind, name, width, height })),
      },
    },
  };

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: true,
    maxTextureSize: 2048,
    includeCustomExtensions: false,
  });
  if (!(result instanceof ArrayBuffer)) return null;
  return new Blob([result], { type: "model/gltf-binary" });
}
