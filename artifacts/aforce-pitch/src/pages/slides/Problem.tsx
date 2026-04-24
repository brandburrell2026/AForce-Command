export default function Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">03 — Problem</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">03 / 15</div>
      </div>

      <div className="absolute top-[18vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[7vw] leading-[0.95] tracking-tighter text-balance max-w-[75vw]">
          Hydration is broken.
        </h2>
        <p className="mt-[3vh] font-body text-[1.8vw] text-text/75 max-w-[55vw] leading-snug">
          The shelf gives you two bad choices. Both cost output.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[3vw]">
        <div className="bg-bg-elev rounded-md p-[3vw] border-l-2 border-primary">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-primary mb-[2vh]">Option A</div>
          <div className="font-display text-[3.5vw] leading-tight tracking-tight text-text mb-[2vh]">Sugar bombs.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">
            Acid-forming. Energy crashes. Marketed at performance, engineered for taste.
          </div>
        </div>
        <div className="bg-bg-elev rounded-md p-[3vw] border-l-2 border-muted">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[2vh]">Option B</div>
          <div className="font-display text-[3.5vw] leading-tight tracking-tight text-text mb-[2vh]">Plain water.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">
            Hydrates the basics. No added minerals. No buffer. Hard to ride past a long session.
          </div>
        </div>
      </div>
    </div>
  );
}
