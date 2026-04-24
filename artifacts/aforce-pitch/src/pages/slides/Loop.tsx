export default function Loop() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">09 — Loop</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">09 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          The closed performance loop.
        </h2>
      </div>

      <div className="absolute top-[48vh] left-[6vw] right-[6vw]">
        <div className="flex items-start justify-between gap-[2vw]">
          <div className="flex-1 text-center">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">01</div>
            <div className="font-display text-[3vw] text-text mb-[1vh]">Drink</div>
            <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty">Fuel the system.</p>
          </div>
          <div className="font-display text-[2.5vw] text-primary mt-[3vh]">→</div>
          <div className="flex-1 text-center">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">02</div>
            <div className="font-display text-[3vw] text-accent mb-[1vh]">State</div>
            <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty">Read in real time.</p>
          </div>
          <div className="font-display text-[2.5vw] text-primary mt-[3vh]">→</div>
          <div className="flex-1 text-center">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">03</div>
            <div className="font-display text-[3vw] text-text mb-[1vh]">Action</div>
            <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty">Routed by the OS.</p>
          </div>
          <div className="font-display text-[2.5vw] text-primary mt-[3vh]">→</div>
          <div className="flex-1 text-center">
            <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1.5vh]">04</div>
            <div className="font-display text-[3vw] text-accent mb-[1vh]">Recover</div>
            <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty">Restored by the band.</p>
          </div>
        </div>
        <div className="mt-[7vh] flex justify-center">
          <div className="font-body uppercase tracking-[0.4em] text-[1.5vw] text-muted">— and back to drink —</div>
        </div>
      </div>
    </div>
  );
}
