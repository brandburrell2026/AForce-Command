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
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">01 / 24</div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[55vw] z-10">
        <div className="flex items-baseline gap-[1.4vw] mb-[2.4vh]">
          <div className="font-display text-[3.8vw] leading-none tracking-tight text-primary">AForce</div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-text/55 font-semibold">The Performance Operating System</div>
        </div>
        <h1 className="font-display text-[6.6vw] leading-[0.92] tracking-tighter text-text max-w-[44vw]">
          You don't break <span className="text-primary">under pressure.</span>
        </h1>
        <p className="mt-[2.4vh] font-display text-[2.2vw] leading-tight text-text max-w-[42vw] text-pretty">
          <span className="text-primary">Check.</span> <span className="text-accent">Act.</span> Perform.
        </p>
        <p className="mt-[1.2vh] font-body text-[1.25vw] font-light text-text/70 max-w-[42vw] leading-snug">
          Built for people who operate when others don't — a system for staying sharp, steady, and in control.
        </p>
        <div className="mt-[2.8vh] flex items-center gap-[1.2vw]">
          <div className="px-[1.2vw] py-[1vh] bg-primary/15 border border-primary/40 rounded-md">
            <div className="font-body uppercase tracking-[0.28em] text-[0.95vw] text-primary/80">Raising</div>
            <div className="font-display text-[1.8vw] text-primary leading-tight">$4M Seed</div>
          </div>
          <div className="font-body text-[1.2vw] text-text/70 leading-snug">
            <div className="text-text">Spring 2026 launch</div>
            <div className="text-muted">Aligned with America's Real Deal · Season 2</div>
          </div>
        </div>
      </div>
    </div>
  );
}
