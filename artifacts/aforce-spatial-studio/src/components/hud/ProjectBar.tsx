import { useEffect, useState } from "react";

import { saveProject } from "@/editor/projects";
import { editor, useEditor } from "@/editor/store";

import { formatAgo } from "./time";
import { Mono, ToolButton } from "./ui";

/** Project name, save state and the two project buttons, in the top rail. */
export function ProjectBar() {
  const name = useEditor((s) => s.doc.name);
  const projectId = useEditor((s) => s.projectId);
  const dirty = useEditor((s) => s.doc !== s.lastSavedDoc);
  const saving = useEditor((s) => s.saving);
  const saveError = useEditor((s) => s.saveError);
  const savedAt = useEditor((s) => s.savedAt);
  const autosave = useEditor((s) => s.autosave);

  // Re-render every half minute so "saved 3 min ago" stays honest.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  let status: string;
  let tone = "text-dim";
  if (saving) {
    status = "Saving…";
  } else if (saveError) {
    status = `Save failed · ${saveError}`;
    tone = "text-signal";
  } else if (!projectId) {
    status = "Not saved · ⌘S";
    tone = "text-muted";
  } else if (dirty) {
    status = autosave ? "Autosave pending…" : "Unsaved changes · ⌘S";
    tone = "text-muted";
  } else {
    status = `Saved ${savedAt ? formatAgo(savedAt) : ""}${autosave ? " · autosave on" : ""}`;
  }

  return (
    <div className="pointer-events-auto flex items-center gap-3">
      <button
        type="button"
        onClick={() => editor.setProjectsOpen(true)}
        title="Projects (⌘O)"
        className="flex flex-col items-start text-left"
      >
        <Mono className="text-bone hover:text-signal">{name}</Mono>
        <Mono className={tone}>{status}</Mono>
      </button>
      <ToolButton onClick={() => void saveProject()} hint="⌘S" disabled={saving}>
        Save
      </ToolButton>
      <ToolButton onClick={() => editor.setProjectsOpen(true)} hint="⌘O">
        Projects
      </ToolButton>
    </div>
  );
}
