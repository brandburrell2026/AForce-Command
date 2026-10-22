import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { radToDeg, snapTo } from "@/editor/geometry";
import { editor, useEditor } from "@/editor/store";
import { formatFeet } from "@/scene/units";

import { Mono, Panel, PanelHeader } from "./ui";

const MARGIN = 2.4; // feet of breathing room around the floor in the plan

interface PlanDrag {
  id: string;
  pointerId: number;
  startX: number;
  startZ: number;
  originX: number;
  originZ: number;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/**
 * Top-down floor plan drawn straight from the scene document. Plan x is
 * world x; plan y is world z, so the open front sits at the bottom. Click
 * selects, drag moves (snapped to 6 in when snap is on), and the 3D view
 * follows live.
 */
export function FloorPlan() {
  const doc = useEditor((s) => s.doc);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const snap = useEditor((s) => s.snap);
  const [open, setOpen] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<PlanDrag | null>(null);

  const { width: W, depth: D } = doc.floor;
  const vbW = W + MARGIN * 2;
  const vbH = D + MARGIN * 2;

  const toPlan = (e: ReactPointerEvent<Element>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / vbW, r.height / vbH);
    const ox = (r.width - vbW * scale) / 2;
    const oy = (r.height - vbH * scale) / 2;
    return {
      x: (e.clientX - r.left - ox) / scale - vbW / 2,
      z: (e.clientY - r.top - oy) / scale - vbH / 2,
    };
  };

  const onFixtureDown = (e: ReactPointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    editor.select(id);
    const fixture = doc.fixtures.find((f) => f.id === id);
    if (!fixture) return;
    const p = toPlan(e);
    drag.current = {
      id,
      pointerId: e.pointerId,
      startX: p.x,
      startZ: p.z,
      originX: fixture.position[0],
      originZ: fixture.position[2],
    };
    svgRef.current?.setPointerCapture(e.pointerId);
    editor.beginEdit();
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toPlan(e);
    let x = d.originX + (p.x - d.startX);
    let z = d.originZ + (p.z - d.startZ);
    if (snap) {
      x = snapTo(x, 0.5);
      z = snapTo(z, 0.5);
    }
    editor.updateLive(d.id, { position: [x, 0, z] });
  };

  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    svgRef.current?.releasePointerCapture(d.pointerId);
    drag.current = null;
    editor.endEdit();
  };

  const gridX = range(-W / 2, W / 2, 1);
  const gridZ = range(-D / 2, D / 2, 1);

  return (
    <Panel className="w-[320px]">
      <PanelHeader
        right={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim hover:text-bone"
          >
            {open ? "Hide" : "Show"}
          </button>
        }
      >
        Floor plan · 1 ft grid
      </PanelHeader>
      {open ? (
        <svg
          ref={svgRef}
          viewBox={`${-vbW / 2} ${-vbH / 2} ${vbW} ${vbH}`}
          className="block aspect-square w-full touch-none select-none"
          onPointerDown={() => editor.select(null)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* Floor */}
          <rect x={-W / 2} y={-D / 2} width={W} height={D} fill="#0D0D0D" />
          {gridX.map((x) => (
            <line
              key={`x${x}`}
              x1={x}
              y1={-D / 2}
              x2={x}
              y2={D / 2}
              stroke={x % 5 === 0 ? "#3a3632" : "#242120"}
              strokeWidth={x % 5 === 0 ? 0.06 : 0.03}
            />
          ))}
          {gridZ.map((z) => (
            <line
              key={`z${z}`}
              x1={-W / 2}
              y1={z}
              x2={W / 2}
              y2={z}
              stroke={z % 5 === 0 ? "#3a3632" : "#242120"}
              strokeWidth={z % 5 === 0 ? 0.06 : 0.03}
            />
          ))}
          <rect x={-W / 2} y={-D / 2} width={W} height={D} fill="none" stroke="#C1281B" strokeWidth={0.1} />
          {/* Walls: back, left, right */}
          <rect x={-W / 2 - 0.5} y={-D / 2 - 0.5} width={W + 1} height={0.5} fill="#2D2A25" />
          <rect x={-W / 2 - 0.5} y={-D / 2} width={0.5} height={D} fill="#2D2A25" />
          <rect x={W / 2} y={-D / 2} width={0.5} height={D} fill="#2D2A25" />

          {/* Edge dimensions and the open front */}
          <text x={0} y={-D / 2 - 1.1} textAnchor="middle" fontSize={0.75} fill="#A19C91" fontFamily="var(--font-mono)">
            {formatFeet(W)}
          </text>
          <text
            x={-W / 2 - 1.1}
            y={0}
            textAnchor="middle"
            fontSize={0.75}
            fill="#A19C91"
            fontFamily="var(--font-mono)"
            transform={`rotate(-90 ${-W / 2 - 1.1} 0)`}
          >
            {formatFeet(D)}
          </text>
          <text x={0} y={D / 2 + 1.4} textAnchor="middle" fontSize={0.65} fill="#6B6B66" fontFamily="var(--font-mono)" letterSpacing={0.12}>
            OPEN FRONT
          </text>

          {/* Fixtures */}
          {doc.fixtures.map((f, i) => {
            const deg = -radToDeg(f.rotationY);
            const selected = f.id === selectedId;
            const hovered = f.id === hoveredId;
            const stroke = selected ? "#C1281B" : hovered ? "#EDEAE3" : "#A19C91";
            const { width, depth } = f.footprint;
            return (
              <g
                key={f.id}
                transform={`translate(${f.position[0]} ${f.position[2]}) rotate(${deg})`}
                style={{ cursor: "move" }}
                onPointerDown={(e) => onFixtureDown(e, f.id)}
                onPointerEnter={() => editor.hover(f.id)}
                onPointerLeave={() => editor.hover(null)}
              >
                <rect
                  x={-width / 2}
                  y={-depth / 2}
                  width={width}
                  height={depth}
                  fill={selected ? "rgba(193,40,27,0.2)" : "rgba(237,234,227,0.06)"}
                  stroke={stroke}
                  strokeWidth={selected ? 0.14 : 0.07}
                />
                {/* Front edge tick: which way the fixture faces (local +z) */}
                <line x1={-0.4} y1={depth / 2} x2={0.4} y2={depth / 2} stroke={stroke} strokeWidth={0.2} />
                <g transform={`rotate(${-deg})`}>
                  <text
                    textAnchor="middle"
                    y={width >= 4 && depth >= 3 ? -0.15 : 0.25}
                    fontSize={0.75}
                    fill={selected ? "#EDEAE3" : "#A19C91"}
                    fontFamily="var(--font-mono)"
                    fontWeight={600}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </text>
                  {width >= 4 && depth >= 3 ? (
                    <text textAnchor="middle" y={0.7} fontSize={0.55} fill="#6B6B66" fontFamily="var(--font-mono)">
                      {`${formatFeet(width)} × ${formatFeet(depth)}`}
                    </text>
                  ) : null}
                </g>
              </g>
            );
          })}
        </svg>
      ) : null}
      {open ? (
        <div className="border-t border-hairline px-3 py-1.5">
          <Mono className="text-dim">Drag to move · tick marks the front</Mono>
        </div>
      ) : null}
    </Panel>
  );
}
