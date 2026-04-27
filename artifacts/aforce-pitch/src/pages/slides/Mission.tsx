export default function Mission() {
  const tenets = [
    {
      not: "flavor first",
      but: "Built for pressure.",
      body: "Clean hydration designed for output — formulated for the body that has work to do.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      not: "sugar from a lab",
      but: "Engineered for consistency.",
      body: "Minerals and functionals that support the body when demand rises — no compromises, no marketing additives.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      not: "built to coast",
      but: "Designed to deliver under stress.",
      body: "Daily fuel for long days, training, travel, heat, and pressure — performance that compounds with use.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 22% 30%, rgba(245,214,55,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 80% 75%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">02 — Mission</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">02 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Mission</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter">
            Performance, <span className="text-accent">when it matters.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">For people who cannot afford to be off</span> — judged by how they perform, not by what they say.
        </p>
      </div>

      <div className="absolute top-[40vh] bottom-[18vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.6vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">What We Build · What We Don't</div>
        </div>
        <div className="grid grid-cols-3 gap-x-[1vw] h-[calc(100%-3.8vh)]">
          {tenets.map((t) => (
            <div key={t.but} className={`relative rounded-2xl ring-1 ${t.ring} bg-bg-elev/40 overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-b ${t.bg} pointer-events-none`} />
              <div className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
              <div className="relative p-[1.4vw] flex flex-col h-full">
                <div className="font-body text-[0.92vw] text-text/45 leading-snug">
                  Not <span className="text-text/65">{t.not}.</span>
                </div>
                <div className={`font-display text-[1.95vw] leading-tight tracking-tight mt-[1.2vh] ${t.accent}`}>{t.but}</div>
                <div className="font-body text-[0.95vw] text-text/65 mt-[1.6vh] leading-snug">{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Who We're For</div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">For people who treat performance as a </span>
            <span className="text-text">standard</span>
            <span className="text-text/55">, not a </span>
            <span className="text-accent">goal.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
