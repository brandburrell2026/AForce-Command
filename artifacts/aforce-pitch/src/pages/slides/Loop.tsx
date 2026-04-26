export default function Loop() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute top-[15vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-primary/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-blue/[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">10 — Formats</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">10 / 27</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">Two Formats · One System</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">Anytime. </span>
          <span className="text-accent">Anywhere.</span>
        </h1>
        <div className="font-body text-[1.1vw] text-text/60 mt-[1.6vh] max-w-[78vw] leading-tight">
          Same hydration. Two travel-ready formats.{" "}
          <span className="text-text/85">Cans for the cooler, sticks for the road — designed to follow you through the day.</span>
        </div>
      </div>

      <div className="absolute top-[40vh] bottom-[20vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw] z-10">

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[2vw] flex items-center gap-[1.2vw] overflow-hidden min-w-0">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-accent" />
          <div className="flex items-end shrink-0">
            <img src={`${base}can-soursop.png`} alt="" className="h-[26vh] object-contain drop-shadow-2xl" />
            <img src={`${base}stick-soursop.png`} alt="" className="h-[19vh] object-contain drop-shadow-2xl -ml-[1.2vw]" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-accent font-semibold mb-[1.2vh]">Format 01 · Ready Cold</div>
            <div className="font-display text-[3.2vw] leading-[1] tracking-tight text-text mb-[1vh]">The <span className="text-accent">Can.</span></div>
            <div className="font-display text-[1.4vw] text-accent leading-none mb-[1.4vh]">11oz · 325ml</div>
            <div className="font-body text-[1vw] text-text/75 leading-snug mb-auto">Built for the fridge, the gym bag, and the checkout cooler. Premium grab-and-go.</div>
            <div className="pt-[1.4vh] border-t border-accent/20 mt-[1.6vh]">
              <div className="font-body text-[0.8vw] text-text/55 uppercase tracking-[0.22em]">Cooler · Gym · Checkout</div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.16] via-primary/[0.05] to-transparent border border-primary/35 p-[2vw] flex items-center gap-[1.2vw] overflow-hidden min-w-0">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-primary" />
          <div className="flex items-end shrink-0">
            <img src={`${base}can-watermelon.png`} alt="" className="h-[18vh] object-contain drop-shadow-2xl" />
            <img src={`${base}stick-watermelon.png?v=5`} alt="" className="h-[30vh] object-contain drop-shadow-2xl -ml-[1vw]" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-primary font-semibold mb-[1.2vh]">Format 02 · Pocket-Sized</div>
            <div className="font-display text-[3.2vw] leading-[1] tracking-tight text-text mb-[1vh]">The <span className="text-primary">Stick.</span></div>
            <div className="font-display text-[1.4vw] text-primary leading-none mb-[1.4vh]">14g · 0.49oz</div>
            <div className="font-body text-[1vw] text-text/75 leading-snug mb-auto">Drops into any bottle. Goes anywhere a can can't — travel, office, hotel, hike.</div>
            <div className="pt-[1.4vh] border-t border-primary/20 mt-[1.6vh]">
              <div className="font-body text-[0.8vw] text-text/55 uppercase tracking-[0.22em]">Travel · Office · Trail</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-blue font-semibold">One System</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] grid grid-cols-[1.4fr_1fr] gap-[2vw] items-baseline">
          <h3 className="font-display text-[2.1vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            Same <span className="text-primary">hydration.</span> Every <span className="text-accent">moment.</span> From the cooler to the carry-on.
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Ships in both formats<br/>
            Spring 2026 · day one
          </div>
        </div>
      </div>
    </div>
  );
}
