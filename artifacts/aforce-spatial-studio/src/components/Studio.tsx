import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import type * as THREE from "three";

import type { SceneDocument, Vec3 } from "@/scene/model";
import { formatFootprint } from "@/scene/units";

import { FIXTURE_COMPONENTS } from "./fixtures";
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

function Fixtures({ doc }: { doc: SceneDocument }) {
  return (
    <>
      {doc.fixtures.map((fixture, i) => {
        const Component = FIXTURE_COMPONENTS[fixture.kind];
        const { width, depth, height } = fixture.footprint;
        const labelPos: Vec3 = [
          fixture.position[0],
          height + 1.1,
          fixture.position[2],
        ];
        return (
          <group key={fixture.id}>
            <Component fixture={fixture} />
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

export function Studio({ doc }: { doc: SceneDocument }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#070707"]} />
      <fog attach="fog" args={["#070707", 70, 170]} />

      <PerspectiveCamera makeDefault position={[27, 17, 31]} fov={38} near={0.5} far={400} />
      <OrbitControls
        makeDefault
        target={[0, 3.5, 0]}
        minDistance={8}
        maxDistance={95}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enableDamping
        dampingFactor={0.08}
      />

      <Suspense fallback={null}>
        <Lighting />
        <Room floor={doc.floor} />
        <Fixtures doc={doc} />
        <ContactShadows
          position={[0, 0.01, 0]}
          scale={48}
          opacity={0.55}
          blur={2}
          far={14}
          resolution={1024}
          frames={1}
          color="#000000"
        />
      </Suspense>
    </Canvas>
  );
}
