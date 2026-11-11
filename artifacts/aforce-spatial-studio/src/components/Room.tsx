import { useEffect, useMemo } from "react";
import { Grid } from "@react-three/drei";
import * as THREE from "three";

import { useEditor } from "@/editor/store";
import type { FloorPlan, Vec3 } from "@/scene/model";
import { FINISHES } from "@/scene/style";

import { Dimension } from "./labels";
import { useAssetTexture, useMaterials } from "./materials";
import { Box } from "./primitives";

/** Dark venue ground beyond the footprint; not part of the style. */
const ground = new THREE.MeshStandardMaterial({ color: "#050505", roughness: 1, metalness: 0 });

function useFloorMaterial(width: number, depth: number): THREE.MeshStandardMaterial {
  const color = useEditor((s) => s.doc.style.floor);
  const finish = useEditor((s) => s.doc.style.floorFinish);
  const textureId = useEditor((s) => s.doc.style.floorTextureId);
  const scale = useEditor((s) => s.doc.style.floorTextureScale);
  const texture = useAssetTexture(textureId);

  const material = useMemo(() => {
    const f = FINISHES[finish];
    const m = new THREE.MeshStandardMaterial({
      color: texture ? "#FFFFFF" : color,
      roughness: Math.max(0.2, f.roughness - 0.4),
      metalness: f.metalness + 0.1,
    });
    if (texture) {
      const map = texture.clone();
      map.repeat.set(width / scale, depth / scale);
      map.needsUpdate = true;
      m.map = map;
    }
    return m;
  }, [color, finish, texture, scale, width, depth]);

  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * The activation footprint: styled floor with a 1 ft grid, an accent
 * outline on the exact boundary, three perimeter walls with an LED cove,
 * and dimension callouts outside the front and right edges. The front
 * (+z) stays open toward the viewer.
 */
export function Room({ floor }: { floor: FloorPlan }) {
  const m = useMaterials();
  const { width: W, depth: D, wallHeight: H } = floor;
  const floorMaterial = useFloorMaterial(W, D);
  const hw = W / 2;
  const hd = D / 2;
  const t = 0.5; // wall thickness, outside the footprint
  const coveY = H - 0.3;
  const outlineY = 0.012;

  const outline: Array<{ size: Vec3; position: Vec3 }> = [
    { size: [W + 0.05, 0.02, 0.05], position: [0, outlineY, hd] },
    { size: [W + 0.05, 0.02, 0.05], position: [0, outlineY, -hd + 0.03] },
    { size: [0.05, 0.02, D + 0.05], position: [-hw + 0.03, outlineY, 0] },
    { size: [0.05, 0.02, D + 0.05], position: [hw - 0.03, outlineY, 0] },
  ];

  return (
    <group name="Room">
      {/* Venue ground beyond the footprint */}
      <mesh
        name="Venue ground"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        material={ground}
        receiveShadow
        userData={{ exportExclude: true }}
      >
        <planeGeometry args={[240, 240]} />
      </mesh>

      {/* Activation floor */}
      <mesh name="Floor" rotation={[-Math.PI / 2, 0, 0]} material={floorMaterial} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>

      {/* 1 ft grid, 5 ft sections */}
      <Grid
        userData={{ editorOnly: true }}
        position={[0, 0.006, 0]}
        args={[W, D]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#242120"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3632"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {/* Accent footprint outline: an editor cue, not part of the build */}
      <group userData={{ editorOnly: true }}>
        {outline.map((o, i) => (
          <Box key={i} size={o.size} position={o.position} material={m.accentSoft} castShadow={false} receiveShadow={false} />
        ))}
      </group>

      {/* Perimeter walls: back, left, right. Front is open. */}
      <Box name="Wall back" size={[W + 2 * t, H, t]} position={[0, H / 2, -hd - t / 2]} material={m.panel} />
      <Box name="Wall left" size={[t, H, D]} position={[-hw - t / 2, H / 2, 0]} material={m.panel} />
      <Box name="Wall right" size={[t, H, D]} position={[hw + t / 2, H / 2, 0]} material={m.panel} />

      {/* Metal dado rail */}
      <Box size={[W, 0.05, 0.03]} position={[0, 4, -hd + 0.015]} material={m.metal} castShadow={false} />
      <Box size={[0.03, 0.05, D]} position={[-hw + 0.015, 4, 0]} material={m.metal} castShadow={false} />
      <Box size={[0.03, 0.05, D]} position={[hw - 0.015, 4, 0]} material={m.metal} castShadow={false} />

      {/* LED cove along the top inner edge */}
      <Box size={[W, 0.06, 0.06]} position={[0, coveY, -hd + 0.03]} material={m.accent} castShadow={false} />
      <Box size={[0.06, 0.06, D]} position={[-hw + 0.03, coveY, 0]} material={m.accent} castShadow={false} />
      <Box size={[0.06, 0.06, D]} position={[hw - 0.03, coveY, 0]} material={m.accent} castShadow={false} />
      <pointLight position={[0, coveY - 0.5, -hd + 1.5]} color={m.accentHex} intensity={60 * m.ledIntensity} distance={24} decay={2} />

      {/* Dimension callouts outside the open front and the right edge */}
      <group userData={{ editorOnly: true }}>
        <Dimension from={[-hw, 0.02, hd + 1.6]} to={[hw, 0.02, hd + 1.6]} />
        <Dimension from={[hw + 1.6, 0.02, -hd]} to={[hw + 1.6, 0.02, hd]} />
      </group>
    </group>
  );
}
