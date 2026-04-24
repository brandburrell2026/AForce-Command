export default function OS() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">07 — Watermelon Surge</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">07 / 19</div>
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[45vw] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(229,51,65,0.22) 0%, transparent 65%)" }}
      />

      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative flex items-center justify-center">
          <img src={`${base}can-watermelon.png`} alt="" className="h-[80vh] object-contain drop-shadow-2xl" />
        </div>
        <div className="flex flex-col justify-center pr-[6vw]">
          <div className="h-[2px] w-[4vw] bg-primary mb-[3vh]" />
          <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary mb-[2vh] font-semibold">Flavor 02</div>
          <h2 className="font-display text-[6.5vw] leading-[0.92] tracking-tighter">
            Watermelon Surge.
          </h2>
          <p className="mt-[3vh] font-body text-[1.8vw] text-text/85 max-w-[35vw] leading-snug text-pretty">
            Watermelon meets <span className="text-primary font-semibold">Chlorella</span>. Naturally occurring electrolytes paired with a green-algae superfood.
          </p>
          <div className="mt-[4vh] flex flex-col gap-[1.8vh] max-w-[35vw]">
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-primary mt-[0.4vh] shrink-0">01</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">Watermelon is naturally rich in L-citrulline, a precursor amino acid studied for circulatory support.</div>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-primary mt-[0.4vh] shrink-0">02</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">Chlorella adds plant-based protein and chlorophyll — long-used in clean-fuel formulations.</div>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-primary mt-[0.4vh] shrink-0">03</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">325ml can. 14g stick. pH 8.8. No added sugar.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
