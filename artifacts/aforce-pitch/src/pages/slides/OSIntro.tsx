export default function OSIntro() {
  const pillars = [
    {
      label: "Score",
      title: "Reads the body in real time.",
      body: "Hydration, energy, and recovery — measured continuously, not guessed at.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      label: "Coach",
      title: "Tells you what to do next.",
      body: "One command at a time — no dashboards, no decisions, no friction in the moment.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Network",
      title: "Compounds across users.",
      body: "Every sip teaches the model. The system gets smarter with every can sold.",
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
        style={{ background: "radial-gradient(ellipse 50% 60% at 78% 50%, rgba(245,214,55,0.16) 0%, transparent 62%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 45% 50% at 12% 22%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">11 — AForce OS</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">11 / 24</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[42vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-accent font-semibold">The Other Half of AForce</span>
        </div>
        <h2 className="font-display text-[5.4vw] leading-[0.92] tracking-tighter">
          Beyond the <span className="text-accent">can.</span>
        </h2>
        <p className="mt-[2.4vh] font-body text-[1.15vw] text-text/70 leading-snug max-w-[40vw]">
          The drink fuels the body. The app reads the body and tells you what to do next. <span className="text-text">AForce OS turns every sip into measurable output.</span>
        </p>
      </div>

      <div className="absolute top-[48vh] left-[6vw] right-[42vw] space-y-[1.4vh]">
        {pillars.map((p) => (
          <div key={p.label} className={`relative rounded-xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${p.bg} pointer-events-none`} />
            <div className={`absolute inset-y-0 left-0 w-[3px] ${p.bar}`} />
            <div className="relative pl-[1.6vw] pr-[1.4vw] py-[1.4vh] flex items-baseline gap-[1.4vw]">
              <div className={`font-body uppercase tracking-[0.32em] text-[0.95vw] font-semibold ${p.accent} min-w-[6vw]`}>{p.label}</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] leading-tight tracking-tight text-text">{p.title}</div>
                <div className="font-body text-[0.9vw] text-text/60 mt-[0.5vh] leading-snug">{p.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute right-[24vw] top-[55vh] z-20 flex flex-col items-center">
        <div className="w-[5vw] h-[1.2vw] bg-gradient-to-b from-text/0 via-text/10 to-text/20 rounded-t-md" />
        <div className="w-[8vw] h-[9.5vw] bg-bg-elev rounded-[1.5vw] border-2 border-text/30 overflow-hidden p-[0.6vw] flex flex-col shadow-2xl ring-1 ring-text/5">
          <div className="flex justify-between items-center px-[0.2vw]">
            <span className="font-body text-[0.55vw] text-text/55">9:41</span>
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-accent" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="font-body uppercase tracking-[0.2em] text-[0.5vw] text-muted">Next</div>
            <div className="font-display text-[1.5vw] leading-none text-accent mt-[0.5vh]">Drink</div>
            <div className="font-body text-[0.55vw] text-text/65 mt-[0.4vh] text-center leading-tight">Berry Blast</div>
          </div>
          <div className="text-center pt-[0.4vh] border-t border-text/10">
            <div className="font-body uppercase tracking-[0.22em] text-[0.5vw] text-accent font-semibold">18 min</div>
          </div>
        </div>
        <div className="w-[5vw] h-[1.2vw] bg-gradient-to-t from-text/0 via-text/10 to-text/20 rounded-b-md" />
      </div>

      <div className="absolute right-[7vw] top-[13vh] z-10">
        <div className="w-[19vw] h-[38vw] bg-bg-elev rounded-[2.4vw] border-2 border-text/20 overflow-hidden p-[1.3vw] flex flex-col shadow-2xl">
          <div className="flex justify-between items-center px-[0.8vw] mb-[1.4vh]">
            <span className="font-body text-[0.9vw] text-text/60">9:41</span>
            <div className="flex gap-[0.4vw]">
              <div className="w-[1vw] h-[0.6vh] rounded-sm bg-text/40" />
              <div className="w-[0.8vw] h-[0.8vh] rounded-full bg-text/40" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.8vw] text-muted mb-[0.8vh]">AForce Command</div>
              <div className="font-display text-[1.8vw] leading-tight text-text">Drink Berry Blast.</div>
              <div className="font-body text-[0.95vw] text-text/65 mt-[0.8vh] leading-snug">Window closes in 18 min.</div>
            </div>

            <div className="flex flex-col items-center my-[1.4vh]">
              <div className="relative w-[12vw] h-[12vw] flex items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="rgba(245,214,55,0.15)" strokeWidth="6" fill="none" />
                  <circle cx="50" cy="50" r="44" stroke="#F5D637" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="36" transform="rotate(-90 50 50)" />
                </svg>
                <div className="text-center">
                  <div className="font-display text-[3vw] leading-none text-accent">87</div>
                  <div className="font-body uppercase tracking-[0.2em] text-[0.7vw] text-muted mt-[0.4vh]">Hydration</div>
                </div>
              </div>
              <div className="mt-[1.4vh] px-[1vw] py-[0.4vh] bg-accent/15 border border-accent/40 rounded-full font-body uppercase tracking-[0.25em] text-[0.8vw] text-accent">Peak</div>
            </div>

            <div className="grid grid-cols-3 gap-[0.5vw]">
              <div className="bg-bg rounded-md p-[0.7vw] border border-text/10">
                <div className="font-body text-[0.7vw] text-muted uppercase tracking-[0.15em]">Sip</div>
                <div className="font-display text-[1.1vw] text-text">+8</div>
              </div>
              <div className="bg-bg rounded-md p-[0.7vw] border border-text/10">
                <div className="font-body text-[0.7vw] text-muted uppercase tracking-[0.15em]">Streak</div>
                <div className="font-display text-[1.1vw] text-text">12d</div>
              </div>
              <div className="bg-bg rounded-md p-[0.7vw] border border-text/10">
                <div className="font-body text-[0.7vw] text-muted uppercase tracking-[0.15em]">Voice</div>
                <div className="font-display text-[1.1vw] text-accent">●</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[42vw]">
        <div className="border-t border-text/10 pt-[1.8vh]">
          <div className="flex items-center gap-[1vw] mb-[1vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The OS Loop</div>
          </div>
          <div className="font-display text-[1.5vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Can fuels body. App reads body. Body trains OS. </span>
            <span className="text-accent">The loop compounds.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
