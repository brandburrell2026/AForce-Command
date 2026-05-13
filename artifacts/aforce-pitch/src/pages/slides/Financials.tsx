export default function Financials() {
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

  const assumptions = [
    { label: "Year 1 customers", value: "~10,000", note: "60K orders ÷ 5.7× repeat" },
    { label: "Year 2 customers", value: "~35,000", note: "3.5× growth + national retail" },
    { label: "Year 3 customers", value: "~75,000", note: "2.1× growth + Whole Foods / Sprouts" },
    { label: "AOV", value: "$52", note: "Benchmarked vs Liquid IV ($48) / LMNT ($55)" },
    { label: "Repeat rate", value: "5–7× / yr", note: "Conservative vs Liquid IV (6–8×)" },
    { label: "Gross margin", value: "62–65%", note: "Co-packer locked · $1.85–$2.40 COGS/unit" },
    { label: "Blended CAC", value: "~$49", note: "DTC + paid social + creator · scales down" },
    { label: "Retail doors", value: "2,500", note: "By EOY2 · NYC/LA/Miami → national mo 18" },
  ];

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

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">19 — Financial Projections</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">19 / 22</div>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1 max-w-[58vw]">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.05vw] text-blue font-semibold">Projections · 2026 — 2028 · Assumptions Disclosed</span>
          </div>
          <h2 className="font-display text-[3.6vw] leading-[0.95] tracking-tighter text-balance">
            Scaling a <span className="text-blue">performance system.</span>
          </h2>
        </div>
        <p className="font-body text-[0.95vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">8.7× revenue growth 2026 → 2028.</span> Q4 2027 breakeven · 62% GM '28 · 42% contribution margin '28.
        </p>
      </div>

      {/* Chart — top half */}
      <div className="absolute top-[26vh] h-[36vh] left-[6vw] right-[6vw]">
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
                className="absolute font-body text-[0.7vw] text-text/35"
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

            <div className="absolute" style={{ left: `${xPct(160)}%`, top: `${yPct(82)}%` }}>
              <div className="font-display text-[3.6vw] text-blue leading-[0.85]">8.7×</div>
              <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] text-text/70 mt-[0.5vh]">Revenue Growth</div>
              <div className="font-body text-[0.75vw] text-text/45 mt-[0.2vh]">2026 → 2028</div>
            </div>

            <div
              className="absolute font-display text-[1.9vw] text-blue leading-none whitespace-nowrap"
              style={{ left: `${xPct(1180)}%`, top: `calc(${yPct(83.375)}% - 4.2vh)`, transform: "translateX(-100%)", paddingRight: "0.4vw" }}
            >
              $27.8M
            </div>
            <div
              className="absolute font-display text-[1.15vw] text-blue/85 leading-none whitespace-nowrap"
              style={{ left: `${xPct(670)}%`, top: `calc(${yPct(240.625)}% - 2.8vh)`, transform: "translateX(-50%)" }}
            >
              $13M
            </div>
            <div
              className="absolute font-display text-[1vw] text-blue/75 leading-none whitespace-nowrap"
              style={{ left: `${xPct(140)}%`, top: `calc(${yPct(344.75)}% - 2.5vh)`, paddingLeft: "0.8vw" }}
            >
              $3.2M
            </div>

            <div
              className="absolute font-body text-[0.78vw] text-primary whitespace-nowrap"
              style={{ left: `${xPct(140)}%`, top: `calc(${yPct(394.69)}% + 0.8vh)`, paddingLeft: "0.8vw" }}
            >
              −$1.5M
            </div>
            <div
              className="absolute font-body text-[0.78vw] text-blue whitespace-nowrap"
              style={{ left: `${xPct(1180)}%`, top: `calc(${yPct(356.44)}% + 0.8vh)`, transform: "translateX(-100%)", paddingRight: "0.4vw" }}
            >
              +$2.1M
            </div>

            <div
              className="absolute"
              style={{ left: `${xPct(breakEvenX)}%`, top: `${yPct(110)}%`, transform: "translateX(-50%)" }}
            >
              <div className="border-l-2 border-accent pl-[0.6vw] py-[0.3vh]">
                <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-accent">Breakeven</div>
                <div className="font-display text-[1.15vw] text-text leading-none mt-[0.4vh]">Q4 2027</div>
              </div>
            </div>

            {revenue.map((r) => (
              <div
                key={`year-${r.year}`}
                className="absolute font-body uppercase tracking-[0.34em] text-[0.85vw] text-muted"
                style={{ left: `${xPct(r.x)}%`, top: `${yPct(435)}%`, transform: "translateX(-50%)" }}
              >
                {r.year}
              </div>
            ))}

            <div className="absolute top-0 right-0 flex gap-[1.6vw]">
              <div className="flex items-center gap-[0.5vw]">
                <div className="w-[1.4vw] h-[2px] bg-blue rounded" />
                <span className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-text/55">Revenue</span>
              </div>
              <div className="flex items-center gap-[0.5vw]">
                <div className="w-[1.4vw] h-[2px] rounded" style={{ background: "linear-gradient(to right, #E53341, #F5D637 50%, #5478D5)" }} />
                <span className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-text/55">EBITDA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key assumptions grid — bottom */}
      <div className="absolute top-[64vh] bottom-[8vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-text/30" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-semibold">Key Assumptions — How We Build To These Numbers</div>
          <div className="h-px flex-1 bg-text/10" />
        </div>
        <div className="grid grid-cols-4 gap-[0.9vw] grid-rows-2 h-[calc(100%-3.6vh)]">
          {assumptions.map((a) => (
            <div key={a.label} className="bg-bg-elev/40 border border-text/10 rounded-md px-[1vw] py-[1vh] flex flex-col">
              <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] text-text/55 font-semibold">{a.label}</div>
              <div className="font-display text-[1.4vw] leading-none tracking-tight text-text mt-[0.7vh]">{a.value}</div>
              <div className="font-body text-[0.65vw] text-text/55 leading-snug mt-auto pt-[0.7vh]">{a.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-[3vh] left-[6vw] right-[6vw] flex justify-end pointer-events-none z-20">
        <div className="font-body text-[0.55vw] text-text/35 leading-snug max-w-[44vw] text-right">
          <span className="text-text/50 uppercase tracking-[0.22em] font-semibold">Forward-Looking Statements · </span>
          Management projections based on current assumptions; not guarantees of future performance. Actual results may differ materially.
        </div>
      </div>

      <div className="absolute bottom-[2vh] left-[6vw] right-[6vw] flex items-baseline justify-between gap-[2vw]">
        <div className="font-display text-[1.05vw] leading-tight tracking-tight">
          <span className="text-text/55">The product creates entry. </span>
          <span className="text-blue">The system creates compounding value.</span>
        </div>
        <div className="flex items-baseline gap-[1.8vw]">
          <div className="flex items-baseline gap-[0.5vw]">
            <span className="font-display text-[1.3vw] text-accent leading-none">Q4'27</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-text/55">Breakeven</span>
          </div>
          <div className="w-[1px] h-[1.6vh] bg-divider" />
          <div className="flex items-baseline gap-[0.5vw]">
            <span className="font-display text-[1.3vw] text-blue leading-none">62%</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-text/55">GM '28</span>
          </div>
          <div className="w-[1px] h-[1.6vh] bg-divider" />
          <div className="flex items-baseline gap-[0.5vw]">
            <span className="font-display text-[1.3vw] text-blue leading-none">42%</span>
            <span className="font-body uppercase tracking-[0.26em] text-[0.7vw] text-text/55">Contribution '28</span>
          </div>
        </div>
      </div>
    </div>
  );
}
