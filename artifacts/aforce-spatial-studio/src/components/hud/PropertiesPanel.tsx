import type { ReactNode } from "react";

import { degToRad, radToDeg } from "@/editor/geometry";
import { editor, useEditor } from "@/editor/store";
import { FIXTURE_SLOTS, KIND_LABELS, type Fixture } from "@/scene/model";
import { FINISHES, type Finish, type FixtureStyle } from "@/scene/style";
import { formatFootprint, squareFeet } from "@/scene/units";

import { ColorField, NumberField, RangeField, SelectField, TextField, type SelectOption } from "./fields";
import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-3">
      <Mono className="text-muted">{title}</Mono>
      {children}
    </section>
  );
}

/** Per-fixture color, finish and LED overrides, each inheriting the scene until set. */
function StyleFields({ fixture }: { fixture: Fixture }) {
  const scene = useEditor((s) => s.doc.style);
  const { id } = fixture;
  const own = fixture.style ?? {};

  const patch = (next: FixtureStyle, live: boolean) => {
    const merged: FixtureStyle = { ...own, ...next };
    if (live) editor.updateLive(id, { style: merged });
    else editor.update(id, { style: merged });
  };
  const colorPatch = (key: "accent" | "surface" | "metal", hex: string | undefined): FixtureStyle => {
    const next: FixtureStyle = {};
    next[key] = hex;
    return next;
  };
  const color = (key: "accent" | "surface" | "metal", label: string) => (
    <ColorField
      label={label}
      value={own[key] ?? scene[key]}
      inherited={own[key] === undefined}
      onLive={(hex) => patch(colorPatch(key, hex), true)}
      onCommit={(hex) => patch(colorPatch(key, hex), false)}
      onReset={() => patch(colorPatch(key, undefined), false)}
    />
  );
  const finishOptions: SelectOption[] = [
    { value: "", label: `Scene (${FINISHES[scene.finish].label})` },
    ...(Object.keys(FINISHES) as Finish[]).map((k) => ({ value: k, label: FINISHES[k].label })),
  ];

  return (
    <Section title="Style · overrides the scene">
      {color("accent", "Accent · LED")}
      {color("surface", "Surface")}
      {color("metal", "Metal trim")}
      <SelectField
        label="Finish"
        value={own.finish ?? ""}
        options={finishOptions}
        onChange={(v) => patch({ finish: v ? (v as Finish) : undefined }, false)}
      />
      <RangeField
        label="LED glow · relative to scene"
        value={own.ledIntensity ?? 1}
        min={0.1}
        max={4}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onLive={(v) => patch({ ledIntensity: v }, true)}
      />
      {fixture.style ? (
        <button
          type="button"
          onClick={() => editor.update(id, { style: undefined })}
          className="self-start font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal"
        >
          Clear all overrides
        </button>
      ) : null}
    </Section>
  );
}

/** Image slots: which uploaded asset each surface shows. */
function SlotFields({ fixture }: { fixture: Fixture }) {
  const assets = useEditor((s) => s.doc.assets);
  const slots = FIXTURE_SLOTS[fixture.kind];

  const setSlot = (key: string, value: string) => {
    const next: Record<string, string | null> = { ...fixture.slots };
    if (value === "") delete next[key];
    else if (value === "none") next[key] = null;
    else next[key] = value;
    editor.update(fixture.id, { slots: next });
  };

  return (
    <Section title="Images">
      {slots.map((slot) => {
        const current = fixture.slots?.[slot.key];
        const value = current === undefined ? "" : current === null ? "none" : current;
        const options: SelectOption[] =
          slot.key === "logo"
            ? [
                { value: "", label: "Scene brand logo" },
                { value: "none", label: "None" },
              ]
            : [{ value: "", label: "None" }];
        for (const a of assets) {
          if (a.kind === slot.accepts) options.push({ value: a.id, label: a.name });
        }
        return <SelectField key={slot.key} label={slot.label} value={value} options={options} onChange={(v) => setSlot(slot.key, v)} />;
      })}
      {assets.length === 0 ? <Mono className="text-dim">Upload images in the Assets tab.</Mono> : null}
    </Section>
  );
}

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

      <StyleFields fixture={fixture} />
      <SlotFields fixture={fixture} />

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
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader right={fixture ? <Mono className="text-dim">{fixture.id}</Mono> : undefined}>
        {fixture ? KIND_LABELS[fixture.kind] : "Fixture"}
      </PanelHeader>
      <div className="min-h-0 overflow-y-auto">
        {fixture ? (
          <Fields key={fixture.id} fixture={fixture} />
        ) : (
          <div className="p-3">
            <p className="m-0 text-[12px] leading-relaxed text-muted">
              Nothing selected. Click a fixture in the scene, the floor plan or the list to move, rotate,
              scale, restyle and brand it. Add a new one from the toolbar.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
