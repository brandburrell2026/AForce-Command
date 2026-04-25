export default function System() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">06 — Product</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">06 / 22</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw] z-10">
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance">
          Three flavors. <span className="text-accent">Two formats.</span>
        </h2>
        <p className="mt-[2vh] font-body text-[1.6vw] text-text/75 max-w-[55vw] leading-snug">
          A complete system for hydration that travels with you.
        </p>
      </div>

      <div className="absolute bottom-[6vh] left-[4vw] right-[4vw] grid grid-cols-3 gap-[2vw]">
        <div className="flex flex-col items-center">
          <div className="relative h-[55vh] flex items-end justify-center gap-[1vw]">
            <img src={`${base}can-berry.png`} alt="" className="h-[50vh] object-contain" />
            <img src={`${base}stick-berry.png`} alt="" className="h-[40vh] object-contain" />
          </div>
          <div className="mt-[2vh] text-center">
            <div className="h-[2px] w-[3vw] bg-blue mx-auto mb-[1vh]" />
            <div className="font-display text-[2vw] text-text">Berry Blast</div>
            <div className="font-body text-[1.5vw] text-blue uppercase tracking-[0.25em]">+ Dulse</div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="relative h-[55vh] flex items-end justify-center gap-[1vw]">
            <img src={`${base}can-watermelon.png`} alt="" className="h-[50vh] object-contain" />
            <img src={`${base}stick-watermelon.png`} alt="" className="h-[40vh] object-contain" />
          </div>
          <div className="mt-[2vh] text-center">
            <div className="h-[2px] w-[3vw] bg-primary mx-auto mb-[1vh]" />
            <div className="font-display text-[2vw] text-text">Watermelon Surge</div>
            <div className="font-body text-[1.5vw] text-primary uppercase tracking-[0.25em]">+ Chlorella</div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="relative h-[55vh] flex items-end justify-center gap-[1vw]">
            <img src={`${base}can-soursop.png`} alt="" className="h-[50vh] object-contain" />
            <img src={`${base}stick-soursop.png`} alt="" className="h-[40vh] object-contain" />
          </div>
          <div className="mt-[2vh] text-center">
            <div className="h-[2px] w-[3vw] bg-accent mx-auto mb-[1vh]" />
            <div className="font-display text-[2vw] text-text">Soursop Edge</div>
            <div className="font-body text-[1.5vw] text-accent uppercase tracking-[0.25em]">+ Seamoss</div>
          </div>
        </div>
      </div>
    </div>
  );
}
