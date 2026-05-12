export default function Financials() {
  // viewBox: 1300 × 460 (matches chart container aspect)
  // Plot area: x [120, 1180], y [60, 400]
  // Y scale: -$2M → $30M across 340px (10.625 px / $1M)
  //   $30M → y=60     $20M → y=166.25
  //   $10M → y=272.5  $0   → y=378.75
  //   -$2M → y=400
  // Year x positions: 2026 → 140, 2027 → 670, 2028 → 1180

  const revenue = [
    { year: "2026", value: 3.2, x: 140, y: 344.75 },
    { year: "2027", value: 13, x: 670, y: 240.625 },
    { year: "2028", value: 27.8, x: 1180, y: 83.375 },
  ];

  const ebitda = [
    { year: "2026", value: -1.5, x: 140, y: 394.69 },
    { year: "2027", value: -1.2, x: 670, y: 391.5 },
    { year: "2028", value: 2.1, x: 1180, y: 356.44 },
  ];

  const yAxisTicks = [
    { y: 378.75, label: "$0" },
    { y: 272.5, label: "$10M" },
    { y: 166.25, label: "$20M" },
    { y: 60, label: "$30M" },
  ];

  const zeroY = 378.75;
  const breakEvenX = 855.45;

  const VB_W = 1300;
  const VB_H = 460;
  const xPct = (x: number) => (x / VB_W) * 100;
  const yPct = (y: number) => (y / VB_H) * 100;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 82% 75%, rgba(84,120,213,0.20) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 30% 25% at 60% 70%, rgba(245,214,55,0.08) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">21 — Financial Projections</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">21 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1 max-w-[58vw]">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Projections · 2026 — 2028</span>
          </div>
          <h2 className="font-display text-[4vw] leading-[0.95] tracking-tighter text-balance">
            Scaling a <span className="text-blue">performance system.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          Revenue growth driven by product velocity, repeat behavior, and software retention.
        </p>
      </div>

      <div className="absolute top-[30vh] bottom-[9vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5478D5" stopOpacity="0.55" />
                <stop offset="55%" stopColor="#5478D5" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#5478D5" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ebitGrad" x1="140" y1="0" x2="1180" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E53341" />
                <stop offset="55%" stopColor="#E53341" />
                <stop offset="69%" stopColor="#F5D637" />
                <stop offset="82%" stopColor="#5478D5" />
                <stop offset="100%" stopColor="#5478D5" />
              </linearGradient>
              <radialGradient id="moment" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#F5D637" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#F5D637" stopOpacity="0" />
              </radialGradient>
              <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {yAxisTicks.map((t) => (
              <line
                key={`grid-${t.label}`}
                x1="120"
                y1={t.y}
                x2="1180"
                y2={t.y}
                stroke={t.label === "$0" ? "#3A3A55" : "#16162A"}
                strokeWidth={t.label === "$0" ? 1 : 0.8}
                strokeDasharray={t.label === "$0" ? "4 4" : ""}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <line
              x1={breakEvenX}
              y1="100"
              x2={breakEvenX}
              y2={zeroY}
              stroke="#F5D637"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.55"
              vectorEffect="non-scaling-stroke"
            />

            <circle cx={breakEvenX} cy={zeroY} r="40" fill="url(#moment)" />

            <path
              d={`M 140 344.75 C 320 345, 460 305, 670 240.625 C 880 175, 1010 115, 1180 83.375 L 1180 ${zeroY} L 140 ${zeroY} Z`}
              fill="url(#revFill)"
            />

            <path
              d="M 140 344.75 C 320 345, 460 305, 670 240.625 C 880 175, 1010 115, 1180 83.375"
              stroke="#5478D5"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#lineGlow)"
            />

            <path
              d="M 140 394.69 C 320 394, 460 393, 670 391.5 C 880 386, 1010 372, 1180 356.44"
              stroke="url(#ebitGrad)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />

            {revenue.map((r) => (
              <g key={`rev-${r.year}`}>
                <circle cx={r.x} cy={r.y} r="14" fill="#5478D5" opacity="0.18" />
                <circle cx={r.x} cy={r.y} r="6" fill="#08080F" stroke="#5478D5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
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

            <circle cx={breakEvenX} cy={zeroY} r="7" fill="#F5D637" />
            <circle cx={breakEvenX} cy={zeroY} r="13" fill="none" stroke="#F5D637" strokeWidth="1.2" opacity="0.7" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="absolute inset-0 pointer-events-none">
            {yAxisTicks.map((t) => (
              <div
                key={`ylabel-${t.label}`}
                className="absolute font-body text-[0.85vw] text-text/35"
                style={{
                  left: `${xPct(115)}%`,
                  top: `${yPct(t.y)}%`,
                  transform: "translate(-100%, -50%)",
                  paddingRight: "0.6vw",
                }}
              >
                {t.label}
              </div>
            ))}

            <div
              className="absolute"
              style={{ left: `${xPct(160)}%`, top: `${yPct(82)}%` }}
            >
              <div className="font-display text-[4.6vw] text-blue leading-[0.85]">8.7×</div>
              <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-text/70 mt-[0.6vh]">Revenue Growth</div>
              <div className="font-body text-[0.9vw] text-text/45 mt-[0.2vh]">2026 → 2028</div>
            </div>

            <div
              className="absolute font-display text-[2.4vw] text-blue leading-none whitespace-nowrap"
              style={{
                left: `${xPct(1180)}%`,
                top: `calc(${yPct(83.375)}% - 5.2vh)`,
                transform: "translateX(-100%)",
                paddingRight: "0.4vw",
              }}
            >
              $27.8M
            </div>
            <div
              className="absolute font-display text-[1.4vw] text-blue/85 leading-none whitespace-nowrap"
              style={{
                left: `${xPct(670)}%`,
                top: `calc(${yPct(240.625)}% - 3.4vh)`,
                transform: "translateX(-50%)",
              }}
            >
              $13M
            </div>
            <div
              className="absolute font-display text-[1.2vw] text-blue/75 leading-none whitespace-nowrap"
              style={{
                left: `${xPct(140)}%`,
                top: `calc(${yPct(344.75)}% - 3vh)`,
                paddingLeft: "0.8vw",
              }}
            >
              $3.2M
            </div>

            <div
              className="absolute font-body text-[0.95vw] text-primary whitespace-nowrap"
              style={{
                left: `${xPct(140)}%`,
                top: `calc(${yPct(394.69)}% + 1vh)`,
                paddingLeft: "0.8vw",
              }}
            >
              −$1.5M
            </div>
            <div
              className="absolute font-body text-[0.95vw] text-blue whitespace-nowrap"
              style={{
                left: `${xPct(1180)}%`,
                top: `calc(${yPct(356.44)}% + 1vh)`,
                transform: "translateX(-100%)",
                paddingRight: "0.4vw",
              }}
            >
              +$2.1M
            </div>

            <div
              className="absolute"
              style={{
                left: `${xPct(breakEvenX)}%`,
                top: `${yPct(110)}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="border-l-2 border-accent pl-[0.7vw] py-[0.3vh]">
                <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-accent">Breakeven</div>
                <div className="font-display text-[1.4vw] text-text leading-none mt-[0.4vh]">Q4 2027</div>
              </div>
            </div>

            {revenue.map((r) => (
              <div
                key={`year-${r.year}`}
                className="absolute font-body uppercase tracking-[0.34em] text-[1vw] text-muted"
                style={{
                  left: `${xPct(r.x)}%`,
                  top: `${yPct(435)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {r.year}
              </div>
            ))}

            <div className="absolute top-0 right-0 flex gap-[1.6vw]">
              <div className="flex items-center gap-[0.5vw]">
                <div className="w-[1.6vw] h-[2px] bg-blue rounded" />
                <span className="font-body uppercase tracking-[0.25em] text-[0.85vw] text-text/55">Revenue</span>
              </div>
              <div className="flex items-center gap-[0.5vw]">
                <div
                  className="w-[1.6vw] h-[2px] rounded"
                  style={{ background: "linear-gradient(to right, #E53341, #F5D637 50%, #5478D5)" }}
                />
                <span className="font-body uppercase tracking-[0.25em] text-[0.85vw] text-text/55">EBITDA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-[3vh] left-[6vw] right-[6vw] flex justify-end pointer-events-none z-20">
        <div className="font-body text-[0.58vw] text-text/35 leading-snug max-w-[44vw] text-right">
          <span className="text-text/50 uppercase tracking-[0.22em] font-semibold">Forward-Looking Statements · </span>
          Management projections based on current assumptions; not guarantees of future performance. Actual results may differ materially. Informational only; not an offer to sell or solicitation to buy securities.
        </div>
      </div>

      <div className="absolute bottom-[1.8vh] left-[6vw] right-[6vw] flex items-baseline justify-between gap-[2vw]">
        <div className="font-display text-[1.2vw] leading-tight tracking-tight">
          <span className="text-text/55">The product creates entry. </span>
          <span className="text-blue">The system creates compounding value.</span>
        </div>
        <div className="flex items-baseline gap-[2.2vw]">
          <div className="flex items-baseline gap-[0.6vw]">
            <span className="font-display text-[1.6vw] text-accent leading-none">Q4'27</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.85vw] text-text/55">Breakeven</span>
          </div>
          <div className="w-[1px] h-[2vh] bg-divider" />
          <div className="flex items-baseline gap-[0.6vw]">
            <span className="font-display text-[1.6vw] text-blue leading-none">62%</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.85vw] text-text/55">Gross Margin '28</span>
          </div>
          <div className="w-[1px] h-[2vh] bg-divider" />
          <div className="flex items-baseline gap-[0.6vw]">
            <span className="font-display text-[1.6vw] text-blue leading-none">42%</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.85vw] text-text/55">Contribution Margin '28</span>
          </div>
        </div>
      </div>
    </div>
  );
}
