export default function Team() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">18 — Team</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">18 / 19</div>
      </div>

      <div className="absolute top-[18vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[7vw] leading-[0.95] tracking-tighter text-balance">
          Two brothers.
        </h2>
        <p className="mt-[3vh] font-body text-[1.8vw] text-text/80 max-w-[55vw] leading-snug">
          Built AForce because they needed a hydration drink that did not lie. Then they noticed everyone else needed one too.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[5vw]">
        <div>
          <div className="border-t border-divider mb-[3vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[2vh]">Co-Founder</div>
          <div className="font-display text-[3vw] leading-tight tracking-tight text-text mb-[2vh]">[Founder 01 Name]</div>
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">[One-line background — formulation, brand, beverage operations.]</div>
        </div>
        <div>
          <div className="border-t border-divider mb-[3vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[2vh]">Co-Founder</div>
          <div className="font-display text-[3vw] leading-tight tracking-tight text-text mb-[2vh]">[Founder 02 Name]</div>
          <div className="font-body text-[1.5vw] text-text/80 leading-snug">[One-line background — supply chain, retail, growth.]</div>
        </div>
      </div>
    </div>
  );
}
