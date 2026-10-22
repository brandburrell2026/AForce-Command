import type { ReactNode } from "react";

import { editor, useEditor } from "@/editor/store";
import {
  DEFAULT_STYLE,
  FINISHES,
  KEY_TEMPERATURES,
  type Finish,
  type KeyTemperature,
  type SceneStyle,
} from "@/scene/style";

import { ColorField, RangeField, SelectField, type SelectOption } from "./fields";
import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

const FINISH_OPTIONS: SelectOption[] = (Object.keys(FINISHES) as Finish[]).map((k) => ({
  value: k,
  label: FINISHES[k].label,
}));

const TEMPERATURE_OPTIONS: SelectOption[] = (Object.keys(KEY_TEMPERATURES) as KeyTemperature[]).map((k) => ({
  value: k,
  label: KEY_TEMPERATURES[k].label,
}));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-hairline p-3 last:border-b-0">
      <Mono className="text-muted">{title}</Mono>
      {children}
    </section>
  );
}

type ColorKey = "accent" | "surface" | "panel" | "metal" | "floor";

function colorPatch(key: ColorKey, hex: string): Partial<SceneStyle> {
  const patch: Partial<SceneStyle> = {};
  patch[key] = hex;
  return patch;
}

function colorProps(key: ColorKey, style: SceneStyle) {
  return {
    value: style[key],
    onLive: (hex: string) => editor.setStyleLive(colorPatch(key, hex)),
    onCommit: (hex: string) => editor.setStyle(colorPatch(key, hex)),
  };
}

const times = (v: number) => `${v.toFixed(2)}×`;

/** Scene-wide colors, finishes, lighting and brand defaults. */
export function StylePanel() {
  const style = useEditor((s) => s.doc.style);
  const assets = useEditor((s) => s.doc.assets);

  const logos: SelectOption[] = [
    { value: "", label: "None" },
    ...assets.filter((a) => a.kind === "logo").map((a) => ({ value: a.id, label: a.name })),
  ];
  const textures: SelectOption[] = [
    { value: "", label: "None" },
    ...assets.filter((a) => a.kind === "texture").map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader
        right={
          <button
            type="button"
            onClick={() => editor.setStyle(DEFAULT_STYLE)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal"
          >
            Reset
          </button>
        }
      >
        Scene style
      </PanelHeader>
      <div className="min-h-0 overflow-y-auto">
        <Section title="Colors">
          <ColorField label="Accent · LED" {...colorProps("accent", style)} />
          <ColorField label="Surface" {...colorProps("surface", style)} />
          <ColorField label="Walls and panels" {...colorProps("panel", style)} />
          <ColorField label="Metal trim" {...colorProps("metal", style)} />
          <ColorField label="Floor" {...colorProps("floor", style)} />
        </Section>

        <Section title="Finish">
          <SelectField label="Surfaces" value={style.finish} options={FINISH_OPTIONS} onChange={(v) => editor.setStyle({ finish: v as Finish })} />
          <SelectField label="Floor" value={style.floorFinish} options={FINISH_OPTIONS} onChange={(v) => editor.setStyle({ floorFinish: v as Finish })} />
        </Section>

        <Section title="Lighting">
          <RangeField label="LED glow" value={style.ledIntensity} min={0.1} max={4} step={0.05} format={times} onLive={(v) => editor.setStyleLive({ ledIntensity: v })} />
          <RangeField label="Key light" value={style.keyIntensity} min={0} max={3} step={0.05} format={times} onLive={(v) => editor.setStyleLive({ keyIntensity: v })} />
          <RangeField label="Fill and ambient" value={style.fillIntensity} min={0} max={3} step={0.05} format={times} onLive={(v) => editor.setStyleLive({ fillIntensity: v })} />
          <RangeField label="Reflections" value={style.envIntensity} min={0} max={3} step={0.05} format={times} onLive={(v) => editor.setStyleLive({ envIntensity: v })} />
          <SelectField label="Key color temperature" value={style.keyTemperature} options={TEMPERATURE_OPTIONS} onChange={(v) => editor.setStyle({ keyTemperature: v as KeyTemperature })} />
        </Section>

        <Section title="Brand and textures">
          <SelectField label="Brand logo · all logo slots" value={style.brandLogoId ?? ""} options={logos} onChange={(v) => editor.setStyle({ brandLogoId: v || null })} />
          <SelectField label="Floor texture" value={style.floorTextureId ?? ""} options={textures} onChange={(v) => editor.setStyle({ floorTextureId: v || null })} />
          {style.floorTextureId ? (
            <RangeField label="Floor tile size" value={style.floorTextureScale} min={1} max={20} step={0.5} format={(v) => `${v} ft`} onLive={(v) => editor.setStyleLive({ floorTextureScale: v })} />
          ) : null}
          <SelectField label="Wall texture" value={style.wallTextureId ?? ""} options={textures} onChange={(v) => editor.setStyle({ wallTextureId: v || null })} />
          {assets.length === 0 ? (
            <Mono className="text-dim">Upload images in the Assets tab to use them here.</Mono>
          ) : null}
        </Section>

        <div className="flex gap-1 p-3">
          <ToolButton onClick={() => editor.setStyle({ accent: DEFAULT_STYLE.accent })}>Signal Red</ToolButton>
          <ToolButton onClick={() => editor.setStyle({ accent: "#1FA35A" })}>Soursop</ToolButton>
          <ToolButton onClick={() => editor.setStyle({ accent: "#1E5BFF" })}>Berry</ToolButton>
        </div>
      </div>
    </Panel>
  );
}
