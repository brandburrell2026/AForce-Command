export default function OSIntro() {
  const pillars = [
    {
      label: "Score",
      title: "Reads your state in real time.",
      body: "Hydration, energy, environment, and behavior become one score.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      label: "Coach",
      title: "Tells you what to do next.",
      body: "One command at a time. No guessing. No friction in the moment.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
    {
      label: "Network",
      title: "Learns and improves over time.",
      body: "Every cycle strengthens the system. Every can sold sharpens the next.",
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
        style={{ background: "radial-gradient(ellipse 50% 60% at 78% 50%, rgba(229,51,65,0.16) 0%, transparent 62%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 45% 50% at 12% 22%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">08 — AForce OS</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">8 / 25</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[42vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-accent font-semibold">The Other Half of AForce</span>
        </div>
        <h2 className="font-display text-[5.4vw] leading-[0.92] tracking-tighter">
          The intelligence <span className="text-accent">layer.</span>
        </h2>
        <p className="mt-[2.4vh] font-body text-[1.15vw] text-text/70 leading-snug max-w-[40vw]">
          The product fuels the body. <span className="text-text">AForce OS reads the state and tells the user what to do next.</span>
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

      <div className="absolute right-[30vw] top-[55vh] z-20 flex flex-col items-center">
        <div className="w-[5vw] h-[1.2vw] bg-gradient-to-b from-text/0 via-text/10 to-text/20 rounded-t-md" />
        <div className="w-[8vw] h-[9.5vw] bg-black rounded-[1.5vw] border-2 border-text/30 overflow-hidden p-[0.6vw] flex flex-col shadow-2xl ring-1 ring-text/5">
          <div className="flex justify-between items-center px-[0.2vw]">
            <span className="font-body text-[0.55vw] text-text/55">6:06</span>
            <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-primary" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="font-body uppercase tracking-[0.2em] text-[0.5vw] text-primary font-semibold">Drink</div>
            <div className="font-display text-[1.3vw] leading-none text-primary mt-[0.4vh]">Now</div>
            <div className="font-body text-[0.55vw] text-text/55 mt-[0.4vh]">Score 52 ▼</div>
          </div>
          <div className="text-center pt-[0.4vh] border-t border-text/10">
            <div className="font-body uppercase tracking-[0.22em] text-[0.5vw] text-primary font-semibold">9 min</div>
          </div>
        </div>
        <div className="w-[5vw] h-[1.2vw] bg-gradient-to-t from-text/0 via-text/10 to-text/20 rounded-b-md" />
      </div>

      <div className="absolute right-[7vw] top-[13vh] z-10">
        <div className="w-[19vw] h-[38vw] bg-black rounded-[2.4vw] border-2 border-text/20 overflow-hidden p-[1vw] flex flex-col shadow-2xl">
          <div className="flex justify-between items-center px-[0.4vw] mb-[0.6vh]">
            <span className="font-body text-[0.7vw] text-text font-medium">6:06</span>
            <div className="flex gap-[0.35vw] items-center">
              <div className="flex items-end gap-[0.08vw]">
                <div className="w-[0.18vw] h-[0.4vh] bg-text/80 rounded-sm" />
                <div className="w-[0.18vw] h-[0.6vh] bg-text/80 rounded-sm" />
                <div className="w-[0.18vw] h-[0.8vh] bg-text/40 rounded-sm" />
                <div className="w-[0.18vw] h-[1vh] bg-text/40 rounded-sm" />
              </div>
              <span className="font-body text-[0.55vw] text-text/85 font-semibold">5G</span>
              <div className="px-[0.3vw] py-[0.1vh] rounded-[0.25vw] border border-text/55 font-body text-[0.5vw] text-text/85 leading-none">80</div>
            </div>
          </div>

          <div className="px-[0.4vw]">
            <div className="font-body text-[0.5vw] text-text/45">Welcome, Brandon</div>
            <div className="font-body uppercase tracking-[0.18em] text-[0.5vw] text-text/35 mt-[0.3vh] leading-tight">Performance Control<br />Center</div>
            <div className="flex items-center justify-between mt-[0.4vh] gap-[0.4vw]">
              <div className="font-display text-[1vw] leading-none text-text/85">AForce OS</div>
              <div className="flex items-center gap-[0.4vw]">
                <div className="w-[1.1vw] h-[1.1vw] rounded-full border border-text/30 flex items-center justify-center font-body text-[0.55vw] text-text/55">↑</div>
                <div className="px-[0.55vw] py-[0.15vh] rounded-full border border-primary/55 bg-primary/10 font-body uppercase tracking-[0.16em] text-[0.5vw] text-primary font-semibold flex items-center gap-[0.25vw]">
                  <span className="w-[0.3vw] h-[0.3vw] rounded-full bg-primary inline-block" />
                  Depleted
                </div>
              </div>
            </div>
            <div className="font-body text-[0.5vw] text-text/55 mt-[0.4vh] text-center">⏱ Wed, Apr 22 · 6:06 PM EDT</div>
            <div className="flex justify-center gap-[0.7vw] font-body text-[0.5vw] text-text/55 mt-[0.4vh]">
              <span>♨ 76°F</span>
              <span className="text-text/25">|</span>
              <span>○ 47% RH</span>
              <span className="text-text/25">|</span>
              <span>◎ Fort Lauderdale, FL</span>
            </div>
            <div className="flex items-center justify-center gap-[0.5vw] mt-[0.5vh] font-body text-[0.5vw]">
              <div className="px-[0.4vw] py-[0.1vh] rounded-full border border-primary/55 text-primary uppercase tracking-[0.16em] font-semibold flex items-center gap-[0.2vw]">
                <span className="w-[0.25vw] h-[0.25vw] rounded-full bg-primary inline-block" />
                Live
              </div>
              <span className="text-text/55">∿ 74 bpm</span>
              <span className="text-text/25">|</span>
              <span className="text-text/55">25/8 units</span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center my-[0.4vh]">
            <div className="relative w-[13.6vw] h-[13.6vw]">
              <div className="absolute inset-0 rounded-full bg-primary/[0.06]" />
              <div className="absolute inset-[0.9vw] rounded-full bg-primary/[0.10]" />
              <div className="absolute inset-[1.8vw] rounded-full bg-primary/[0.14]" />
              <div className="absolute inset-[2.7vw] rounded-full border border-primary/55" />
              <div className="absolute inset-[3.4vw] rounded-full bg-bg border border-primary/65" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="font-display text-[3.2vw] leading-none text-primary">52</div>
              </div>
            </div>
          </div>

          <div className="text-center font-body uppercase tracking-[0.22em] text-[0.5vw] text-text/40 mb-[0.4vh]">Tap orb for full breakdown</div>

          <div className="flex justify-center mb-[0.8vh]">
            <div className="px-[0.7vw] py-[0.25vh] rounded-full border border-primary/55 bg-primary/10 font-body text-[0.55vw] text-primary flex items-center gap-[0.3vw]">
              <span className="w-[0.3vw] h-[0.3vw] rounded-full bg-primary inline-block" />
              Drops to Depleted in 9 min
            </div>
          </div>

          <div className="relative grid grid-cols-5 gap-[0.2vw] pt-[0.6vh] border-t border-text/10">
            <div className="flex flex-col items-center gap-[0.2vh]">
              <div className="w-[1.6vw] h-[1.6vw] rounded-lg bg-blue/15 border border-blue/40 flex items-center justify-center text-blue font-display text-[0.95vw] leading-none">⚡</div>
              <div className="font-body text-[0.5vw] text-text/80">Home</div>
            </div>
            <div className="flex flex-col items-center gap-[0.2vh]">
              <div className="w-[1.6vw] h-[1.6vw] flex items-center justify-center text-text/55 font-display text-[1vw] leading-none">∿</div>
              <div className="font-body text-[0.5vw] text-text/55">Check</div>
            </div>
            <div className="flex flex-col items-center gap-[0.2vh]">
              <div className="w-[1.6vw] h-[1.6vw] flex items-center justify-center text-text/55 font-display text-[1vw] leading-none">≡</div>
              <div className="font-body text-[0.5vw] text-text/55">Protocol</div>
            </div>
            <div className="flex flex-col items-center gap-[0.2vh]">
              <div className="w-[1.6vw] h-[1.6vw] flex items-center justify-center text-text/55 font-display text-[1vw] leading-none">⌂</div>
              <div className="font-body text-[0.5vw] text-text/55">Store</div>
            </div>
            <div className="flex flex-col items-center gap-[0.2vh]">
              <div className="w-[1.6vw] h-[1.6vw] flex items-center justify-center text-text/55 font-display text-[1vw] leading-none">◉</div>
              <div className="font-body text-[0.5vw] text-text/55">Profile</div>
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
            <span className="text-text/55">Product fuels the body. </span>
            <span className="text-accent">OS controls performance.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
