import { Suspense, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import type * as THREE from "three";

import { ACTIVATION_NODE } from "@/editor/gltf";
import { editor, useEditor } from "@/editor/store";
import type { Vec3 } from "@/scene/model";
import { KEY_TEMPERATURES, resolveFixtureStyle } from "@/scene/style";
import { formatFootprint } from "@/scene/units";

import { CameraRig } from "./CameraRig";
import { FixtureNode } from "./FixtureNode";
import { ZoneLabel } from "./labels";
import { MaterialsProvider, useAssetTexture, useMaterialSet } from "./materials";
import { Room } from "./Room";
import { Snapshot } from "./Snapshot";

/** Shadow-casting key light. Shadow settings live on the three object, so set them through a ref. */
function KeyLight({ intensity, color }: { intensity: number; color: string }) {
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
      intensity={intensity}
      decay={2}
      distance={0}
      color={color}
      castShadow
    />
  );
}

function Lighting() {
  const key = useEditor((s) => s.doc.style.keyIntensity);
  const fill = useEditor((s) => s.doc.style.fillIntensity);
  const env = useEditor((s) => s.doc.style.envIntensity);
  const temperature = useEditor((s) => s.doc.style.keyTemperature);
  const keyColor = KEY_TEMPERATURES[temperature].color;
  return (
    <>
      <ambientLight intensity={0.12 * fill} />
      <hemisphereLight intensity={0.3 * fill} color="#3a3a3a" groundColor="#000000" />
      <KeyLight intensity={1600 * key} color={keyColor} />
      <spotLight
        position={[-16, 20, 12]}
        angle={0.5}
        penumbra={1}
        intensity={500 * fill}
        decay={2}
        color="#FFFFFF"
      />
      <Environment resolution={256} frames={1} environmentIntensity={env}>
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 16, -10]} scale={[24, 4, 1]} />
        <Lightformer form="rect" intensity={1} color="#ffffff" position={[-16, 9, 6]} rotation={[0, Math.PI / 2, 0]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#ffd9d4" position={[16, 9, 6]} rotation={[0, -Math.PI / 2, 0]} scale={[14, 3, 1]} />
      </Environment>
    </>
  );
}

/** Scene-level materials for the room: the base style plus the wall texture. */
function SceneMaterials({ children }: { children: ReactNode }) {
  const style = useEditor((s) => s.doc.style);
  const wallTexture = useAssetTexture(style.wallTextureId);
  const set = useMaterialSet(resolveFixtureStyle(style), wallTexture);
  return <MaterialsProvider set={set}>{children}</MaterialsProvider>;
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
            <group userData={{ editorOnly: true }}>
              <ZoneLabel
                position={labelPos}
                index={i + 1}
                label={fixture.label}
                dims={formatFootprint(width, depth, height)}
              />
            </group>
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
      <Snapshot />

      <Suspense fallback={null}>
        <Lighting />
        <SceneMaterials>
          <group name={ACTIVATION_NODE}>
            <Floor />
            <Fixtures />
          </group>
        </SceneMaterials>
      </Suspense>
    </Canvas>
  );
}
