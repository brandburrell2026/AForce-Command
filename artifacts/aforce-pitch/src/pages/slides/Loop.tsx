export default function Loop() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">09 — Formats</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">09 / 19</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6.5vw] leading-[0.95] tracking-tighter text-balance max-w-[75vw]">
          Anytime. <span className="text-accent">Anywhere.</span>
        </h2>
        <p className="mt-[2vh] font-body text-[1.6vw] text-text/75 max-w-[55vw] leading-snug">
          Two formats so the same hydration goes everywhere you do.
        </p>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[4vw]">
        <div className="bg-bg-elev rounded-md p-[3vw] flex gap-[2vw] items-center">
          <img src={`${base}can-soursop.png`} alt="" className="h-[40vh] object-contain shrink-0" />
          <div className="flex-1">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1.5vh] font-semibold">Format 01</div>
            <div className="font-display text-[3.5vw] leading-tight tracking-tight text-text mb-[1.5vh]">The Can.</div>
            <div className="font-body text-[1.5vw] text-text/80 leading-snug">11oz / 325ml. Ready cold. Built for the fridge, the gym bag, and the checkout cooler.</div>
          </div>
        </div>
        <div className="bg-bg-elev rounded-md p-[3vw] flex gap-[2vw] items-center">
          <img src={`${base}stick-watermelon.png`} alt="" className="h-[40vh] object-contain shrink-0" />
          <div className="flex-1">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-primary mb-[1.5vh] font-semibold">Format 02</div>
            <div className="font-display text-[3.5vw] leading-tight tracking-tight text-text mb-[1.5vh]">The Stick.</div>
            <div className="font-body text-[1.5vw] text-text/80 leading-snug">14g / 0.49oz. Pocket-sized. Drops into any bottle. Travel, office, hotel, hike.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
