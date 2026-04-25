export default function Mission() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body flex flex-col justify-center px-[8vw]">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">02 — Mission</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">02 / 23</div>
      </div>

      <div className="flex items-center gap-[1.2vw] mb-[4vh]">
        <div className="h-[2px] w-[5vw] bg-accent" />
        <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Mission</span>
      </div>
      <h2 className="font-display text-[8vw] leading-[0.92] tracking-tighter text-balance max-w-[80vw]">
        Hydration that fuels output. Not advertising.
      </h2>
      <p className="mt-[5vh] font-body text-[2vw] font-light text-text/80 max-w-[55vw] text-pretty leading-snug">
        Clean formula. Alkaline base. Functional ingredients pulled from the sea. Built for athletes, finishers, and anyone who refuses to coast.
      </p>
    </div>
  );
}
