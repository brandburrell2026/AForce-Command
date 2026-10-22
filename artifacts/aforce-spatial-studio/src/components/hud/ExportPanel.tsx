import { useEffect, useState } from "react";

import { runGlbExport, runRender } from "@/editor/exportActions";
import { exportProjectFile } from "@/editor/projects";
import { RENDER_SIZES, supersampleFactor, type RenderFormat } from "@/editor/renderSettings";
import { editor, useEditor } from "@/editor/store";

import { SelectField, type SelectOption } from "./fields";
import { Mono, Panel, PanelHeader, ToolButton } from "./ui";

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-signal" />
      <Mono className="text-muted">{label}</Mono>
    </label>
  );
}

const SIZE_OPTIONS: SelectOption[] = RENDER_SIZES.map((s) => ({ value: s.id, label: s.label }));
const FORMAT_OPTIONS: SelectOption[] = [
  { value: "png", label: "PNG · lossless" },
  { value: "jpeg", label: "JPEG · smaller" },
];

/** Renders, the contact sheet, the GLB model and the JSON document. */
export function ExportPanel() {
  const settings = useEditor((s) => s.renderSettings);
  const status = useEditor((s) => s.exportStatus);
  const busy = useEditor((s) => s.exportBusy);
  const [includeLights, setIncludeLights] = useState(true);

  // Show the render frame while this tab is open.
  useEffect(() => {
    editor.setExportPreview(true);
    return () => editor.setExportPreview(false);
  }, []);

  const sizeId = RENDER_SIZES.find((s) => s.width === settings.width && s.height === settings.height)?.id ?? "custom";
  const ss = supersampleFactor(settings);

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader right={busy ? <Mono className="text-signal">Working…</Mono> : undefined}>Export</PanelHeader>
      <div className="min-h-0 overflow-y-auto">
        <section className="flex flex-col gap-3 border-b border-hairline p-3">
          <Mono className="text-muted">Render · current view</Mono>
          <SelectField
            label="Size"
            value={sizeId}
            options={sizeId === "custom" ? [{ value: "custom", label: `${settings.width} × ${settings.height}` }, ...SIZE_OPTIONS] : SIZE_OPTIONS}
            onChange={(v) => {
              const size = RENDER_SIZES.find((s) => s.id === v);
              if (size) editor.setRenderSettings({ width: size.width, height: size.height });
            }}
          />
          <SelectField label="Format" value={settings.format} options={FORMAT_OPTIONS} onChange={(v) => editor.setRenderSettings({ format: v as RenderFormat })} />
          <Check label={`Supersample 2× ${ss === 2 ? "" : "(off above 2560 px)"}`} checked={settings.supersample} onChange={(v) => editor.setRenderSettings({ supersample: v })} />
          <Check label="Hide grid, outline and gizmo" checked={settings.hideOverlays} onChange={(v) => editor.setRenderSettings({ hideOverlays: v })} />
          <Check label="Transparent background (PNG)" checked={settings.transparent} onChange={(v) => editor.setRenderSettings({ transparent: v, format: v ? "png" : settings.format })} />
          <div className="flex gap-1">
            <ToolButton onClick={() => void runRender("still")} hint="⌘E" disabled={busy}>
              Render
            </ToolButton>
            <ToolButton onClick={() => void runRender("sheet")} disabled={busy}>
              Contact sheet · 7 views
            </ToolButton>
          </div>
          <Mono className="text-dim">
            The frame on the canvas shows the crop. Screen-space labels and the OS totem readout are
            not part of renders.
          </Mono>
        </section>

        <section className="flex flex-col gap-3 border-b border-hairline p-3">
          <Mono className="text-muted">3D model</Mono>
          <Check label="Include lights (KHR_lights_punctual)" checked={includeLights} onChange={setIncludeLights} />
          <div className="flex gap-1">
            <ToolButton onClick={() => void runGlbExport(includeLights)} hint="⇧⌘E" disabled={busy}>
              Export GLB
            </ToolButton>
          </div>
          <Mono className="text-dim">
            Binary glTF in meters: floor, walls and every fixture with its materials and uploaded
            images. The grid, outline, dimensions and venue ground are left out. The scene document
            rides along as extras.
          </Mono>
        </section>

        <section className="flex flex-col gap-3 p-3">
          <Mono className="text-muted">Data</Mono>
          <div className="flex gap-1">
            <ToolButton onClick={() => exportProjectFile()}>Export JSON</ToolButton>
          </div>
          {status ? <Mono className={status.includes("failed") ? "text-signal" : "text-bone"}>{status}</Mono> : null}
        </section>
      </div>
    </Panel>
  );
}
