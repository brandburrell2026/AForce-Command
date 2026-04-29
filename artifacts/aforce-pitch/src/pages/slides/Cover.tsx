export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-y-0 right-0 w-[55vw] flex items-center justify-center">
        <div
          className="absolute w-[42vw] h-[42vw] rounded-full opacity-55 blur-[7vw]"
          style={{ background: "radial-gradient(circle, rgba(84,120,213,0.65) 0%, rgba(84,120,213,0.18) 45%, transparent 72%)" }}
        />
        <div
          className="absolute bottom-[8vh] w-[28vw] h-[3vh] rounded-[50%] blur-[2vw] opacity-70"
          style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, transparent 70%)" }}
        />
        <img
          src={`${base}can-berry.png`}
          alt=""
          className="relative h-[86vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 80px rgba(84,120,213,0.35))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[58vw] pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--slide-bg) 60%, transparent 100%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">01 — Cover</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-muted">1 / 25</div>
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
      </div>
    </div>
  );
}
