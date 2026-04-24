export default function Market() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">11 — Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">11 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Three categories. One intersection.
        </h2>
      </div>

      <div className="absolute bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Functional beverages</div>
          <div className="font-display text-[6vw] leading-none text-text">$200B+</div>
          <div className="h-[2px] w-full bg-primary my-[2vh]" />
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Fastest-growing slice of global beverage. Premium hydration leads.</p>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Wearable tech</div>
          <div className="font-display text-[6vw] leading-none text-text">$60B+</div>
          <div className="h-[2px] w-full bg-accent my-[2vh]" />
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Saturated in tracking. Wide open in intervention.</p>
        </div>
        <div>
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Recovery wellness</div>
          <div className="font-display text-[6vw] leading-none text-text">$50B+</div>
          <div className="h-[2px] w-full bg-primary my-[2vh]" />
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Cold plunges to red light. No connective tissue.</p>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] text-center">
        <p className="font-body text-[1.5vw] text-muted">Sizes are directional industry estimates. AForce sits at the intersection of all three.</p>
      </div>
    </div>
  );
}
