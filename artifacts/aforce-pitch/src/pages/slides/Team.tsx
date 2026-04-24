export default function Team() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">14 — Team</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">14 / 15</div>
      </div>

      <div className="absolute top-[18vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Two brothers.
        </h2>
        <p className="mt-[3vh] font-body text-[1.7vw] font-light text-text/75 max-w-[55vw] text-pretty">
          Built AForce because they needed it. Then they noticed everyone else did too.
        </p>
      </div>

      <div className="absolute top-[48vh] bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[5vw]">
        <div className="border-t border-divider pt-[3vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1.5vh]">Co-founder</div>
          <div className="font-display text-[2.6vw] text-text mb-[1.5vh] leading-tight">[Founder 01 Name]</div>
          <p className="font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">
            [One-line background — formulation, brand, beverage operations.]
          </p>
        </div>
        <div className="border-t border-divider pt-[3vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1.5vh]">Co-founder</div>
          <div className="font-display text-[2.6vw] text-text mb-[1.5vh] leading-tight">[Founder 02 Name]</div>
          <p className="font-body text-[1.5vw] font-light text-text/70 text-pretty leading-snug">
            [One-line background — software, hardware, OS engineering.]
          </p>
        </div>
      </div>
    </div>
  );
}
