export default function Roadmap() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">13 — Roadmap</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 15</div>
      </div>

      <div className="absolute top-[18vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Twelve months to the loop.
        </h2>
      </div>

      <div className="absolute top-[42vh] bottom-[10vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-4 gap-[2vw]">
          <div className="flex flex-col">
            <div className="h-[3px] w-full bg-primary" />
            <div className="mt-[2vh] font-display text-[1.7vw] text-primary">Q3 2026</div>
            <div className="mt-[1.5vh] font-display text-[2vw] text-text leading-tight">Drink launch</div>
            <p className="mt-[2vh] font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">DTC release. Founders' market in NYC and LA.</p>
          </div>
          <div className="flex flex-col">
            <div className="h-[3px] w-full bg-accent" />
            <div className="mt-[2vh] font-display text-[1.7vw] text-accent">Q4 2026</div>
            <div className="mt-[1.5vh] font-display text-[2vw] text-text leading-tight">AForce OS public</div>
            <p className="mt-[2vh] font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">App store release. State engine and paid tier live.</p>
          </div>
          <div className="flex flex-col">
            <div className="h-[3px] w-full bg-primary" />
            <div className="mt-[2vh] font-display text-[1.7vw] text-primary">Q1 2027</div>
            <div className="mt-[1.5vh] font-display text-[2vw] text-text leading-tight">Phantom Band beta</div>
            <p className="mt-[2vh] font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">Closed cohort. Hardware loop closes.</p>
          </div>
          <div className="flex flex-col">
            <div className="h-[3px] w-full bg-accent" />
            <div className="mt-[2vh] font-display text-[1.7vw] text-accent">Q2 2027</div>
            <div className="mt-[1.5vh] font-display text-[2vw] text-text leading-tight">Retail expansion</div>
            <p className="mt-[2vh] font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">Specialty wellness and premium grocery.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
