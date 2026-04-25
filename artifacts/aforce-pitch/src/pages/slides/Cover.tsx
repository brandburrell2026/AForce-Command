export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-y-0 right-0 w-[55vw]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute w-[36vw] h-[36vw] rounded-full opacity-40 blur-[6vw]"
            style={{ background: "radial-gradient(circle, rgba(84,120,213,0.55) 0%, transparent 70%)" }}
          />
          <img
            src={`${base}can-berry.png`}
            alt=""
            className="relative h-[78vh] object-contain drop-shadow-2xl -translate-x-[18%]"
          />
        </div>

        <div
          className="absolute right-[4vw] top-1/2 -translate-y-1/2 w-[17vw] h-[35vw] bg-bg-elev rounded-[2.4vw] border-2 border-text/25 overflow-hidden p-[1.2vw] flex flex-col shadow-2xl z-10"
          style={{ boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 0 60px rgba(245,214,55,0.12)" }}
        >
          <div className="flex justify-between items-center px-[0.6vw] mb-[1.5vh]">
            <span className="font-body text-[0.8vw] text-text/60">9:41</span>
            <div className="flex gap-[0.3vw]">
              <div className="w-[0.8vw] h-[0.5vh] rounded-sm bg-text/40" />
              <div className="w-[0.6vw] h-[0.6vh] rounded-full bg-text/40" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-muted mb-[0.8vh]">AForce Command</div>
              <div className="font-display text-[1.5vw] leading-tight text-text">Drink Berry Blast.</div>
              <div className="font-body text-[0.85vw] text-text/65 mt-[0.6vh] leading-snug">Window closes in 18 min.</div>
            </div>

            <div className="flex flex-col items-center my-[1vh]">
              <div className="relative w-[11vw] h-[11vw] flex items-center justify-center">
                <svg className="absolute inset-0" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="rgba(245,214,55,0.15)" strokeWidth="6" fill="none" />
                  <circle cx="50" cy="50" r="44" stroke="#F5D637" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="276" strokeDashoffset="36" transform="rotate(-90 50 50)" />
                </svg>
                <div className="text-center">
                  <div className="font-display text-[2.8vw] leading-none text-accent">87</div>
                  <div className="font-body uppercase tracking-[0.2em] text-[0.65vw] text-muted mt-[0.4vh]">Hydration</div>
                </div>
              </div>
              <div className="mt-[1.5vh] px-[1vw] py-[0.4vh] bg-accent/15 border border-accent/40 rounded-full font-body uppercase tracking-[0.25em] text-[0.7vw] text-accent">Peak</div>
            </div>

            <div className="grid grid-cols-3 gap-[0.4vw]">
              <div className="bg-bg rounded-md p-[0.5vw] border border-text/10">
                <div className="font-body text-[0.6vw] text-muted uppercase tracking-[0.15em]">Sip</div>
                <div className="font-display text-[1vw] text-text">+8</div>
              </div>
              <div className="bg-bg rounded-md p-[0.5vw] border border-text/10">
                <div className="font-body text-[0.6vw] text-muted uppercase tracking-[0.15em]">Streak</div>
                <div className="font-display text-[1vw] text-text">12d</div>
              </div>
              <div className="bg-bg rounded-md p-[0.5vw] border border-text/10">
                <div className="font-body text-[0.6vw] text-muted uppercase tracking-[0.15em]">Voice</div>
                <div className="font-display text-[1vw] text-accent">●</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[55vw] pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--slide-bg) 55%, transparent 100%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-20">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">01 — Cover</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">01 / 19</div>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[55vw] z-20">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">Performance Alkaline Hydration + OS</span>
        </div>
        <h1 className="font-display text-[12vw] leading-[0.85] tracking-tighter text-text">
          AForce.
        </h1>
        <p className="mt-[3vh] font-body text-[2vw] font-light text-text/80 max-w-[42vw] text-pretty">
          Fuel your body with alkaline power.
        </p>
        <div className="mt-[5vh] font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">
          pH 8.8  ·  No added sugar  ·  Sea-derived functionals
        </div>
      </div>
    </div>
  );
}
