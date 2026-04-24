const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <img
        src={`${base}title-hero.png`}
        crossOrigin="anonymous"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/85 via-bg/30 to-transparent" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">01 — Cover</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">01 / 15</div>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">A Performance OS</div>
        </div>
        <h1 className="font-display text-[15vw] leading-[0.88] tracking-tighter text-text text-balance">
          AForce.
        </h1>
        <p className="mt-[3vh] font-body text-[2.4vw] font-light text-text/85 max-w-[55vw] text-pretty">
          Built to perform.
        </p>
      </div>
    </div>
  );
}
