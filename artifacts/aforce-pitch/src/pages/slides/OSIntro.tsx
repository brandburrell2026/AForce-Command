export default function OSIntro() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">12 — AForce OS</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 28</div>
      </div>

      <div
        className="absolute inset-y-0 right-0 w-[50vw] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(245,214,55,0.18) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[20vh] left-[6vw] right-[40vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">The Other Half of AForce</span>
        </div>
        <h2 className="font-display text-[7.5vw] leading-[0.9] tracking-tighter text-balance">
          Beyond the can.
        </h2>
        <p className="mt-[4vh] font-body text-[2vw] font-light text-text/80 max-w-[40vw] leading-snug text-pretty">
          AForce OS turns every sip into measurable output. The drink fuels the body. The app reads the body and tells you what to do next.
        </p>
        <div className="mt-[6vh] flex gap-[2vw] font-body uppercase tracking-[0.3em] text-[1.5vw]">
          <span className="text-primary">Score</span>
          <span className="text-muted">·</span>
          <span className="text-blue">Coach</span>
          <span className="text-muted">·</span>
          <span className="text-accent">Network</span>
        </div>
      </div>

      <div className="absolute right-[8vw] top-1/2 -translate-y-1/2 z-10">
        <div className="w-[22vw] h-[44vw] bg-bg-elev rounded-[3vw] border-2 border-text/20 overflow-hidden p-[1.5vw] flex flex-col shadow-2xl">
          <div className="flex justify-between items-center px-[1vw] mb-[2vh]">
            <span className="font-body text-[1vw] text-text/60">9:41</span>
            <div className="flex gap-[0.4vw]">
              <div className="w-[1vw] h-[0.6vh] rounded-sm bg-text/40" />
              <div className="w-[0.8vw] h-[0.8vh] rounded-full bg-text/40" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.9vw] text-muted mb-[1vh]">AForce Command</div>
              <div className="font-display text-[2vw] leading-tight text-text">Drink Berry Blast.</div>
              <div className="font-body text-[1.1vw] text-text/65 mt-[1vh] leading-snug">Window closes in 18 min.</div>
            </div>

            <div className="flex flex-col items-center my-[2vh]">
              <div className="relative w-[14vw] h-[14vw] flex items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="rgba(245,214,55,0.15)" strokeWidth="6" fill="none" />
                  <circle cx="50" cy="50" r="44" stroke="#F5D637" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="36" transform="rotate(-90 50 50)" />
                </svg>
                <div className="text-center">
                  <div className="font-display text-[3.5vw] leading-none text-accent">87</div>
                  <div className="font-body uppercase tracking-[0.2em] text-[0.8vw] text-muted mt-[0.5vh]">Hydration</div>
                </div>
              </div>
              <div className="mt-[2vh] px-[1.2vw] py-[0.6vh] bg-accent/15 border border-accent/40 rounded-full font-body uppercase tracking-[0.25em] text-[0.9vw] text-accent">Peak</div>
            </div>

            <div className="grid grid-cols-3 gap-[0.6vw]">
              <div className="bg-bg rounded-md p-[0.8vw] border border-text/10">
                <div className="font-body text-[0.8vw] text-muted uppercase tracking-[0.15em]">Sip</div>
                <div className="font-display text-[1.2vw] text-text">+8</div>
              </div>
              <div className="bg-bg rounded-md p-[0.8vw] border border-text/10">
                <div className="font-body text-[0.8vw] text-muted uppercase tracking-[0.15em]">Streak</div>
                <div className="font-display text-[1.2vw] text-text">12d</div>
              </div>
              <div className="bg-bg rounded-md p-[0.8vw] border border-text/10">
                <div className="font-body text-[0.8vw] text-muted uppercase tracking-[0.15em]">Voice</div>
                <div className="font-display text-[1.2vw] text-accent">●</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
