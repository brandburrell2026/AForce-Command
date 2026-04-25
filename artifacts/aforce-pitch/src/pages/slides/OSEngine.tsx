export default function OSEngine() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">13 — The Engine</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 29</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">How AForce OS Works</span>
        </div>
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance">
          Score. <span className="text-primary">Why.</span> <span className="text-blue">Command.</span>
        </h2>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[2vw]">
        <div className="bg-bg-elev rounded-lg p-[2vw] border-t-2 border-accent">
          <div className="font-body uppercase tracking-[0.3em] text-[1.3vw] text-accent mb-[1.5vh]">Step 01</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Score</div>

          <div className="bg-bg rounded-md p-[1.5vw] border border-text/10 mb-[2vh]">
            <div className="flex items-center gap-[1vw]">
              <div className="relative w-[6vw] h-[6vw] flex items-center justify-center shrink-0">
                <svg className="absolute inset-0" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="rgba(245,214,55,0.15)" strokeWidth="6" fill="none" />
                  <circle cx="50" cy="50" r="44" stroke="#F5D637" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="50" transform="rotate(-90 50 50)" />
                </svg>
                <div className="font-display text-[1.8vw] text-accent">82</div>
              </div>
              <div>
                <div className="font-body uppercase tracking-[0.2em] text-[1vw] text-muted">Hydration</div>
                <div className="font-body text-[1.1vw] text-text/85">Balanced</div>
              </div>
            </div>
          </div>

          <div className="font-body text-[1.4vw] text-text/75 leading-snug">
            HydroScan and intake events feed a real-time hydration score with absorption-curve modeling.
          </div>
        </div>

        <div className="bg-bg-elev rounded-lg p-[2vw] border-t-2 border-primary">
          <div className="font-body uppercase tracking-[0.3em] text-[1.3vw] text-primary mb-[1.5vh]">Step 02</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Why</div>

          <div className="bg-bg rounded-md p-[1.5vw] border border-text/10 mb-[2vh]">
            <div className="font-body uppercase tracking-[0.2em] text-[1vw] text-muted mb-[1vh]">Behind today</div>
            <div className="flex flex-col gap-[1vh]">
              <div className="flex justify-between font-body text-[1.1vw]">
                <span className="text-text/85">Sweat load</span>
                <span className="text-primary">High</span>
              </div>
              <div className="flex justify-between font-body text-[1.1vw]">
                <span className="text-text/85">Last sip</span>
                <span className="text-text/85">42 min</span>
              </div>
              <div className="flex justify-between font-body text-[1.1vw]">
                <span className="text-text/85">Heat index</span>
                <span className="text-accent">86°</span>
              </div>
            </div>
          </div>

          <div className="font-body text-[1.4vw] text-text/75 leading-snug">
            Mode-aware coach surfaces the drivers — weather, sleep, sweat, output — so the score is honest, not magic.
          </div>
        </div>

        <div className="bg-bg-elev rounded-lg p-[2vw] border-t-2 border-blue">
          <div className="font-body uppercase tracking-[0.3em] text-[1.3vw] text-blue mb-[1.5vh]">Step 03</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Command</div>

          <div className="bg-bg rounded-md p-[1.5vw] border border-text/10 mb-[2vh]">
            <div className="font-body uppercase tracking-[0.2em] text-[1vw] text-muted mb-[1vh]">Now</div>
            <div className="font-display text-[1.5vw] text-text leading-tight mb-[1vh]">Drink Watermelon Surge.</div>
            <div className="flex justify-between items-center">
              <div className="font-body text-[1vw] text-text/65">8oz · next 20 min</div>
              <div className="px-[1vw] py-[0.4vh] bg-blue/15 border border-blue/40 rounded-full font-body uppercase tracking-[0.2em] text-[0.9vw] text-blue">Logged</div>
            </div>
          </div>

          <div className="font-body text-[1.4vw] text-text/75 leading-snug">
            One-tap action. Voice-readable. Closes the gap between knowing and doing.
          </div>
        </div>
      </div>
    </div>
  );
}
