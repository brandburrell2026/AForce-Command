export default function TechProof() {
  const built = [
    {
      label: "AForce OS App (iOS + Android)",
      body: "Score orb · real-time state tracking · hydration prompts · BAC social mode · recovery plan engine.",
      tag: "Live in TestFlight",
    },
    {
      label: "Closed-loop algorithm v1",
      body: "Drink → Score → Coach loop functional. Pulls weather API, activity, intake.",
      tag: "5,000+ engineering hours",
    },
    {
      label: "Performance scoring model",
      body: "0–100 composite score. Hydration + activity + environment variables. Adaptive coefficients per user profile.",
      tag: "Proprietary",
    },
    {
      label: "Patent filed",
      body: "U.S. Provisional App 64/057,695 · Filed May 5, 2026 · 'Closed-Loop Real-Time Physiological Performance Operating System'",
      tag: "USPTO confirmed",
    },
  ];

  const roadmap = [
    {
      label: "AI Coach v1 · Phase 1 Consumer",
      when: "Q4 2026",
      body: "Real-time voice command. Mode-aware coaching. Adaptive protocol rewrites from live biometrics.",
      cost: "$800K from this raise",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
    },
    {
      label: "Clutch · Coach-side roster grid",
      when: "2027",
      body: "Per-seat SaaS for athletic programs. Live roster tier system: PLATINUM → DEPLETED.",
      cost: "Beta with 3 pro teams",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
    },
    {
      label: "Guardian · Enterprise risk layer",
      when: "2027+",
      body: "Composite risk score per athlete. Medical escalation paths.",
      cost: "$120K/franchise/yr ACV target",
      accent: "text-blue",
      ring: "ring-blue/30",
      bar: "bg-blue/70",
    },
    {
      label: "Phantom One · Wearable band",
      when: "Phase 2+",
      body: "Passive bio-signal capture. No screen. LED color state.",
      cost: "$0 of this raise · funded by OS data revenue",
      accent: "text-text",
      ring: "ring-text/20",
      bar: "bg-text/60",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 22% 28%, rgba(182,255,0,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 80% 78%, rgba(84,120,213,0.14) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">07A — AForce OS · Tech Proof</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">8 / 22</div>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1vh]">
            <div className="h-[2px] w-[3.5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1vw] text-accent font-semibold">Built Today vs. Roadmap</span>
          </div>
          <h2 className="font-display text-[4.4vw] leading-[0.92] tracking-tighter">
            Not a vision.
            <br />
            <span className="text-accent">A system already running.</span>
          </h2>
        </div>
        <p className="font-body text-[1vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          The can is the entry point. The OS is the moat — and v1 is already in users' hands. <span className="text-text">Closed-loop algorithm functional. USPTO patent filed.</span>
        </p>
      </div>

      {/* Two-column body */}
      <div className="absolute top-[28vh] bottom-[8vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw]">
        {/* LEFT — Built today */}
        <div className="relative rounded-2xl ring-1 ring-accent/30 bg-bg-elev/40 overflow-hidden flex flex-col">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-accent" />
          <div className="px-[1.6vw] pt-[1.6vh] pb-[1vh] border-b border-text/10">
            <div className="flex items-center gap-[0.7vw]">
              <span className="w-[0.6vw] h-[0.6vw] rounded-full bg-accent animate-pulse" />
              <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-accent font-semibold">Built &amp; Functional Today</div>
            </div>
          </div>
          <div className="flex-1 p-[1.4vw] flex flex-col gap-[1.2vh] overflow-hidden">
            {built.map((b) => (
              <div key={b.label} className="border-b border-text/8 last:border-0 pb-[1.1vh] last:pb-0">
                <div className="flex items-baseline justify-between gap-[1vw]">
                  <div className="font-display text-[1.15vw] leading-tight tracking-tight text-text">{b.label}</div>
                  <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] text-accent font-semibold whitespace-nowrap shrink-0">{b.tag}</div>
                </div>
                <div className="font-body text-[0.82vw] text-text/65 leading-snug mt-[0.4vh]">{b.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Roadmap */}
        <div className="relative rounded-2xl ring-1 ring-blue/30 bg-bg-elev/40 overflow-hidden flex flex-col">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-blue" />
          <div className="px-[1.6vw] pt-[1.6vh] pb-[1vh] border-b border-text/10">
            <div className="flex items-center gap-[0.7vw]">
              <span className="w-[0.6vw] h-[0.6vw] rounded-full bg-blue" />
              <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-blue font-semibold">Roadmap · Funded by This Raise or Next Round</div>
            </div>
          </div>
          <div className="flex-1 p-[1.4vw] flex flex-col gap-[1.1vh] overflow-hidden">
            {roadmap.map((r) => (
              <div key={r.label} className={`relative rounded-md ring-1 ${r.ring} bg-bg/40 px-[1vw] py-[0.9vh]`}>
                <div className={`absolute left-0 top-[0.8vh] bottom-[0.8vh] w-[3px] ${r.bar} rounded-full`} />
                <div className="flex items-baseline justify-between gap-[1vw] pl-[0.7vw]">
                  <div className={`font-display text-[1.05vw] leading-tight tracking-tight ${r.accent}`}>{r.label}</div>
                  <div className={`font-body uppercase tracking-[0.22em] text-[0.6vw] ${r.accent} font-semibold whitespace-nowrap shrink-0`}>{r.when}</div>
                </div>
                <div className="font-body text-[0.78vw] text-text/65 leading-snug mt-[0.3vh] pl-[0.7vw]">{r.body}</div>
                <div className="font-body text-[0.7vw] text-text/45 leading-snug mt-[0.3vh] pl-[0.7vw] italic">{r.cost}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-[2vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.2vh] flex justify-between items-center">
          <div className="font-display text-[1.3vw] leading-tight tracking-tight">
            <span className="text-text">The can is ready. </span>
            <span className="text-accent">The OS is running. </span>
            <span className="text-blue">The loop is closed.</span>
          </div>
          <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            5,000+ engineering hours · TestFlight live · patent filed
          </div>
        </div>
      </div>
    </div>
  );
}
