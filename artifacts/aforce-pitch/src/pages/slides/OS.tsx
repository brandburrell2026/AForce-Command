export default function OS() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">07 — OS</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">07 / 15</div>
      </div>

      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative flex items-center justify-center bg-gradient-to-br from-bg-elev/60 to-bg">
          <div className="relative w-[24vw] h-[68vh] rounded-[3vw] bg-bg border border-divider overflow-hidden">
            <div className="absolute top-[2.5vh] left-0 right-0 flex justify-between px-[2vw] font-body text-[1.5vw] text-muted">
              <span>9:41</span>
              <span>AForce OS</span>
            </div>
            <div className="absolute top-[8vh] left-0 right-0 flex flex-col items-center">
              <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent">State</div>
              <div className="mt-[1vh] font-display text-[4.5vw] leading-none text-accent">PEAK</div>
              <div className="mt-[2.5vh] w-[12vw] h-[12vw] rounded-full border-2 border-accent flex items-center justify-center">
                <div className="font-display text-[3.5vw] text-text">92</div>
              </div>
              <div className="mt-[1.5vh] font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted">Output Score</div>
            </div>
            <div className="absolute bottom-[4vh] left-[2vw] right-[2vw] bg-bg-elev rounded-md py-[2vh] px-[2vw]">
              <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted">Routing</div>
              <div className="mt-[0.8vh] flex items-center gap-[1vw]">
                <span className="font-display text-[1.8vw] text-accent">Hydrate</span>
                <span className="font-display text-[1.6vw] text-primary">→</span>
                <span className="font-display text-[1.8vw] text-text">Push</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center px-[5vw]">
          <div className="h-[2px] w-[4vw] bg-accent mb-[3vh]" />
          <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance">
            The OS.
          </h2>
          <p className="mt-[4vh] font-body text-[1.6vw] font-light text-text/85 text-pretty leading-relaxed max-w-[35vw]">
            AForce OS reads your performance state in real time. Then it routes hydration, recovery, and action.
          </p>
          <div className="mt-[5vh] flex flex-col gap-[2vh] max-w-[35vw]">
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-accent mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">Live state engine — Peak, Balanced, Recovering, Depleted.</div>
            </div>
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-primary mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">Social Mode — handles the hangover before it lands.</div>
            </div>
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-text/70 mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">AI-routed action stack. No menus. Just intent.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
