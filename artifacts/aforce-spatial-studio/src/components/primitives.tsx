import type * as THREE from "three";

import type { Vec3 } from "@/scene/model";

interface SolidProps {
  position: Vec3;
  material: THREE.Material;
  rotation?: Vec3;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** Axis-aligned box: size is [width(x), height(y), depth(z)] in feet. */
export function Box({
  size,
  position,
  material,
  rotation,
  castShadow = true,
  receiveShadow = true,
}: SolidProps & { size: Vec3 }) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={size} />
    </mesh>
  );
}

/** Cylinder standing on its y axis: args are [radiusTop, radiusBottom, height, segments]. */
export function Cyl({
  args,
  position,
  material,
  rotation,
  castShadow = true,
  receiveShadow = true,
}: SolidProps & { args: [number, number, number, number] }) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <cylinderGeometry args={args} />
    </mesh>
  );
}

/** Ring lying in the local XY plane: args are [radius, tube, radialSegments, tubularSegments]. */
export function Ring({
  args,
  position,
  material,
  rotation,
  castShadow = false,
  receiveShadow = false,
}: SolidProps & { args: [number, number, number, number] }) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <torusGeometry args={args} />
    </mesh>
  );
}
