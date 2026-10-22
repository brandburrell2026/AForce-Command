import { Studio } from "@/components/Studio";
import { FloorPlan } from "@/components/hud/FloorPlan";
import { Inspector } from "@/components/hud/Inspector";
import { Toolbar } from "@/components/hud/Toolbar";
import { ViewControls } from "@/components/hud/ViewControls";
import { WalkOverlay } from "@/components/hud/WalkOverlay";
import { Mono } from "@/components/hud/ui";
import { useEditorShortcuts } from "@/editor/shortcuts";
import { useEditor } from "@/editor/store";
import { formatFeet, squareFeet } from "@/scene/units";

export default function App() {
  useEditorShortcuts();
  const name = useEditor((s) => s.doc.name);
  const floor = useEditor((s) => s.doc.floor);
  const walking = useEditor((s) => s.cameraMode === "walk");

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0">
        <Studio />
      </div>

      {walking ? (
        <WalkOverlay />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-4 p-4 md:p-5">
          {/* Top rail */}
          <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-hairline pb-3">
            <div className="flex items-center gap-3">
              <span className="block h-3 w-3 bg-signal" aria-hidden />
              <div className="flex flex-col">
                <Mono>AForce Spatial Studio</Mono>
                <Mono className="text-dim">{name} · Section 04 · Materials</Mono>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Toolbar />
              <ViewControls />
            </div>
            <div className="hidden text-right 2xl:block">
              <Mono>
                Floor {formatFeet(floor.width)} × {formatFeet(floor.depth)}
              </Mono>
              <br />
              <Mono className="text-muted">{squareFeet(floor.width, floor.depth)} sq ft · open front</Mono>
            </div>
          </header>

          {/* Workspace: plan bottom-left, inspector column right */}
          <div className="flex min-h-0 flex-1 items-stretch justify-between gap-4">
            <div className="flex flex-col justify-end">
              <FloorPlan />
            </div>
            <Inspector />
          </div>

          {/* Bottom rail */}
          <footer className="flex items-end justify-between gap-6 border-t border-hairline pt-3">
            <Mono className="text-muted">
              Click to select · W E R move rotate scale · F frame · O 360° · V walk · 1–7 views · ⌫ delete
            </Mono>
            <Mono>
              Pause. Hydrate. <span className="text-signal">Lock-In.</span> Perform.
            </Mono>
          </footer>
        </div>
      )}
    </div>
  );
}
