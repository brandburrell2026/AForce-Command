export default function Insight() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">04 — Insight</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">04 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Nobody owns the loop.
        </h2>
        <p className="mt-[3vh] font-body text-[1.7vw] font-light text-muted max-w-[55vw] text-pretty">
          Drink, data, action, recovery. The pieces exist. The system does not.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[5vw]">
        <div className="border-t border-divider pt-[3vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">Today</div>
          <div className="font-display text-[3vw] leading-tight text-text mb-[2vh] text-balance">
            Drink without context.
          </div>
          <p className="font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">
            Sugar bombs sold by who shouts loudest. No feedback loop.
          </p>
        </div>
        <div className="border-t border-divider pt-[3vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">Today</div>
          <div className="font-display text-[3vw] leading-tight text-text mb-[2vh] text-balance">
            Data without action.
          </div>
          <p className="font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">
            Wearables count steps and stare. They never tell you what to do.
          </p>
        </div>
      </div>
    </div>
  );
}
