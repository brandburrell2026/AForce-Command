export default function Financials() {
  const revenue = [
    { year: "2026", value: 3.2, x: 140, y: 239.375 },
    { year: "2027", value: 13, x: 500, y: 162.8125 },
    { year: "2028", value: 27.8, x: 860, y: 47.1875 },
  ];
  const ebitda = [
    { year: "2026", value: -1.5, x: 140, y: 276.09 },
    { year: "2027", value: -1.2, x: 500, y: 273.75 },
    { year: "2028", value: 2.1, x: 860, y: 247.97 },
  ];

  const zeroY = 264.375;
  const breakEvenX = 630.9;

  const VB_W = 1000;
  const VB_H = 320;
  const xPct = (x: number) => (x / VB_W) * 100;
  const yPct = (y: number) => (y / VB_H) * 100;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 75% 35%, rgba(84,120,213,0.16) 0%, transparent 60%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">19 — Financial Projections</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">19 / 22</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Trajectory</span>
          </div>
          <h2 className="font-display text-[3.2vw] leading-[1] tracking-tighter whitespace-nowrap">
            <span className="text-text/55">$3.2M</span>
            <span className="text-text/35 mx-[0.6vw]">→</span>
            <span className="text-blue">$27.8M</span>
            <span className="text-text"> in 24 months.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[24vw] leading-snug pb-[0.6vh] text-right">
          Revenue compounds through national TV in Summer 2026 and crosses EBITDA breakeven late 2027.
        </p>
      </div>

      <div className="absolute top-[28vh] bottom-[24vh] left-[6vw] right-[6vw]">
        <div className="bg-bg-elev rounded-xl border border-text/10 h-full relative overflow-hidden">
          <div className="absolute top-[1.6vh] left-[1.6vw] flex gap-[1.6vw] z-10">
            <div className="flex items-center gap-[0.6vw]">
              <div className="w-[1.6vw] h-[2px] bg-blue rounded" />
              <span className="font-body uppercase tracking-[0.25em] text-[0.85vw] text-text/70">Revenue</span>
            </div>
            <div className="flex items-center gap-[0.6vw]">
              <div
                className="w-[1.6vw] h-[2px] rounded"
                style={{ background: "linear-gradient(to right, #E53341, #F5D637 50%, #5478D5)" }}
              />
              <span className="font-body uppercase tracking-[0.25em] text-[0.85vw] text-text/70">EBITDA</span>
            </div>
          </div>

          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5478D5" stopOpacity="0.45" />
                <stop offset="55%" stopColor="#5478D5" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#5478D5" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ebitGrad" x1="140" y1="0" x2="860" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E53341" />
                <stop offset="50%" stopColor="#E53341" />
                <stop offset="68%" stopColor="#F5D637" />
                <stop offset="86%" stopColor="#5478D5" />
                <stop offset="100%" stopColor="#5478D5" />
              </linearGradient>
              <radialGradient id="dotGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#5478D5" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#5478D5" stopOpacity="0" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {[5, 10, 15, 20, 25].map((v) => {
              const y = 30 + (30 - v) * 7.8125;
              return (
                <line
                  key={v}
                  x1="80"
                  y1={y}
                  x2="920"
                  y2={y}
                  stroke="#1F1F33"
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <line
              x1="80"
              y1={zeroY}
              x2="920"
              y2={zeroY}
              stroke="#3A3A55"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />

            <line
              x1={breakEvenX}
              y1="40"
              x2={breakEvenX}
              y2={zeroY}
              stroke="#F5D637"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.55"
              vectorEffect="non-scaling-stroke"
            />

            <path
              d={`M 140 239.375 C 280 239, 360 200, 500 162.8125 C 640 125, 720 80, 860 47.1875 L 860 ${zeroY} L 140 ${zeroY} Z`}
              fill="url(#revFill)"
            />

            <path
              d="M 140 239.375 C 280 239, 360 200, 500 162.8125 C 640 125, 720 80, 860 47.1875"
              stroke="#5478D5"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#glow)"
            />

            <path
              d="M 140 276.09 C 280 275, 360 274.5, 500 273.75 C 640 268, 720 258, 860 247.97"
              stroke="url(#ebitGrad)"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />

            {revenue.map((r) => (
              <g key={`rev-${r.year}`}>
                <circle cx={r.x} cy={r.y} r="14" fill="#5478D5" opacity="0.15" />
                <circle cx={r.x} cy={r.y} r="6" fill="#08080F" stroke="#5478D5" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              </g>
            ))}

            {ebitda.map((e) => (
              <circle
                key={`ebit-${e.year}`}
                cx={e.x}
                cy={e.y}
                r="4"
                fill={e.value >= 0 ? "#5478D5" : "#E53341"}
              />
            ))}

            <circle cx={breakEvenX} cy={zeroY} r="5" fill="#F5D637" />
            <circle cx={breakEvenX} cy={zeroY} r="9" fill="none" stroke="#F5D637" strokeWidth="1" opacity="0.5" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="absolute inset-0 pointer-events-none">
            {revenue.map((r) => (
              <div
                key={`rev-label-${r.year}`}
                className="absolute font-display text-[1.7vw] text-blue leading-none whitespace-nowrap"
                style={{
                  left: `${xPct(r.x)}%`,
                  top: `calc(${yPct(r.y)}% - 4vh)`,
                  transform: "translateX(-50%)",
                }}
              >
                ${r.value}M
              </div>
            ))}

            {ebitda.map((e) => (
              <div
                key={`ebit-label-${e.year}`}
                className={`absolute font-display text-[1vw] leading-none whitespace-nowrap ${e.value >= 0 ? "text-blue" : "text-primary"}`}
                style={{
                  left: `${xPct(e.x)}%`,
                  top: `calc(${yPct(e.y)}% + 1.4vh)`,
                  transform: "translateX(-50%)",
                }}
              >
                {e.value >= 0 ? "+" : ""}${e.value}M
              </div>
            ))}

            <div
              className="absolute font-body uppercase tracking-[0.28em] text-[0.85vw] text-accent"
              style={{
                left: `calc(${xPct(breakEvenX)}% + 0.6vw)`,
                top: "14%",
              }}
            >
              <div className="border-l-2 border-accent pl-[0.6vw] py-[0.2vh]">
                <div>Breakeven</div>
                <div className="text-text/60 normal-case tracking-normal text-[0.85vw] mt-[0.2vh]">Late 2027</div>
              </div>
            </div>

            {revenue.map((r) => (
              <div
                key={`year-${r.year}`}
                className="absolute font-body uppercase tracking-[0.32em] text-[1vw] text-muted"
                style={{
                  left: `${xPct(r.x)}%`,
                  bottom: "1.4vh",
                  transform: "translateX(-50%)",
                }}
              >
                {r.year}
              </div>
            ))}

            <div className="absolute right-[1.6vw] font-body text-[0.85vw] text-text/40" style={{ top: `calc(${yPct(zeroY)}% - 2vh)` }}>
              $0
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[1.4vw]">
        <div className="bg-bg-elev rounded-md p-[1.3vw] border-t-2 border-blue">
          <div className="font-display text-[2.8vw] leading-none text-blue">8.7×</div>
          <div className="font-body text-[0.95vw] text-text/65 mt-[1vh] leading-snug">Revenue growth in 24 months.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.3vw] border-t-2 border-accent">
          <div className="font-display text-[2.8vw] leading-none text-accent">Q4'27</div>
          <div className="font-body text-[0.95vw] text-text/65 mt-[1vh] leading-snug">EBITDA breakeven.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.3vw] border-t-2 border-blue">
          <div className="font-display text-[2.8vw] leading-none text-blue">62%</div>
          <div className="font-body text-[0.95vw] text-text/65 mt-[1vh] leading-snug">Gross margin by 2028.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.3vw] border-t-2 border-blue">
          <div className="font-display text-[2.8vw] leading-none text-blue">42%</div>
          <div className="font-body text-[0.95vw] text-text/65 mt-[1vh] leading-snug">Contribution margin by 2028.</div>
        </div>
      </div>
    </div>
  );
}
