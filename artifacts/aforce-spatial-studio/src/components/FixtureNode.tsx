import { useMemo, useRef, useState } from "react";
import { TransformControls, useCursor } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";

import { editor, findFixture, useEditor } from "@/editor/store";
import type { Fixture, Footprint } from "@/scene/model";
import { resolveFixtureStyle } from "@/scene/style";

import { FIXTURE_COMPONENTS } from "./fixtures";
import { MaterialsProvider, useAssetTexture, useMaterialSet } from "./materials";
import { SelectionFrame } from "./SelectionFrame";

/**
 * One fixture in the editor: owns the world transform, click selection,
 * hover, and the transform gizmo when selected. Fixture components render
 * in local space inside this group.
 */
export function FixtureNode({ fixture }: { fixture: Fixture }) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const selected = useEditor((s) => s.selectedId === fixture.id);
  const hovered = useEditor((s) => s.hoveredId === fixture.id);
  const mode = useEditor((s) => s.mode);
  const snap = useEditor((s) => s.snap);
  const startFootprint = useRef<Footprint>(fixture.footprint);

  useCursor(hovered && !selected);

  const sceneStyle = useEditor((s) => s.doc.style);
  const resolved = useMemo(() => resolveFixtureStyle(sceneStyle, fixture.style), [sceneStyle, fixture.style]);
  const surfaceTexture = useAssetTexture(fixture.slots?.texture ?? null);
  const materials = useMaterialSet(resolved, surfaceTexture);

  const Component = FIXTURE_COMPONENTS[fixture.kind];

  /** Copy the sanitized store transform back onto the object so clamping is visible. */
  const syncFromStore = () => {
    const current = findFixture(fixture.id);
    if (!group || !current) return;
    group.position.set(current.position[0], 0, current.position[2]);
    group.rotation.set(0, current.rotationY, 0);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return; // an orbit drag that started on the fixture
    if (editor.isGizmoBusy()) return; // a gizmo handle over another fixture
    editor.select(fixture.id);
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    editor.hover(fixture.id);
  };

  const onPointerOut = () => {
    editor.hover(null);
  };

  const onGizmoDown = () => {
    editor.markGizmoBusy();
    startFootprint.current = fixture.footprint;
    editor.beginEdit();
  };

  const onGizmoChange = () => {
    if (!group) return;
    editor.markGizmoBusy();
    if (mode === "translate") {
      editor.updateLive(fixture.id, { position: [group.position.x, 0, group.position.z] });
      syncFromStore();
    } else if (mode === "rotate") {
      editor.updateLive(fixture.id, { rotationY: group.rotation.y });
      syncFromStore();
    }
    // Scale: the gizmo scales the group visually; the footprint commits on release.
  };

  const onGizmoUp = () => {
    editor.markGizmoBusy();
    if (group && mode === "scale") {
      const start = startFootprint.current;
      editor.updateLive(fixture.id, {
        footprint: {
          width: start.width * group.scale.x,
          height: start.height * group.scale.y,
          depth: start.depth * group.scale.z,
        },
      });
      group.scale.set(1, 1, 1);
      syncFromStore();
    }
    editor.endEdit();
  };

  return (
    <>
      <group
        ref={setGroup}
        name={fixture.label}
        userData={{ fixtureId: fixture.id, kind: fixture.kind }}
        position={fixture.position}
        rotation={[0, fixture.rotationY, 0]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <MaterialsProvider set={materials}>
          <Component fixture={fixture} />
        </MaterialsProvider>
        {(selected || hovered) && (
          <SelectionFrame footprint={fixture.footprint} tone={selected ? "signal" : "bone"} />
        )}
      </group>

      {selected && group && (
        <TransformControls
          object={group}
          mode={mode}
          showX={mode !== "rotate"}
          showZ={mode !== "rotate"}
          showY={mode !== "translate"}
          translationSnap={snap ? 0.5 : 0}
          rotationSnap={snap ? Math.PI / 12 : 0}
          scaleSnap={snap ? 0.25 : 0}
          size={0.9}
          onMouseDown={onGizmoDown}
          onMouseUp={onGizmoUp}
          onObjectChange={onGizmoChange}
        />
      )}
    </>
  );
}
