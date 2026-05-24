import React from "react";

export function Flywheel() {
  const cx = 1050;
  const cy = 450;
  const r = 310;

  const nodes = [
    { label: "B E H A V I O R", num: "I", angle: -90, isRed: false },
    { label: "A C C O U N T A B I L I T Y", num: "II", angle: -30, isRed: false },
    { label: "R I T U A L", num: "III", angle: 30, isRed: false },
    { label: "S U B S C R I P T I O N", num: "IV", angle: 90, isRed: false },
    { label: "C O M M U N I T Y", num: "V", angle: 150, isRed: false },
    { label: "R E T E N T I O N", num: "VI", angle: 210, isRed: true },
  ];

  const getCoords = (radius: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  return (
    <div className="relative w-[1600px] h-[900px] overflow-hidden bg-black text-white font-['Inter']">
      {/* Background radial glow */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: "radial-gradient(circle at 1050px 450px, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 60%)"
        }}
      />

      {/* SVG Canvas for Wheel */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Base nested rings */}
        <circle cx={cx} cy={cy} r={310} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={250} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={190} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* Arcs and ticks */}
        {nodes.map((node, i) => {
          const nextNode = nodes[(i + 1) % nodes.length];
          let startAng = node.angle;
          let endAng = startAng + 60;
          
          const start = getCoords(r, startAng);
          const end = getCoords(r, endAng);
          const mid = getCoords(r, startAng + 30);
          const tickEnd = getCoords(r - 6, startAng + 30);

          const isLastArc = i === 4; // Community (150) to Retention (210)
          const arcStroke = isLastArc ? "rgba(226, 92, 92, 0.4)" : "rgba(255,255,255,0.18)";

          return (
            <g key={`arc-${i}`}>
              <path
                d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
                fill="none"
                stroke={arcStroke}
                strokeWidth="1"
              />
              <line
                x1={mid.x}
                y1={mid.y}
                x2={tickEnd.x}
                y2={tickEnd.y}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1"
              />
              {isLastArc && (
                <g transform={`translate(${end.x}, ${end.y}) rotate(210)`}>
                  {/* Arrow chevron slightly before the node at the tip. 210 is pointing directly outward from center.
                      The arc comes in tangentially, so the tangent at 210 deg is 210 + 90 = 300 deg.
                      We rotate the chevron to point along the tangent. */}
                  <path 
                    d="M -15 -5 L -5 0 L -15 5" 
                    fill="none" 
                    stroke="rgba(226, 92, 92, 0.7)" 
                    strokeWidth="1.5"
                    transform="rotate(90)"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes and radial labels */}
        {nodes.map((node, i) => {
          const { x, y } = getCoords(r, node.angle);
          const labelCoords = getCoords(r + 40, node.angle); // offset for label center
          
          // Calculate text anchoring based on angle to keep text horizontal but radiating
          let textAnchor = "middle";
          let alignY = "middle";
          let dx = 0;
          let dy = 0;
          
          // Fine tuning position based on angle
          if (node.angle === -90) { // 12 o'clock
            textAnchor = "middle";
            dy = -15;
          } else if (node.angle === -30 || node.angle === 30) { // right side
            textAnchor = "start";
            dx = 15;
          } else if (node.angle === 90) { // 6 o'clock
            textAnchor = "middle";
            dy = 25;
          } else if (node.angle === 150 || node.angle === 210) { // left side
            textAnchor = "end";
            dx = -15;
          }

          return (
            <g key={`node-${i}`}>
              {node.isRed ? (
                <>
                  <circle cx={x} cy={y} r={20} fill="rgba(226, 92, 92, 0.2)" filter="blur(8px)" />
                  <circle cx={x} cy={y} r={5} fill="#E25C5C" />
                </>
              ) : (
                <circle cx={x} cy={y} r={4} fill="#FFFFFF" />
              )}
            </g>
          );
        })}
      </svg>

      {/* HTML text labels to ensure perfect font rendering */}
      {nodes.map((node, i) => {
        const labelPos = getCoords(r + 28, node.angle);
        
        let tx = "-50%";
        let ty = "-50%";
        if (node.angle === -90) { ty = "-100%"; }
        else if (node.angle === 90) { ty = "0%"; }
        else if (node.angle === -30 || node.angle === 30) { tx = "0%"; }
        else if (node.angle === 150 || node.angle === 210) { tx = "-100%"; }

        return (
          <div 
            key={`label-${i}`}
            className="absolute flex flex-col pointer-events-none"
            style={{
              left: labelPos.x,
              top: labelPos.y,
              transform: `translate(${tx}, ${ty})`,
              alignItems: node.angle === -90 || node.angle === 90 ? "center" : (node.angle === -30 || node.angle === 30 ? "flex-start" : "flex-end"),
            }}
          >
            <div className="text-[11px] text-white/95 uppercase tracking-[0.2em] whitespace-nowrap leading-none mb-1.5">
              {node.label}
            </div>
            <div className="text-[13px] text-white/45 font-['Fraunces'] italic leading-none">
              {node.num}
            </div>
          </div>
        );
      })}

      {/* Center of the wheel */}
      <div 
        className="absolute flex flex-col items-center justify-center pointer-events-none"
        style={{
          left: cx,
          top: cy,
          transform: "translate(-50%, -50%)"
        }}
      >
        <div className="text-[9px] text-white/40 tracking-[0.25em] mb-4">T H E &nbsp; A F O R C E &nbsp; L O O P</div>
        <div className="text-[28px] text-white/95 font-light mb-5">Behavior compounds.</div>
        <div className="w-[60px] h-[1px] bg-white/12 mb-5"></div>
        <div className="text-[13px] text-white/55 font-['Fraunces'] italic">"Every cycle deepens the next."</div>
      </div>

      {/* Left Column */}
      <div className="absolute left-[80px] top-[50%] -translate-y-1/2 w-[400px]">
        <div className="text-[10px] text-white/35 tracking-[0.25em] mb-6">F I G . &nbsp; 0 7 &nbsp; · &nbsp; F L Y W H E E L</div>
        <div className="text-[36px] text-white/95 font-light leading-[1.1] mb-4">Six stages.<br/>One compounding loop.</div>
        <div className="text-[16px] text-white/60 font-['Fraunces'] italic mb-10">"Each rotation increases the cost of leaving."</div>
        
        <div className="w-[80px] h-[1px] bg-white/15 mb-10"></div>
        
        <div className="flex flex-col space-y-4">
          {[
            { name: "Behavior", desc: "the single act, repeated.", isRed: false },
            { name: "Accountability", desc: "the system that notices.", isRed: false },
            { name: "Ritual", desc: "the act becomes structure.", isRed: false },
            { name: "Subscription", desc: "structure becomes commitment.", isRed: false },
            { name: "Community", desc: "commitment becomes belonging.", isRed: false },
            { name: "Retention", desc: "belonging compounds.", isRed: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className={`w-[12px] h-[1px] ${item.isRed ? "bg-[#E25C5C]/60" : "bg-white/40"}`}></div>
              <div className="text-[12px] text-white/70 font-light tracking-wide">
                <strong className="font-medium text-white/85">{item.name}</strong> — {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Right Corner */}
      <div className="absolute top-[40px] right-[40px] text-[10px] text-white/30 tracking-[0.25em]">
        I N T E R N A L &nbsp; · &nbsp; M O D E L
      </div>

      {/* Bottom Center Foot */}
      <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="w-[280px] h-[1px] bg-white/10 mb-5"></div>
        <div className="text-[11px] text-white/35 tracking-[0.25em] whitespace-nowrap">
          B E H A V I O R &nbsp; → &nbsp; A C C O U N T A B I L I T Y &nbsp; → &nbsp; R I T U A L &nbsp; → &nbsp; S U B S C R I P T I O N &nbsp; → &nbsp; C O M M U N I T Y &nbsp; → &nbsp; R E T E N T I O N
        </div>
      </div>
    </div>
  );
}

export default Flywheel;
