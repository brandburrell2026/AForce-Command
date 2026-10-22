import { useEffect, useState } from "react";

import { useEditor } from "@/editor/store";

import { AssetsPanel } from "./AssetsPanel";
import { FixtureList } from "./FixtureList";
import { PropertiesPanel } from "./PropertiesPanel";
import { StylePanel } from "./StylePanel";

type Tab = "fixture" | "scene" | "assets";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "fixture", label: "Fixture" },
  { id: "scene", label: "Scene" },
  { id: "assets", label: "Assets" },
];

/** Right-hand column: tabbed panels above the fixture list. */
export function Inspector() {
  const [tab, setTab] = useState<Tab>("fixture");
  const selectedId = useEditor((s) => s.selectedId);

  // A fresh selection brings its properties forward.
  useEffect(() => {
    if (selectedId) setTab("fixture");
  }, [selectedId]);

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
          {tab === "fixture" ? <PropertiesPanel /> : tab === "scene" ? <StylePanel /> : <AssetsPanel />}
        </div>
        <div className="flex min-h-0 flex-[2] flex-col">
          <FixtureList />
        </div>
      </div>
    </div>
  );
}
