export default function System() {
  const steps = [
    {
      n: "01",
      title: "The product fuels the body",
      body: "Electrolytes, minerals, and alkalinity at pH 8.8 — engineered for output, not taste.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      n: "02",
      title: "The OS reads the state",
      body: "Your body. Your environment. Your behavior. The system measures what you can't.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      n: "03",
      title: "The system tells you what to do",
      body: "Clear, immediate commands — not data, not dashboards, not guesses.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      n: "04",
      title: "You act → performance improves",
      body: "Behavior changes. Output sustains. The loop closes — and compounds with use.",
      accent: "text-text",
      ring: "ring-text/25",
      bar: "bg-text/40",
      bg: "from-text/[0.06] to-text/0",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-blue/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute top-[15vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">05 — Solution</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">05 / 24</div>
      </div>

      <div className="absolute top-[11vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw] z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-primary font-semibold">Solution · The System</span>
          </div>
          <h1 className="font-display text-[4.6vw] leading-[0.92] tracking-tighter text-balance">
            AForce is a <span className="text-primary">Performance System.</span>
          </h1>
        </div>
        <div className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <div className="text-text">Not a drink. Not an app.</div>
          <div className="mt-[0.6vh]">A system that keeps you operating at your best — every day, under any pressure.</div>
        </div>
      </div>

      <div className="absolute top-[31vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-baseline gap-[1vw] flex-wrap">
          <span className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-text/45">What shifts in your body</span>
          <span className="font-body text-[1vw] text-text/85">Hydration · Electrolytes · Minerals · Environment · Stress</span>
          <span className="font-body text-[1vw] text-text/45">— and you're expected to perform anyway.</span>
        </div>
      </div>

      <div className="absolute top-[37vh] bottom-[24vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[1.2vw] z-10">
        {steps.map((s) => (
          <div key={s.n} className={`relative rounded-2xl ring-1 ${s.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${s.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${s.bar}`} />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-display text-[2.4vw] leading-none ${s.accent}`}>{s.n}</div>
              <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text mt-[1.6vh]">{s.title}</div>
              <div className="font-body text-[0.92vw] text-text/65 mt-[1.4vh] leading-snug">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="border-t border-text/10 pt-[1.8vh] space-y-[1.6vh]">
          <div className="flex items-center justify-between gap-[2vw]">
            <div className="flex items-center gap-[1vw] font-display text-[1.7vw] tracking-tight">
              <span className="text-text">Check</span>
              <span className="text-text/35">→</span>
              <span className="text-text">Act</span>
              <span className="text-text/35">→</span>
              <span className="text-text">Perform</span>
              <span className="text-text/35">→</span>
              <span className="text-primary font-semibold">Repeat</span>
            </div>
            <div className="font-display text-[1.4vw] leading-tight tracking-tight text-right">
              <span className="text-text/55">Most products give you </span>
              <span className="text-text">energy.</span>
              <span className="text-text/55"> AForce gives you </span>
              <span className="text-primary">control.</span>
            </div>
          </div>
          <div className="font-display text-[1.7vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">You think you're </span>
            <span className="text-text">underperforming</span>
            <span className="text-text/55"> when you're actually </span>
            <span className="text-primary">under-managed.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
