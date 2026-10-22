import { CAMERA_PRESETS, type CameraPresetId } from "@/editor/camera";
import { editor, useEditor } from "@/editor/store";

import { Divider, ToolButton } from "./ui";

export function ViewControls() {
  const autoOrbit = useEditor((s) => s.autoOrbit);
  const hasSelection = useEditor((s) => s.selectedId !== null);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <select
        value=""
        onChange={(e) => {
          const id = e.target.value as CameraPresetId | "";
          if (id) editor.goToPreset(id);
        }}
        className="h-8 cursor-pointer border border-hairline bg-ink/70 px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone outline-none hover:border-muted"
        aria-label="Camera view"
      >
        <option value="">View · 1–7</option>
        {CAMERA_PRESETS.map((preset, i) => (
          <option key={preset.id} value={preset.id}>
            {i + 1} · {preset.label}
          </option>
        ))}
      </select>
      <ToolButton onClick={() => editor.frameSelection()} hint="F">
        {hasSelection ? "Frame" : "Hero"}
      </ToolButton>
      <ToolButton active={autoOrbit} onClick={() => editor.toggleAutoOrbit()} hint="O">
        360°
      </ToolButton>
      <Divider />
      <ToolButton onClick={() => editor.enterWalk()} hint="V">
        Walk
      </ToolButton>
    </div>
  );
}
