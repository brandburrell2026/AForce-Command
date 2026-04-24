export default function Market() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">15 — Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">15 / 19</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6.5vw] leading-[0.95] tracking-tighter text-balance max-w-[75vw]">
          The new hydration economy.
        </h2>
        <p className="mt-[2vh] font-body text-[1.6vw] text-text/75 max-w-[55vw] leading-snug">
          Three tides moving in the same direction.
        </p>
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[2vh]">Functional Beverages</div>
          <div className="font-display text-[6vw] leading-none text-text">$200B+</div>
          <div className="h-[2px] w-full bg-primary mt-[2vh] mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Fastest-growing slice of global beverage. Premium hydration leads it.</div>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[2vh]">Sports Drinks</div>
          <div className="font-display text-[6vw] leading-none text-text">$30B+</div>
          <div className="h-[2px] w-full bg-blue mt-[2vh] mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Owned by sugar legacy brands. Wide open at the clean, alkaline end.</div>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[2vh]">Hydration Mixes</div>
          <div className="font-display text-[6vw] leading-none text-text">$5B+</div>
          <div className="h-[2px] w-full bg-accent mt-[2vh] mb-[2vh]" />
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Stick category exploding. No alkaline, sea-functional player at scale.</div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] text-center font-body text-[1.5vw] text-muted">
        Sizes are directional industry estimates. AForce sits at the intersection of all three.
      </div>
    </div>
  );
}
