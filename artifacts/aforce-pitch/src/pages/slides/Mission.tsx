export default function Mission() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-0 bg-gradient-to-br from-bg-elev/40 via-bg to-bg" />
      <div className="absolute top-[35vh] left-[35vw] w-[30vw] h-[30vh] bg-primary/10 blur-[120px] rounded-full" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">02 — Mission</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">02 / 15</div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-center items-center px-[10vw]">
        <div className="h-[2px] w-[6vw] bg-accent mb-[5vh]" />
        <h1 className="font-display text-[8vw] leading-[0.92] tracking-tighter text-center text-balance">
          Become AForce.
        </h1>
        <p className="mt-[6vh] font-body text-[2vw] font-light text-text/70 text-center text-balance max-w-[60vw]">
          A performance system. Not another drink.
        </p>
      </div>
    </div>
  );
}
