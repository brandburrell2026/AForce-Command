import { Grid } from "@react-three/drei";

import type { FloorPlan, Vec3 } from "@/scene/model";
import {
  brushedMetal,
  floorBlack,
  groundBlack,
  panelBlack,
  signalRedLed,
  signalRedLedSoft,
} from "@/scene/materials";

import { Dimension } from "./labels";
import { Box } from "./primitives";

/**
 * The activation footprint: matte black floor with a 1 ft grid, a Signal
 * Red outline on the exact 20 × 20 boundary, three perimeter walls with a
 * red LED cove, and dimension callouts outside the front and right edges.
 * The front (+z) stays open toward the viewer.
 */
export function Room({ floor }: { floor: FloorPlan }) {
  const { width: W, depth: D, wallHeight: H } = floor;
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
    <group>
      {/* Venue ground beyond the footprint */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        material={groundBlack}
        receiveShadow
      >
        <planeGeometry args={[240, 240]} />
      </mesh>

      {/* Activation floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={floorBlack} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>

      {/* 1 ft grid, 5 ft sections */}
      <Grid
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

      {/* Signal Red footprint outline */}
      {outline.map((o, i) => (
        <Box
          key={i}
          size={o.size}
          position={o.position}
          material={signalRedLedSoft}
          castShadow={false}
          receiveShadow={false}
        />
      ))}

      {/* Perimeter walls: back, left, right. Front is open. */}
      <Box size={[W + 2 * t, H, t]} position={[0, H / 2, -hd - t / 2]} material={panelBlack} />
      <Box size={[t, H, D]} position={[-hw - t / 2, H / 2, 0]} material={panelBlack} />
      <Box size={[t, H, D]} position={[hw + t / 2, H / 2, 0]} material={panelBlack} />

      {/* Metal dado rail */}
      <Box size={[W, 0.05, 0.03]} position={[0, 4, -hd + 0.015]} material={brushedMetal} castShadow={false} />
      <Box size={[0.03, 0.05, D]} position={[-hw + 0.015, 4, 0]} material={brushedMetal} castShadow={false} />
      <Box size={[0.03, 0.05, D]} position={[hw - 0.015, 4, 0]} material={brushedMetal} castShadow={false} />

      {/* Red LED cove along the top inner edge */}
      <Box size={[W, 0.06, 0.06]} position={[0, coveY, -hd + 0.03]} material={signalRedLed} castShadow={false} />
      <Box size={[0.06, 0.06, D]} position={[-hw + 0.03, coveY, 0]} material={signalRedLed} castShadow={false} />
      <Box size={[0.06, 0.06, D]} position={[hw - 0.03, coveY, 0]} material={signalRedLed} castShadow={false} />
      <pointLight position={[0, coveY - 0.5, -hd + 1.5]} color="#C1281B" intensity={60} distance={24} decay={2} />

      {/* Dimension callouts outside the open front and the right edge */}
      <Dimension from={[-hw, 0.02, hd + 1.6]} to={[hw, 0.02, hd + 1.6]} />
      <Dimension from={[hw + 1.6, 0.02, -hd]} to={[hw + 1.6, 0.02, hd]} />
    </group>
  );
}
