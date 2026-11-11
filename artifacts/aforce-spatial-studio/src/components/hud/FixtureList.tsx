import { editor, useEditor } from "@/editor/store";
import { formatFeet } from "@/scene/units";

import { Mono, Panel, PanelHeader } from "./ui";

export function FixtureList() {
  const fixtures = useEditor((s) => s.doc.fixtures);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader right={<Mono className="text-dim">{fixtures.length}</Mono>}>Fixtures</PanelHeader>
      <ol className="m-0 min-h-0 list-none overflow-y-auto p-1">
        {fixtures.map((f, i) => {
          const selected = f.id === selectedId;
          const hovered = f.id === hoveredId;
          const bg = selected ? "bg-signal/15" : hovered ? "bg-bone/5" : "";
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => editor.select(f.id)}
                onMouseEnter={() => editor.hover(f.id)}
                onMouseLeave={() => editor.hover(null)}
                className={`flex w-full items-baseline gap-3 px-2 py-1.5 text-left transition-colors ${bg}`}
              >
                <Mono className={selected ? "text-signal" : "text-muted"}>
                  {String(i + 1).padStart(2, "0")}
                </Mono>
                <Mono className="flex-1 truncate">{f.label}</Mono>
                <Mono className="text-dim">
                  {formatFeet(f.footprint.width)} × {formatFeet(f.footprint.depth)}
                </Mono>
              </button>
            </li>
          );
        })}
        {fixtures.length === 0 ? (
          <li className="px-2 py-3">
            <Mono className="text-dim">Empty floor. Add a fixture from the toolbar.</Mono>
          </li>
        ) : null}
      </ol>
    </Panel>
  );
}
