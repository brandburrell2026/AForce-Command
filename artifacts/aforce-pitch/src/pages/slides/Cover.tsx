export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-y-0 right-0 w-[55vw] flex items-center justify-center">
        <div
          className="absolute w-[36vw] h-[36vw] rounded-full opacity-40 blur-[6vw]"
          style={{ background: "radial-gradient(circle, rgba(84,120,213,0.55) 0%, transparent 70%)" }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[88vh] object-contain drop-shadow-2xl"
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[55vw] pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--slide-bg) 55%, transparent 100%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">01 — Cover</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">01 / 19</div>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[55vw] z-10">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">Performance Alkaline Hydration</span>
        </div>
        <h1 className="font-display text-[12vw] leading-[0.85] tracking-tighter text-text">
          AForce.
        </h1>
        <p className="mt-[3vh] font-body text-[2vw] font-light text-text/80 max-w-[42vw] text-pretty">
          Fuel your body with alkaline power.
        </p>
        <div className="mt-[5vh] font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">
          pH 8.8  ·  No added sugar  ·  Sea-derived functionals
        </div>
      </div>
    </div>
  );
}
