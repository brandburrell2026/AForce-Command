export default function Tailwinds() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">11 — Why pH 8.8</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">11 / 29</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Why Alkaline</span>
        </div>
        <h2 className="font-display text-[6.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Buffer the body. Hold the output.
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[2vw]">
        <div className="border-l-2 border-primary pl-[2vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-primary mb-[1.5vh]">Buffer</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Designed to support recovery.</div>
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">Alkaline mineral content is formulated to complement the body's natural buffer after hard effort.</div>
        </div>
        <div className="border-l-2 border-blue pl-[2vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-blue mb-[1.5vh]">Restore</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Mineral matrix.</div>
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">Sea-derived ingredients carry electrolytes and trace minerals in their natural plant form.</div>
        </div>
        <div className="border-l-2 border-accent pl-[2vw]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1.5vh]">Hold</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[2vh]">Built to ride longer.</div>
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">A clean formula and no added sugar — designed to keep you in the work, not chasing a crash.</div>
        </div>
      </div>
    </div>
  );
}
