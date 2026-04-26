export default function Band() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[10vh] -left-[10vw] w-[55vw] h-[55vw] rounded-full bg-accent/[0.16] blur-[140px] pointer-events-none" />
      <div className="absolute top-[40vh] -left-[5vw] w-[40vw] h-[40vw] rounded-full bg-accent/[0.12] blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20vh] -right-[15vw] w-[50vw] h-[50vw] rounded-full bg-blue/[0.05] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/30 to-bg/70 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">09 — Soursop Edge</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">09 / 26</div>
      </div>

      <div className="absolute inset-0 grid grid-cols-2 z-10">
        <div className="relative flex items-center justify-center">
          <img src={`${base}can-soursop.png`} alt="" className="h-[78vh] object-contain drop-shadow-2xl relative z-10 -translate-x-[10%]" />
          <img src={`${base}stick-soursop.png`} alt="" className="absolute h-[58vh] object-contain drop-shadow-2xl translate-x-[58%] translate-y-[2%] rotate-[8deg]" />
        </div>

        <div className="flex flex-col justify-center pr-[6vw] pt-[6vh] pb-[8vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-accent font-semibold">Flavor 03 · 92 Minerals · One Plant</div>
          </div>
          <h2 className="font-display text-[6.4vw] leading-[0.9] tracking-tighter text-balance">
            <span className="text-text">Soursop </span>
            <span className="text-accent">Edge.</span>
          </h2>
          <p className="mt-[2.4vh] font-body text-[1.4vw] text-text/80 max-w-[36vw] leading-snug text-pretty">
            Tropical soursop layered with <span className="text-accent font-semibold">Sea Moss</span>.{" "}
            <span className="text-text">An ocean-grown botanical long valued for its complete mineral profile.</span>
          </p>

          <div className="mt-[3.2vh] flex flex-col gap-[1.2vh] max-w-[36vw]">
            <div className="relative rounded-xl bg-gradient-to-r from-accent/[0.14] via-accent/[0.05] to-transparent border border-accent/30 px-[1.2vw] py-[1.4vh] flex items-start gap-[1vw]">
              <div className="font-display text-[1.6vw] text-accent leading-none shrink-0">01</div>
              <div className="font-body text-[1.05vw] text-text/85 leading-snug"><span className="text-text font-semibold">92 minerals · one plant.</span> Sea moss is rich in iodine, magnesium, zinc, and selenium — used by the body every day.</div>
            </div>
            <div className="relative rounded-xl bg-gradient-to-r from-accent/[0.14] via-accent/[0.05] to-transparent border border-accent/30 px-[1.2vw] py-[1.4vh] flex items-start gap-[1vw]">
              <div className="font-display text-[1.6vw] text-accent leading-none shrink-0">02</div>
              <div className="font-body text-[1.05vw] text-text/85 leading-snug"><span className="text-text font-semibold">Naturally sweet soursop.</span> Bright tropical flavor — no added sugar required.</div>
            </div>
            <div className="relative rounded-xl bg-gradient-to-r from-accent/[0.14] via-accent/[0.05] to-transparent border border-accent/30 px-[1.2vw] py-[1.4vh] flex items-start gap-[1vw]">
              <div className="font-display text-[1.6vw] text-accent leading-none shrink-0">03</div>
              <div className="font-body text-[1.05vw] text-text/85 leading-snug"><span className="text-text font-semibold">Two formats.</span> 325ml can. 14g stick. pH 8.8. No added sugar.</div>
            </div>
          </div>

          <div className="mt-[3vh] pt-[1.6vh] border-t border-accent/20 max-w-[36vw] flex justify-between items-baseline">
            <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-text/55">325ml Can · 14g Stick</div>
            <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-accent font-semibold">pH 8.8 · No Sugar</div>
          </div>
        </div>
      </div>
    </div>
  );
}
