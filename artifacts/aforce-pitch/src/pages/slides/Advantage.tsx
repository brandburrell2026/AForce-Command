export default function Advantage() {
  const pillars = [
    {
      moat: "Product Moat",
      num: "01",
      title: "Premium Formulation",
      body: "Premium formulation with alkaline minerals and sea-derived functionals for performance, recovery, and longevity.",
      defense: "Years of formulation IP. Not a SKU swap.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      moat: "Distribution Moat",
      num: "02",
      title: "Multi-Format Ecosystem",
      body: "Multi-format ecosystem across cans, sticks, subscriptions, and retail — every occasion, one brand.",
      defense: "Compounds usage occasions and basket size.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      moat: "Data Moat",
      num: "03",
      title: "Closed-Loop Data",
      body: "Closed-loop behavior and performance data. Every signal sharpens the next recommendation — the model gets smarter every day.",
      defense: "First-mover compounding. Not catchable by SKUs.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      moat: "Software Moat",
      num: "04",
      title: "AForce OS",
      body: "AForce OS turns product usage into daily performance intelligence — tracking, learning, and optimizing behavior across the system.",
      defense: "No CPG brand has built this. No SaaS brand has the can.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/70",
      bg: "from-text/[0.08] to-text/0",
    },
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 30% 25% at 60% 50%, rgba(245,214,55,0.06) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">13 — Competitive Advantage</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 23</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Structural Advantage</span>
          </div>
          <h2 className="font-display text-[5.4vw] leading-[0.92] tracking-tighter">
            System is <span className="text-blue">the moat.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">CPG is copied. Systems compound.</span> Four reinforcing moats no competitor has assembled — fused into one operating system.
        </p>
      </div>

      <div className="absolute top-[36vh] bottom-[18vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-x-[0.9vw]">
        {pillars.map((p) => (
          <div
            key={p.num}
            className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />

            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.78vw] font-semibold ${p.accent}`}>{p.moat}</div>

              <div className="flex items-baseline gap-[0.7vw] mt-[1.6vh]">
                <div className={`font-display text-[2.6vw] leading-none tracking-tight ${p.accent}`}>{p.num}</div>
              </div>

              <div className="font-display text-[1.55vw] leading-[1.05] tracking-tight text-text mt-[1.6vh]">{p.title}</div>

              <div className="font-body text-[0.92vw] text-text/70 leading-snug mt-[1.4vh]">{p.body}</div>

              <div className="mt-auto pt-[1.6vh] border-t border-text/10">
                <div className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/45 font-semibold mb-[0.6vh]">Why it can't be copied</div>
                <div className={`font-body text-[0.85vw] leading-snug ${p.accent}`}>{p.defense}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-blue" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-blue font-semibold">Asymmetric to the Field</div>
          </div>
          <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Others sell </span>
            <span className="text-text">products.</span>
            <span className="text-text/55"> AForce builds </span>
            <span className="text-blue">performance infrastructure.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
