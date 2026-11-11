import { useEffect, useMemo, useRef } from "react";
import type { ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

import {
  BODY_RADIUS,
  CAMERA_PRESETS,
  EYE_HEIGHT,
  RUN_SPEED,
  WALK_SPEED,
  type CameraRequest,
  walkBridge,
} from "@/editor/camera";
import { buildObstacles, resolveMove, walkBounds } from "@/editor/collision";
import { editor, getEditorState, useEditor } from "@/editor/store";
import type { FloorPlan, Vec3 } from "@/scene/model";

const DEFAULT_TARGET: Vec3 = [0, 3.5, 0];
const UP = new THREE.Vector3(0, 1, 0);
const FOV_RAD = (38 * Math.PI) / 180;

/** Poses survive mode switches for the life of the page. */
let orbitPose: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
let walkPose: { position: THREE.Vector3; quaternion: THREE.Quaternion } | null = null;
/** Last camera request flown, so a remounted orbit rig does not replay it. */
let handledNonce = 0;

interface Flight {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  duration: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Where a camera request wants the camera and its target. */
function resolveRequest(
  request: CameraRequest,
  camera: THREE.Camera,
  currentTarget: THREE.Vector3,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  if (request.kind === "preset") {
    const preset = CAMERA_PRESETS.find((p) => p.id === request.id) ?? CAMERA_PRESETS[0]!;
    return {
      position: new THREE.Vector3(...preset.position),
      target: new THREE.Vector3(...preset.target),
    };
  }
  const fixture = request.fixtureId
    ? getEditorState().doc.fixtures.find((f) => f.id === request.fixtureId)
    : undefined;
  if (!fixture) {
    const hero = CAMERA_PRESETS[0]!;
    return { position: new THREE.Vector3(...hero.position), target: new THREE.Vector3(...hero.target) };
  }
  const { width, depth, height } = fixture.footprint;
  const target = new THREE.Vector3(fixture.position[0], height / 2, fixture.position[2]);
  const radius = 0.5 * Math.hypot(width, depth, height) + 1;
  const distance = (radius / Math.tan(FOV_RAD / 2)) * 1.1;
  // Approach from where the camera already is, but never from below 25°.
  const dir = camera.position.clone().sub(currentTarget);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1);
  dir.normalize();
  if (dir.y < 0.42) {
    dir.y = 0.42;
    dir.normalize();
  }
  return { position: target.clone().addScaledVector(dir, distance), target };
}

function OrbitRig() {
  const camera = useThree((s) => s.camera);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const autoOrbit = useEditor((s) => s.autoOrbit);
  const request = useEditor((s) => s.cameraRequest);
  const flight = useRef<Flight | null>(null);

  // Restore the last orbit pose when coming back from a walkthrough.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (orbitPose) {
      camera.position.copy(orbitPose.position);
      c.target.copy(orbitPose.target);
      c.update();
    }
    return () => {
      orbitPose = { position: camera.position.clone(), target: c.target.clone() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!request || !c || request.nonce === handledNonce) return;
    handledNonce = request.nonce;
    const { position, target } = resolveRequest(request, camera, c.target);
    flight.current = {
      fromPos: camera.position.clone(),
      toPos: position,
      fromTarget: c.target.clone(),
      toTarget: target,
      t: 0,
      duration: 0.9,
    };
  }, [request, camera]);

  useFrame((_, delta) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + delta / f.duration);
    const k = easeInOutCubic(f.t);
    camera.position.lerpVectors(f.fromPos, f.toPos, k);
    c.target.lerpVectors(f.fromTarget, f.toTarget, k);
    c.update();
    if (f.t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={DEFAULT_TARGET}
      minDistance={6}
      maxDistance={110}
      maxPolarAngle={Math.PI / 2 - 0.03}
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoOrbit}
      autoRotateSpeed={0.5}
      onStart={() => {
        flight.current = null;
      }}
    />
  );
}

function spawnPose(floor: FloorPlan): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
  return {
    position: new THREE.Vector3(0, EYE_HEIGHT, floor.depth / 2 + 4),
    lookAt: new THREE.Vector3(0, 4, 0),
  };
}

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

function WalkRig() {
  const camera = useThree((s) => s.camera);
  const controls = useRef<ComponentRef<typeof PointerLockControls>>(null);
  const fixtures = useEditor((s) => s.doc.fixtures);
  const floor = useEditor((s) => s.doc.floor);
  const obstacles = useMemo(() => buildObstacles(fixtures, floor), [fixtures, floor]);
  const bounds = useMemo(() => walkBounds(floor, BODY_RADIUS), [floor]);
  const keys = useRef<Set<string>>(new Set());
  const scratch = useRef({
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    move: new THREE.Vector3(),
  });

  useEffect(() => {
    if (walkPose) {
      camera.position.copy(walkPose.position);
      camera.quaternion.copy(walkPose.quaternion);
    } else {
      const spawn = spawnPose(floor);
      camera.position.copy(spawn.position);
      camera.lookAt(spawn.lookAt);
    }
    walkBridge.lock = () => controls.current?.lock();

    const onDown = (e: KeyboardEvent) => {
      if (MOVE_KEYS.has(e.code)) {
        keys.current.add(e.code);
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
    };
    const onBlur = () => keys.current.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      walkBridge.lock = null;
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      walkPose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (!getEditorState().walkLocked) return;
    const k = keys.current;
    let f = 0;
    let s = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) f += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) f -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) s += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) s -= 1;
    if (f === 0 && s === 0) return;

    const dt = Math.min(delta, 0.05);
    const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    const { forward, right, move } = scratch.current;
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    right.crossVectors(forward, UP).normalize();
    move.copy(forward).multiplyScalar(f).addScaledVector(right, s);
    if (move.lengthSq() > 1) move.normalize();
    move.multiplyScalar(speed * dt);

    const next = resolveMove(
      { x: camera.position.x, z: camera.position.z },
      { x: camera.position.x + move.x, z: camera.position.z + move.z },
      BODY_RADIUS,
      obstacles,
      bounds,
    );
    camera.position.set(next.x, EYE_HEIGHT, next.z);
  });

  return (
    <PointerLockControls
      ref={controls}
      onLock={() => editor.setWalkLocked(true)}
      onUnlock={() => editor.setWalkLocked(false)}
    />
  );
}

/** Orbit camera with presets and turntable, or first-person walkthrough. */
export function CameraRig() {
  const mode = useEditor((s) => s.cameraMode);
  return mode === "walk" ? <WalkRig /> : <OrbitRig />;
}
