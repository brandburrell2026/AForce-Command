import { degToRad, radToDeg } from "@/editor/geometry";
import { editor, useEditor } from "@/editor/store";
import { KIND_LABELS, type Fixture } from "@/scene/model";
import { formatFootprint, squareFeet } from "@/scene/units";

import { NumberField, TextField } from "./fields";
import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

function Fields({ fixture }: { fixture: Fixture }) {
  const { id } = fixture;
  const [x, , z] = fixture.position;
  const { width, depth, height } = fixture.footprint;
  const degrees = Number(radToDeg(fixture.rotationY).toFixed(1));

  return (
    <div className="flex flex-col gap-4 p-3">
      <TextField label="Label" value={fixture.label} onCommit={(label) => editor.update(id, { label })} />

      <div>
        <Mono className="text-dim">Position · ft from floor center</Mono>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <NumberField label="X" value={x} onCommit={(v) => editor.update(id, { position: [v, 0, z] })} />
          <NumberField label="Z" value={z} onCommit={(v) => editor.update(id, { position: [x, 0, v] })} />
        </div>
      </div>

      <NumberField
        label="Rotation"
        unit="deg"
        value={degrees}
        step={15}
        decimals={1}
        onCommit={(v) => editor.update(id, { rotationY: degToRad(v) })}
      />

      <div>
        <Mono className="text-dim">Size · ft</Mono>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <NumberField label="W" value={width} min={0.5} onCommit={(v) => editor.update(id, { footprint: { width: v, depth, height } })} />
          <NumberField label="D" value={depth} min={0.5} onCommit={(v) => editor.update(id, { footprint: { width, depth: v, height } })} />
          <NumberField label="H" value={height} min={0.5} onCommit={(v) => editor.update(id, { footprint: { width, depth, height: v } })} />
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <Mono className="text-muted">{formatFootprint(width, depth, height)}</Mono>
          <Mono className="text-dim">{squareFeet(width, depth)} sq ft footprint</Mono>
        </div>
      </div>

      <TextField
        label="Notes"
        value={fixture.description}
        multiline
        onCommit={(description) => editor.update(id, { description })}
      />

      <div className="flex gap-1 border-t border-hairline pt-3">
        <ToolButton onClick={() => editor.duplicate(id)} hint="⌘D">
          Duplicate
        </ToolButton>
        <ToolButton onClick={() => editor.remove(id)} hint="⌫" tone="danger">
          Delete
        </ToolButton>
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const fixture = useEditor((s) => s.doc.fixtures.find((f) => f.id === s.selectedId) ?? null);

  return (
    <Panel className="flex flex-col">
      <PanelHeader right={fixture ? <Mono className="text-dim">{fixture.id}</Mono> : undefined}>
        {fixture ? KIND_LABELS[fixture.kind] : "Properties"}
      </PanelHeader>
      {fixture ? (
        <Fields key={fixture.id} fixture={fixture} />
      ) : (
        <div className="p-3">
          <p className="m-0 text-[12px] leading-relaxed text-muted">
            Nothing selected. Click a fixture in the scene, the floor plan or the list to move, rotate,
            scale and edit it. Add a new one from the toolbar.
          </p>
        </div>
      )}
    </Panel>
  );
}
