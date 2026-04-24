export default function Ask() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-0 bg-gradient-to-tr from-bg via-bg to-bg-elev/40" />
      <div className="absolute top-[40vh] left-[40vw] w-[30vw] h-[30vh] bg-primary/15 blur-[140px] rounded-full" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">15 — Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">15 / 15</div>
      </div>

      <div className="absolute top-[22vh] left-[6vw] right-[6vw]">
        <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[2vh] font-semibold">Raising</div>
        <h2 className="font-display text-[12vw] leading-[0.88] tracking-tighter text-text">
          $[X]M Seed
        </h2>
        <p className="mt-[3vh] font-body text-[1.7vw] font-light text-text/80 max-w-[60vw] text-pretty">
          To launch the drink, ship the OS, and close the loop with Phantom Band.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] flex justify-between items-end">
        <div>
          <div className="h-[2px] w-[5vw] bg-primary mb-[2vh]" />
          <div className="font-display text-[3vw] leading-tight text-text">Become AForce.</div>
        </div>
        <div className="text-right font-body text-[1.5vw] text-muted">
          <div>[founders@aforce.com]</div>
          <div className="mt-[0.5vh]">aforce.com</div>
        </div>
      </div>
    </div>
  );
}
