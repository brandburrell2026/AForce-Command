import type { ReactNode } from "react";

import { Studio } from "@/components/Studio";
import { ACTIVATION_20x20 } from "@/scene/model";
import { formatFeet, formatFootprint, squareFeet } from "@/scene/units";

const doc = ACTIVATION_20x20;

function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${className}`}>
      {children}
    </span>
  );
}

export default function App() {
  const { width, depth } = doc.floor;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-bone">
      <div className="absolute inset-0">
        <Studio doc={doc} />
      </div>

      {/* HUD. Static in section 1; becomes the editor chrome in section 2. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 md:p-6">
        {/* Top rail */}
        <header className="flex items-start justify-between gap-6 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <span className="block h-3 w-3 bg-signal" aria-hidden />
            <Mono>AForce Spatial Studio</Mono>
          </div>
          <div className="hidden text-center md:block">
            <div className="font-display text-[15px] uppercase tracking-[0.04em]">{doc.name}</div>
            <Mono className="text-muted">Section 01 · Static scene</Mono>
          </div>
          <div className="text-right">
            <Mono>
              Floor {formatFeet(width)} × {formatFeet(depth)}
            </Mono>
            <br />
            <Mono className="text-muted">{squareFeet(width, depth)} sq ft · open front</Mono>
          </div>
        </header>

        {/* Bottom rail */}
        <footer className="flex items-end justify-between gap-6 border-t border-hairline pt-4">
          <ol className="m-0 grid list-none gap-y-1 p-0 md:grid-cols-2 md:gap-x-10">
            {doc.fixtures.map((f, i) => (
              <li key={f.id} className="flex items-baseline gap-3">
                <Mono className="text-signal">{String(i + 1).padStart(2, "0")}</Mono>
                <Mono>{f.label}</Mono>
                <Mono className="hidden text-dim lg:inline">
                  {formatFootprint(f.footprint.width, f.footprint.depth, f.footprint.height)}
                </Mono>
              </li>
            ))}
          </ol>
          <div className="text-right">
            <Mono className="text-muted">Drag to orbit · Scroll to zoom · Shift+drag to pan</Mono>
            <br />
            <Mono>
              Pause. Hydrate. <span className="text-signal">Lock-In.</span> Perform.
            </Mono>
          </div>
        </footer>
      </div>
    </div>
  );
}
