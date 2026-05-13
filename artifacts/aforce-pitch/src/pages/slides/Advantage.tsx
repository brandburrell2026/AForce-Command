export default function Advantage() {
  const pillars = [
    {
      moat: "Product",
      num: "01",
      title: "Premium Formulation",
      body: "Alkaline minerals + sea-derived functionals for performance, recovery, and longevity.",
      defenseLabel: "Time to replicate",
      defense: "3+ years R&D · proprietary alkaline + dulse blend.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      moat: "Distribution",
      num: "02",
      title: "Multi-Format Ecosystem",
      body: "Cans, sticks, subscriptions, retail — every occasion, one brand.",
      defenseLabel: "Time to replicate",
      defense: "5 SKU formats · ~18mo to assemble, 36+mo to scale.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      moat: "Data",
      num: "03",
      title: "Closed-Loop Data",
      body: "Every signal sharpens the next recommendation. The model gets smarter every day.",
      defenseLabel: "Time to replicate",
      defense: "Day-1 collection · our 1K-user month = competitor's Y1 floor.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      moat: "Software",
      num: "04",
      title: "AForce OS",
      body: "Patent-pending intelligence layer. Tracks, learns, and optimizes behavior across the system.",
      defenseLabel: "Time to replicate",
      defense: "5,000+ engineering hours · no CPG has built it, no SaaS has the can.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/70",
      bg: "from-text/[0.08] to-text/0",
    },
    {
      moat: "Switching Cost",
      num: "05",
      title: "Personalized Lock-In",
      body: "90 days of behavior = a tuned protocol no competitor can match. Leaving means starting over at zero.",
      defenseLabel: "Cannot be bought",
      defense: "Built on user lifetime, not capital. Compounds with every cycle.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
  ];

  const loop = [
    { label: "Drink", sub: "Premium fuel" },
    { label: "Sense", sub: "Behavior + signals" },
    { label: "Score", sub: "OS reads state" },
    { label: "Coach", sub: "AI intervention" },
    { label: "Compound", sub: "Smarter daily" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 18% 30%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 85% 75%, rgba(84,120,213,0.16) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">14 — Competitive Advantage</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">14 / 22</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[4vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-blue font-semibold">Structural Advantage</span>
          </div>
          <h2 className="font-display text-[4.6vw] leading-[0.92] tracking-tighter">
            System is <span className="text-blue">the moat.</span>
          </h2>
        </div>
        <div className="flex flex-col items-end gap-[1vh] max-w-[28vw]">
          <p className="font-body text-[0.95vw] text-text/65 leading-snug text-right">
            <span className="text-text">CPG is copied. Systems compound.</span> Five reinforcing moats no competitor has assembled — fused into one operating system.
          </p>
          <div className="inline-flex items-center gap-[0.7vw] px-[1vw] py-[0.6vh] rounded-full border border-primary/40 bg-primary/[0.08]">
            <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-primary font-semibold">Patent-Protected</span>
            <span className="w-[1px] h-[1.4vh] bg-primary/30" />
            <span className="font-body text-[0.65vw] text-text/70">U.S. Prov. <span className="text-text font-semibold">64/057,695</span></span>
          </div>
        </div>
      </div>

      {/* 5 pillars */}
      <div className="absolute top-[31vh] left-[6vw] right-[6vw] grid grid-cols-5 gap-x-[0.7vw]" style={{ height: "36vh" }}>
        {pillars.map((p) => (
          <div
            key={p.num}
            className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />

            <div className="relative p-[1vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.65vw] font-semibold ${p.accent}`}>{p.moat}</div>

              <div className={`font-display text-[2vw] leading-none tracking-tight mt-[1vh] ${p.accent}`}>{p.num}</div>

              <div className="font-display text-[1.2vw] leading-[1.05] tracking-tight text-text mt-[1.2vh]">{p.title}</div>

              <div className="font-body text-[0.78vw] text-text/70 leading-snug mt-[1vh]">{p.body}</div>

              <div className="mt-auto pt-[1vh] border-t border-text/10">
                <div className="font-body uppercase tracking-[0.22em] text-[0.55vw] text-text/45 font-semibold mb-[0.4vh]">{p.defenseLabel}</div>
                <div className={`font-body text-[0.72vw] leading-snug ${p.accent}`}>{p.defense}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flywheel band */}
      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.6vh]">
          <div className="flex items-center justify-between mb-[1.4vh]">
            <div className="flex items-center gap-[1vw]">
              <div className="h-px w-[2.5vw] bg-blue" />
              <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold">The Compounding Loop</div>
            </div>
            <div className="font-display text-[1.05vw] tracking-tight text-text/85">
              Others sell <span className="text-text font-semibold">products.</span> AForce builds <span className="text-blue font-semibold">performance infrastructure.</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-[1.6vw] items-center">
            {/* Loop nodes */}
            <div className="relative flex items-center justify-between">
              {loop.map((n, i) => (
                <div key={i} className="flex items-center gap-[0.8vw] flex-1">
                  <div className="flex flex-col items-center gap-[0.4vh]">
                    <div className="w-[2.4vw] h-[2.4vw] rounded-full bg-bg-elev border border-blue/40 flex items-center justify-center">
                      <span className="font-display text-[0.95vw] text-blue">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="font-body uppercase tracking-[0.18em] text-[0.7vw] text-text font-semibold">{n.label}</div>
                    <div className="font-body text-[0.62vw] text-text/45 leading-tight whitespace-nowrap">{n.sub}</div>
                  </div>
                  {i < loop.length - 1 && (
                    <div className="flex-1 flex items-center justify-center -mt-[2vh]">
                      <div className="h-px flex-1 bg-blue/30" />
                      <span className="text-blue/50 text-[0.85vw] -ml-[0.2vw]">▶</span>
                    </div>
                  )}
                </div>
              ))}
              {/* Return loop arrow under the row */}
              <div className="absolute left-[2vw] right-[2vw] -bottom-[1.6vh] flex items-center pointer-events-none">
                <span className="text-primary/60 text-[0.85vw]">◀</span>
                <div className="flex-1 h-px border-t border-dashed border-primary/30" />
                <span className="font-body uppercase tracking-[0.32em] text-[0.6vw] text-primary/70 px-[0.6vw]">Compounds daily</span>
                <div className="flex-1 h-px border-t border-dashed border-primary/30" />
              </div>
            </div>

            {/* Switching cost callout */}
            <div className="rounded-md border border-primary/45 bg-primary/[0.08] px-[1.2vw] py-[1vh] max-w-[20vw]">
              <div className="font-body uppercase tracking-[0.26em] text-[0.6vw] text-primary font-semibold mb-[0.4vh]">Switching Cost</div>
              <div className="font-display text-[0.95vw] leading-tight text-text">
                90 days = <span className="text-primary">87 personalized data points.</span> Leaving means starting over.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
