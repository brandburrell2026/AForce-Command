import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import type * as THREE from "three";

import { editor, useEditor } from "@/editor/store";
import type { Vec3 } from "@/scene/model";
import { formatFootprint } from "@/scene/units";

import { CameraRig } from "./CameraRig";
import { FixtureNode } from "./FixtureNode";
import { ZoneLabel } from "./labels";
import { Room } from "./Room";

/** Shadow-casting key light. Shadow settings live on the three object, so set them through a ref. */
function KeyLight() {
  const ref = useRef<THREE.SpotLight>(null);
  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.03;
    light.shadow.camera.near = 4;
    light.shadow.camera.far = 90;
    light.shadow.camera.updateProjectionMatrix();
  }, []);
  return (
    <spotLight
      ref={ref}
      position={[14, 26, 18]}
      angle={0.42}
      penumbra={0.7}
      intensity={1600}
      decay={2}
      distance={0}
      color="#FFF6EA"
      castShadow
    />
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <hemisphereLight intensity={0.3} color="#3a3a3a" groundColor="#000000" />
      <KeyLight />
      <spotLight
        position={[-16, 20, 12]}
        angle={0.5}
        penumbra={1}
        intensity={500}
        decay={2}
        color="#FFFFFF"
      />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 16, -10]} scale={[24, 4, 1]} />
        <Lightformer form="rect" intensity={1} color="#ffffff" position={[-16, 9, 6]} rotation={[0, Math.PI / 2, 0]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#ffd9d4" position={[16, 9, 6]} rotation={[0, -Math.PI / 2, 0]} scale={[14, 3, 1]} />
      </Environment>
    </>
  );
}

function Fixtures() {
  const fixtures = useEditor((s) => s.doc.fixtures);
  return (
    <>
      {fixtures.map((fixture, i) => {
        const { width, depth, height } = fixture.footprint;
        const labelPos: Vec3 = [fixture.position[0], height + 1.1, fixture.position[2]];
        return (
          <group key={fixture.id}>
            <FixtureNode fixture={fixture} />
            <ZoneLabel
              position={labelPos}
              index={i + 1}
              label={fixture.label}
              dims={formatFootprint(width, depth, height)}
            />
          </group>
        );
      })}
    </>
  );
}

function Floor() {
  const floor = useEditor((s) => s.doc.floor);
  return <Room floor={floor} />;
}

export function Studio() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => {
        if (!editor.isGizmoBusy()) editor.select(null);
      }}
    >
      <color attach="background" args={["#070707"]} />
      <fog attach="fog" args={["#070707", 70, 170]} />

      <PerspectiveCamera makeDefault position={[27, 17, 31]} fov={38} near={0.5} far={400} />
      <CameraRig />

      <Suspense fallback={null}>
        <Lighting />
        <Floor />
        <Fixtures />
      </Suspense>
    </Canvas>
  );
}
