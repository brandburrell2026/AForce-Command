export default function Phantom() {
  const pillars = [
    {
      num: "01",
      label: "Sense",
      title: "Ambient hydration sensing",
      body: "Passive bio-signal capture — no log, no tap, no friction. The OS reads what the body is doing in real time.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      num: "02",
      label: "Close the loop",
      title: "Drink → Sense → Score → Coach",
      body: "Phantom is the missing sensor that turns the OS from inferred state into measured state. The flywheel becomes physical.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      num: "03",
      label: "Permanent moat",
      title: "Where CPG cannot follow",
      body: "Liquid IV cannot ship hardware. WHOOP cannot ship a can. Phantom is the bridge only AForce can build.",
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
        style={{ background: "radial-gradient(ellipse 70% 55% at 82% 28%, rgba(84,120,213,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 18% 75%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">15 — Phantom</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">15 / 24</div>
      </div>

      {/* Header */}
      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[4vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-blue font-semibold">Phase 2 · 2027+</span>
          </div>
          <h2 className="font-display text-[4.6vw] leading-[0.92] tracking-tighter">
            Drink today. <span className="text-blue">Sense tomorrow.</span>
          </h2>
          <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text/70 mt-[1vh]">
            Same OS.
          </div>
        </div>
        <div className="flex flex-col items-end gap-[1vh] max-w-[28vw]">
          <p className="font-body text-[0.95vw] text-text/65 leading-snug text-right">
            <span className="text-text">Phantom is the wearable AForce will build</span> once the can is on shelf and the OS has 100K daily users teaching it what to listen for.
          </p>
          <div className="inline-flex items-center gap-[0.7vw] px-[1vw] py-[0.6vh] rounded-full border border-accent/40 bg-accent/[0.08]">
            <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-accent font-semibold">Vision Slide</span>
            <span className="w-[1px] h-[1.4vh] bg-accent/30" />
            <span className="font-body text-[0.65vw] text-text/70">$0 of this round</span>
          </div>
        </div>
      </div>

      {/* 3 pillars */}
      <div className="absolute top-[40vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-x-[1.2vw]" style={{ height: "34vh" }}>
        {pillars.map((p) => (
          <div
            key={p.num}
            className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar}`} />

            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.78vw] font-semibold ${p.accent}`}>{p.label}</div>
              <div className={`font-display text-[2.6vw] leading-none tracking-tight mt-[1.2vh] ${p.accent}`}>{p.num}</div>
              <div className="font-display text-[1.6vw] leading-[1.05] tracking-tight text-text mt-[1.4vh]">{p.title}</div>
              <div className="font-body text-[0.95vw] text-text/70 leading-snug mt-[1.2vh]">{p.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-[4vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.6vh] flex justify-between items-center">
          <div className="font-display text-[1.3vw] leading-tight tracking-tight text-text/85">
            <span className="text-text">CPG today.</span> <span className="text-blue">Sensing layer next.</span> <span className="text-accent">Same operating system.</span>
          </div>
          <div className="font-body text-[0.78vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Roadmap signal · not a 2026 deliverable<br/>
            $4M Seed funds the can. Phantom funds itself on data.
          </div>
        </div>
      </div>
    </div>
  );
}
