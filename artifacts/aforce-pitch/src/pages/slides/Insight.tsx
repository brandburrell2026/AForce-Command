export default function Insight() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">04 — Insight</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">04 / 22</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[2.4vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Insight</span>
        </div>
        <h2 className="font-display text-[5.6vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Performance lives in the buffer.
        </h2>
      </div>

      <div className="absolute top-[40vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-9 gap-[0.5vw] mb-[2vh]">
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
        <div className="flex justify-between font-body uppercase tracking-[0.3em] text-[1.2vw] text-muted">
          <span>pH 1 — Acidic</span>
          <span>Neutral</span>
          <span className="text-accent">pH 8.8 — AForce</span>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[2vw]">
        <div className="border-l-2 border-primary pl-[1.4vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-primary mb-[0.8vh]">Buffer</div>
          <div className="font-display text-[1.8vw] leading-tight text-text mb-[1vh]">Support recovery.</div>
          <div className="font-body text-[1.05vw] text-text/75 leading-snug">Alkaline mineral content complements the body's natural buffer after hard effort.</div>
        </div>
        <div className="border-l-2 border-blue pl-[1.4vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-blue mb-[0.8vh]">Restore</div>
          <div className="font-display text-[1.8vw] leading-tight text-text mb-[1vh]">Mineral matrix.</div>
          <div className="font-body text-[1.05vw] text-text/75 leading-snug">Sea-derived ingredients carry electrolytes and trace minerals in their natural form.</div>
        </div>
        <div className="border-l-2 border-accent pl-[1.4vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-accent mb-[0.8vh]">Hold</div>
          <div className="font-display text-[1.8vw] leading-tight text-text mb-[1vh]">Built to ride longer.</div>
          <div className="font-body text-[1.05vw] text-text/75 leading-snug">No added sugar — designed to keep you in the work, not chasing a crash.</div>
        </div>
      </div>
    </div>
  );
}
