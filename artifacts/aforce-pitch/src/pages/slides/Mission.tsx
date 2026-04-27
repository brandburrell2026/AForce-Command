export default function Mission() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 45% at 25% 35%, rgba(245,214,55,0.08) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 45% at 78% 70%, rgba(84,120,213,0.07) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-display text-[1.7vw] tracking-tight text-accent leading-none">02</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.1vw] text-muted">02 / 24</div>
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 left-[6vw] right-[6vw]">
        <h1 className="font-display text-[6.4vw] leading-[0.9] tracking-tighter text-text max-w-[78vw]">
          Performance is not a goal.
          <br />
          <span className="text-accent">It's a standard.</span>
        </h1>

        <p className="mt-[6vh] font-display text-[2.6vw] leading-tight tracking-tight text-text/85 max-w-[60vw]">
          Performance comes from <span className="text-accent">control.</span>
        </p>

        <p className="mt-[3vh] font-display text-[1.7vw] leading-tight tracking-tight text-text/55 max-w-[60vw]">
          Control your body. <span className="text-text">Control your performance.</span>
        </p>
      </div>
    </div>
  );
}
