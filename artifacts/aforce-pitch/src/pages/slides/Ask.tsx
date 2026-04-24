export default function Ask() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">19 — Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">19 / 19</div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 60%, rgba(229,51,65,0.15) 0%, transparent 50%)" }}
      />

      <div className="absolute top-[22vh] left-[6vw] right-[6vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent mb-[3vh] font-semibold">Raising</div>
        <h2 className="font-display text-[12vw] leading-[0.85] tracking-tighter text-text">
          $[X]M Seed
        </h2>
        <p className="mt-[4vh] font-body text-[1.8vw] text-text/85 max-w-[55vw] leading-snug">
          To launch the line, fund the first national accounts, and put AForce in every cooler that matters.
        </p>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw] flex justify-between items-end">
        <div>
          <div className="h-[2px] w-[5vw] bg-primary mb-[2vh]" />
          <div className="font-display text-[3.5vw] leading-tight text-text">Become AForce.</div>
        </div>
        <div className="text-right font-body text-[1.5vw] text-muted">
          <div>[founders@aforce.com]</div>
          <div className="mt-[0.5vh]">aforce.com</div>
        </div>
      </div>
    </div>
  );
}
