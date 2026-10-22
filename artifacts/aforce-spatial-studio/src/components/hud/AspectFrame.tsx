import { useEffect, useState } from "react";

import { useEditor } from "@/editor/store";

import { Mono } from "./ui";

function ratioLabel(w: number, h: number): string {
  const r = w / h;
  const known: Array<[number, string]> = [
    [16 / 9, "16:9"],
    [3 / 2, "3:2"],
    [4 / 3, "4:3"],
    [1, "1:1"],
    [4 / 5, "4:5"],
    [9 / 16, "9:16"],
  ];
  for (const [value, label] of known) if (Math.abs(r - value) < 0.01) return label;
  return r.toFixed(2);
}

/**
 * Letterbox mask over the viewport showing exactly what a render at the
 * chosen size will contain. Renders use the same camera with the target
 * aspect, so the crop is centered on the current view.
 */
export function AspectFrame() {
  const settings = useEditor((s) => s.renderSettings);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const target = settings.width / settings.height;
  const current = viewport.w / viewport.h;
  let barX = 0;
  let barY = 0;
  if (target > current) {
    // Render is wider: the top and bottom of the viewport fall outside.
    const frameH = viewport.w / target;
    barY = (viewport.h - frameH) / 2;
  } else {
    const frameW = viewport.h * target;
    barX = (viewport.w - frameW) / 2;
  }

  const bar = "absolute bg-ink/70";
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <div className={bar} style={{ left: 0, top: 0, right: 0, height: barY }} />
      <div className={bar} style={{ left: 0, bottom: 0, right: 0, height: barY }} />
      <div className={bar} style={{ left: 0, top: barY, bottom: barY, width: barX }} />
      <div className={bar} style={{ right: 0, top: barY, bottom: barY, width: barX }} />
      <div
        className="absolute border border-bone/40"
        style={{ left: barX, right: barX, top: barY, bottom: barY }}
      />
      <div className="absolute" style={{ left: barX + 12, top: barY + 10 }}>
        <Mono className="text-bone/80">
          Render frame · {settings.width} × {settings.height} · {ratioLabel(settings.width, settings.height)}
        </Mono>
      </div>
    </div>
  );
}
