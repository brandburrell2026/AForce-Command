export default function Insight() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">04 — Insight</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">04 / 15</div>
      </div>

      <div className="absolute top-[18vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Insight</span>
        </div>
        <h2 className="font-display text-[7vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Performance lives in the buffer.
        </h2>
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-9 gap-[0.5vw] mb-[3vh]">
          <div className="h-[2vh] bg-primary rounded-sm" />
          <div className="h-[2vh] bg-primary/80 rounded-sm" />
          <div className="h-[2vh] bg-primary/60 rounded-sm" />
          <div className="h-[2vh] bg-primary/40 rounded-sm" />
          <div className="h-[2vh] bg-text/30 rounded-sm" />
          <div className="h-[2vh] bg-blue/40 rounded-sm" />
          <div className="h-[2vh] bg-blue/60 rounded-sm" />
          <div className="h-[2vh] bg-blue/85 rounded-sm" />
          <div className="h-[3vh] bg-accent rounded-sm relative">
            <div className="absolute -top-[3vh] left-1/2 -translate-x-1/2 font-display text-[1.5vw] text-accent">8.8</div>
          </div>
        </div>
        <div className="flex justify-between font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted">
          <span>pH 1 — Acidic</span>
          <span>Neutral</span>
          <span className="text-accent">pH 8.8 — AForce</span>
        </div>
        <p className="mt-[5vh] font-body text-[1.8vw] text-text/85 max-w-[60vw] leading-snug text-pretty">
          Alkaline hydration is designed to support the body's natural buffer and replenish minerals after effort. Pair it with sea-derived functionals and you have a category nobody owns.
        </p>
      </div>
    </div>
  );
}
