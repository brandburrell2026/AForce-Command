import { EYE_HEIGHT, requestWalkLock } from "@/editor/camera";
import { editor, useEditor } from "@/editor/store";
import { formatFeet } from "@/scene/units";

import { Mono, ToolButton } from "./ui";

/**
 * Walk mode chrome. Unlocked: a click-to-begin card (pointer lock needs a
 * gesture). Locked: a crosshair and a one-line hint, no pointer capture.
 */
export function WalkOverlay() {
  const locked = useEditor((s) => s.walkLocked);

  if (locked) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone/80 shadow-[0_0_0_1px_rgba(13,13,13,0.8)]" />
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 border border-hairline bg-ink/80 px-3 py-1.5 backdrop-blur-sm">
          <Mono className="text-muted">W A S D walk · Shift run · Mouse look · Esc release</Mono>
        </div>
        <div className="absolute left-5 top-5 flex items-center gap-3">
          <span className="block h-3 w-3 bg-signal" aria-hidden />
          <Mono>Walkthrough</Mono>
        </div>
      </div>
    );
  }

  return (
    <div
      id="walk-overlay"
      onClick={() => requestWalkLock()}
      className="pointer-events-auto absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-ink/60"
    >
      <div className="flex w-[340px] flex-col gap-4 border border-hairline bg-ink/95 p-6 text-center">
        <Mono className="text-signal">Walkthrough</Mono>
        <p className="m-0 font-display text-[18px] uppercase tracking-[0.03em]">Click to step onto the floor</p>
        <p className="m-0 text-[12px] leading-relaxed text-muted">
          Eye height {formatFeet(EYE_HEIGHT)}. You enter at the open front. Walls, the bar, the plinth
          and the studio gear are solid; the Lock-In tunnel is open end to end.
        </p>
        <div className="flex flex-col gap-1">
          <Mono className="text-dim">W A S D or arrows · move</Mono>
          <Mono className="text-dim">Shift · run · Mouse · look</Mono>
          <Mono className="text-dim">Esc · release the mouse · Esc again · exit</Mono>
        </div>
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <ToolButton
            onClick={() => {
              editor.exitWalk();
            }}
            tone="danger"
          >
            Exit walkthrough
          </ToolButton>
        </div>
      </div>
    </div>
  );
}
