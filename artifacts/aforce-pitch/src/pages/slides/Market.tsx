export default function Market() {
  const phases = [
    {
      phase: "Phase 1 · Now",
      headline: "$12.4B",
      headlineLabel: "US Functional Beverage",
      body: "AForce's direct category today. Premium hydration + alkaline + sports use case. Clean-label, no-sugar segment growing 18% YoY.",
      som: "$48M",
      somMath: "~0.4% capture = 50K customers @ $52 AOV × 7×",
      source: "SPINS retail data 2024 · Grand View Research",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      phase: "Phase 2 · 2027",
      headline: "$4B+",
      headlineLabel: "Team Performance SaaS",
      body: "Coach-side software for athletic programs. Per-seat recurring SaaS. High school to professional. Clutch product addresses this market.",
      som: "$32M",
      somMath: "800 teams × $40K ACV = Phase 2 ceiling",
      source: "MarketsandMarkets sports analytics report 2024",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      phase: "Phase 3 · 2027+",
      headline: "$12B+",
      headlineLabel: "Sports Med + Readiness Risk",
      body: "Enterprise injury prevention and readiness monitoring. Guardian product. Five-figure ACV contracts with sports orgs + military.",
      som: "$60M",
      somMath: "500 orgs × $120K ACV = Phase 3 ceiling",
      source: "Deloitte sports technology outlook 2024",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 18% 30%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 50% 65%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 82% 25%, rgba(245,214,55,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">13 — Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 25</div>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-accent font-semibold">Bottoms-Up Sizing · Source-Cited</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.92] tracking-tighter">
            A real market, <span className="text-accent">sized honestly.</span>
          </h2>
        </div>
        <p className="font-body text-[0.95vw] text-text/65 max-w-[28vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">Methodology:</span> we size each market independently, not additively. Phase 1 TAM = US functional bev only. Future phases unlock team SaaS and enterprise — shown separately, not summed.
        </p>
      </div>

      {/* 3 phased cards */}
      <div className="absolute top-[28vh] bottom-[12vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.4vw]">
        {phases.map((p) => (
          <div key={p.phase} className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />

            <div className="relative p-[1.4vw] flex-1 flex flex-col">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.75vw] font-semibold ${p.accent}`}>{p.phase}</div>

              <div className={`font-display text-[4.6vw] leading-none tracking-tighter mt-[1.2vh] ${p.accent}`}>{p.headline}</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/85 mt-[0.6vh] font-semibold">{p.headlineLabel}</div>

              <div className="font-body text-[0.85vw] text-text/65 leading-snug mt-[1.4vh]">{p.body}</div>

              {/* SOM block */}
              <div className="mt-auto pt-[1.4vh]">
                <div className="rounded-md border border-text/15 bg-bg/40 p-[0.9vw]">
                  <div className="flex items-baseline justify-between gap-[0.6vw]">
                    <div className="font-body uppercase tracking-[0.22em] text-[0.62vw] text-text/55 font-semibold">SOM</div>
                    <div className={`font-display text-[1.6vw] leading-none ${p.accent}`}>{p.som}</div>
                  </div>
                  <div className="font-body text-[0.72vw] text-text/55 leading-snug mt-[0.5vh]">{p.somMath}</div>
                </div>

                <div className="font-body text-[0.62vw] text-text/40 leading-snug mt-[1vh] italic">
                  Source: {p.source}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[2vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.4vh] flex justify-between items-baseline gap-[2vw]">
          <div className="font-display text-[1.4vw] leading-[1.25] tracking-tight">
            <span className="text-text">AForce captures Phase 1 now. </span>
            <span className="text-text/55">Each phase unlocks new revenue — </span>
            <span className="text-accent">not a hockey stick from day one.</span>
          </div>
          <div className="font-body text-[0.7vw] text-text/45 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            TAM / SAM / SOM per phase · Independent sizing
          </div>
        </div>
      </div>
    </div>
  );
}
