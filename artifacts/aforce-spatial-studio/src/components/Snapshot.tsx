import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { sceneBridge } from "@/editor/sceneBridge";
import { snapshotBridge, type CaptureOptions } from "@/editor/snapshot";

/**
 * Installs the canvas capture used for project thumbnails and renders.
 * Renders one frame synchronously and reads the drawing buffer before
 * the browser can clear it, so preserveDrawingBuffer stays off.
 */
export function Snapshot() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    sceneBridge.handles = { gl, scene, camera };
    snapshotBridge.capture = ({ width, type = "image/jpeg", quality = 0.8 }: CaptureOptions) => {
      gl.render(scene, camera);
      const source = gl.domElement;
      if (source.width === 0 || source.height === 0) return null;
      const out = document.createElement("canvas");
      const scale = width / source.width;
      out.width = Math.max(1, Math.round(width));
      out.height = Math.max(1, Math.round(source.height * scale));
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, out.width, out.height);
      return out.toDataURL(type, quality);
    };
    return () => {
      snapshotBridge.capture = null;
      sceneBridge.handles = null;
    };
  }, [gl, scene, camera]);

  return null;
}
