import { editor, useEditor } from "@/editor/store";
import { FIXTURE_KINDS, KIND_LABELS, type FixtureKind } from "@/scene/model";

import { Divider, ToolButton } from "./ui";

export function Toolbar() {
  const mode = useEditor((s) => s.mode);
  const snap = useEditor((s) => s.snap);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <ToolButton active={mode === "translate"} onClick={() => editor.setMode("translate")} hint="W">
        Move
      </ToolButton>
      <ToolButton active={mode === "rotate"} onClick={() => editor.setMode("rotate")} hint="E">
        Rotate
      </ToolButton>
      <ToolButton active={mode === "scale"} onClick={() => editor.setMode("scale")} hint="R">
        Scale
      </ToolButton>
      <Divider />
      <ToolButton active={snap} onClick={() => editor.toggleSnap()} hint="S">
        Snap
      </ToolButton>
      <Divider />
      <ToolButton disabled={!canUndo} onClick={() => editor.undo()} hint="⌘Z">
        Undo
      </ToolButton>
      <ToolButton disabled={!canRedo} onClick={() => editor.redo()} hint="⇧⌘Z">
        Redo
      </ToolButton>
      <Divider />
      <select
        value=""
        onChange={(e) => {
          const kind = e.target.value as FixtureKind | "";
          if (kind) editor.add(kind);
        }}
        className="h-8 cursor-pointer border border-hairline bg-ink/70 px-2 font-mono text-[11px] uppercase tracking-[0.14em] text-bone outline-none hover:border-muted"
        aria-label="Add fixture"
      >
        <option value="">+ Add fixture</option>
        {FIXTURE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {KIND_LABELS[kind]}
          </option>
        ))}
      </select>
      <ToolButton onClick={() => editor.resetLayout()} tone="danger">
        Reset layout
      </ToolButton>
    </div>
  );
}
