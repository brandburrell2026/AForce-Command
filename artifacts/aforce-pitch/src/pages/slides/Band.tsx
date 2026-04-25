export default function Band() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">08 — Soursop Edge</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">08 / 19</div>
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[45vw] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(245,214,55,0.22) 0%, transparent 65%)" }}
      />

      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative flex items-center justify-center">
          <img src={`${base}can-soursop.png`} alt="" className="h-[78vh] object-contain drop-shadow-2xl relative z-10 -translate-x-[10%]" />
          <img src={`${base}stick-soursop.png`} alt="" className="absolute h-[58vh] object-contain drop-shadow-2xl translate-x-[58%] translate-y-[2%] rotate-[8deg]" />
        </div>
        <div className="flex flex-col justify-center pr-[6vw]">
          <div className="h-[2px] w-[4vw] bg-accent mb-[3vh]" />
          <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent mb-[2vh] font-semibold">Flavor 03</div>
          <h2 className="font-display text-[6.5vw] leading-[0.92] tracking-tighter">
            Soursop Edge.
          </h2>
          <p className="mt-[3vh] font-body text-[1.8vw] text-text/85 max-w-[35vw] leading-snug text-pretty">
            Tropical soursop layered with <span className="text-accent font-semibold">Sea Moss</span>. An ocean-grown botanical long valued for its mineral profile.
          </p>
          <div className="mt-[4vh] flex flex-col gap-[1.8vh] max-w-[35vw]">
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-accent mt-[0.4vh] shrink-0">01</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">Sea moss is rich in iodine, magnesium, zinc, and selenium — minerals the body uses every day.</div>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-accent mt-[0.4vh] shrink-0">02</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">Soursop is naturally sweet — bright tropical flavor with no added sugar.</div>
            </div>
            <div className="flex items-start gap-[1.2vw]">
              <div className="font-display text-[1.8vw] text-accent mt-[0.4vh] shrink-0">03</div>
              <div className="font-body text-[1.5vw] text-text/85 leading-snug">325ml can. 14g stick. pH 8.8. No added sugar.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
