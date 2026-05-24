import React, { useMemo } from "react";

export function Ecosystem() {
  const nodes = useMemo(() => [
    { num: "01", name: "Product", desc: "Cellular performance, packaged." },
    { num: "02", name: "Ritual", desc: "The 5:15 AM standard." },
    { num: "03", name: "Reinforcement", desc: "AI coach learns the user." },
    { num: "04", name: "Accountability", desc: "Circles witness the streak." },
    { num: "05", name: "Subscription", desc: "Commitment, monthly." },
    { num: "06", name: "Retention", desc: "The protocol becomes identity." },
    { num: "07", name: "Community", desc: "Territory expands. Loop closes." },
  ], []);

  const cx = 800;
  const cy = 450;
  const r = 260;

  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter'] flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />

      {/* Frame Chrome */}
      <div className="absolute top-[80px] left-[80px] flex items-center gap-4 opacity-100">
        <span className="text-[10px] tracking-[0.2em] text-white/35 uppercase">
          T H E&nbsp;&nbsp;A F O R C E&nbsp;&nbsp;F L Y W H E E L
        </span>
        <div className="w-[80px] h-[1px] bg-white/15" />
      </div>

      <div className="absolute top-[80px] right-[80px]">
        <span className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
          FIG. 03 · BEHAVIORAL ECOSYSTEM
        </span>
      </div>

      <div className="absolute bottom-[80px] left-1/2 -translate-x-1/2">
        <span className="text-[14px] text-white/55 font-['Playfair_Display'] italic tracking-wide">
          Product does not retain users. Ritual does.
        </span>
      </div>

      {/* Hero Typographic Core */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center z-10 pointer-events-none">
        <span className="text-[10px] tracking-[0.3em] text-white/35 uppercase mb-3 block">
          T H E&nbsp;&nbsp;L O O P
        </span>
        <h1 className="text-[36px] font-light text-white/90 tracking-tight">
          Compounding by design.
        </h1>
      </div>

      {/* SVG Diagram Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          {/* Arrowhead marker */}
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="6"
            refY="3"
            orient="auto"
            fill="rgba(255,255,255,0.4)"
          >
            <path d="M0,0 L6,3 L0,6" />
          </marker>

          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbit Circle */}
        <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
        
        {/* Invisible path for the red dot to travel along, starting just after Product and ending at Product */}
        <path id="orbitPath" d={`M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.1} ${cy - r}`} fill="none" stroke="none" />

        {/* Animated Red Dot */}
        <circle r="2.5" fill="#E25C5C" filter="url(#glow)">
          <animateMotion dur="24s" repeatCount="indefinite">
            <mpath href="#orbitPath" />
          </animateMotion>
        </circle>

        {/* Nodes and Links */}
        {nodes.map((node, i) => {
          const angleDeg = -90 + (i * 360) / 7;
          const angleRad = (angleDeg * Math.PI) / 180;
          
          const x = cx + r * Math.cos(angleRad);
          const y = cy + r * Math.sin(angleRad);

          return (
            <g key={node.name}>
              {/* Node Mark */}
              <circle cx={x} cy={y} r="5" fill="#000" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
              <circle cx={x} cy={y} r="1.5" fill="rgba(255,255,255,0.9)" />
            </g>
          );
        })}

        {/* Closing the loop arrow (between community and product) */}
        {(() => {
          // Angle midway between Community (-90 + 6*51.4 = 218.5) and Product (-90 = 270)
          // Let's place an arrow exactly at 255 deg
          const arrowAngle = (250 * Math.PI) / 180;
          const ax = cx + r * Math.cos(arrowAngle);
          const ay = cy + r * Math.sin(arrowAngle);
          // Tangent direction = arrowAngle + 90 deg = 340 deg
          const rot = 250 + 90;
          return (
            <g transform={`translate(${ax}, ${ay}) rotate(${rot})`}>
              <path d="M -4 -4 L 2 0 L -4 4" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            </g>
          );
        })()}
      </svg>

      {/* HTML Text Labels (for crisp font rendering) */}
      {nodes.map((node, i) => {
        const angleDeg = -90 + (i * 360) / 7;
        const angleRad = (angleDeg * Math.PI) / 180;
        
        // Offset text slightly further out
        const textOffset = r + 40;
        const tx = cx + textOffset * Math.cos(angleRad);
        const ty = cy + textOffset * Math.sin(angleRad);

        // Determine text alignment based on position
        let textAlign: "left" | "right" | "center" = "center";
        let justify = "center";
        let originX = "-50%";
        let originY = "-50%";
        let flexAlign = "items-center";

        if (angleDeg > -80 && angleDeg < 80) {
          textAlign = "left";
          justify = "start";
          originX = "0%";
          flexAlign = "items-start";
        } else if (angleDeg > 100 && angleDeg < 260) {
          textAlign = "right";
          justify = "end";
          originX = "-100%";
          flexAlign = "items-end";
        } else {
          textAlign = "center";
          justify = "center";
          originX = "-50%";
          flexAlign = "items-center";
          if (angleDeg > 0) {
            originY = "0%"; // bottom
          } else {
            originY = "-100%"; // top
          }
        }

        return (
          <div
            key={node.name}
            className={`absolute flex flex-col ${flexAlign}`}
            style={{
              left: tx,
              top: ty,
              transform: `translate(${originX}, ${originY})`,
              width: 200,
              textAlign,
            }}
          >
            <span className="text-[9px] tracking-[0.15em] text-white/30 font-mono mb-1">
              {node.num}
            </span>
            <span className="text-[20px] font-medium text-white/95 mb-0.5 tracking-tight">
              {node.name}
            </span>
            <span className="text-[12px] text-white/45 leading-snug">
              {node.desc}
            </span>
          </div>
        );
      })}
    </div>
  );
}
