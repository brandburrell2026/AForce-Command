import { useEffect, useState } from "react";

import { useEditor } from "@/editor/store";

import { AssetsPanel } from "./AssetsPanel";
import { AssistantPanel } from "./AssistantPanel";
import { ExportPanel } from "./ExportPanel";
import { FixtureList } from "./FixtureList";
import { PropertiesPanel } from "./PropertiesPanel";
import { StylePanel } from "./StylePanel";

type Tab = "ai" | "fixture" | "scene" | "assets" | "export";

const TAB_IDS: readonly Tab[] = ["ai", "fixture", "scene", "assets", "export"];

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "ai", label: "AI" },
  { id: "fixture", label: "Fixture" },
  { id: "scene", label: "Scene" },
  { id: "assets", label: "Assets" },
  { id: "export", label: "Export" },
];

/** Right-hand column: tabbed panels above the fixture list. */
export function Inspector() {
  const [tab, setTab] = useState<Tab>("fixture");
  const selectedId = useEditor((s) => s.selectedId);
  const request = useEditor((s) => s.inspectorTabRequest);

  // A fresh selection brings its properties forward, unless the assistant is open.
  useEffect(() => {
    if (selectedId) setTab((current) => (current === "ai" ? current : "fixture"));
  }, [selectedId]);

  // Cmd+K and other callers can ask for a tab by name.
  useEffect(() => {
    if (request && (TAB_IDS as readonly string[]).includes(request.tab)) setTab(request.tab as Tab);
  }, [request]);

  return (
    <div className="flex min-h-0 w-[320px] flex-col gap-3">
      <div className="pointer-events-auto flex border border-hairline bg-ink/85 backdrop-blur-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
              tab === t.id ? "border-signal text-bone" : "border-transparent text-dim hover:text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-[3] flex-col">
          {tab === "ai" ? (
            <AssistantPanel />
          ) : tab === "fixture" ? (
            <PropertiesPanel />
          ) : tab === "scene" ? (
            <StylePanel />
          ) : tab === "assets" ? (
            <AssetsPanel />
          ) : (
            <ExportPanel />
          )}
        </div>
        <div className="flex min-h-0 flex-[2] flex-col">
          <FixtureList />
        </div>
      </div>
    </div>
  );
}
