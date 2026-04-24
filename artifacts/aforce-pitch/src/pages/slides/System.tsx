export default function System() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">05 — System</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">05 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Drink. OS. Band. <span className="text-accent">One loop.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[3vw]">
        <div className="bg-bg-elev/60 border border-divider rounded-sm p-[3vh]">
          <div className="h-[3px] w-[3vw] bg-primary mb-[2vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Pillar 01</div>
          <div className="font-display text-[2.8vw] leading-tight text-text mb-[1.5vh]">The Drink</div>
          <p className="font-body text-[1.5vw] font-light text-text/75 leading-snug text-pretty">
            Clean formula. Built for output, not advertising.
          </p>
        </div>
        <div className="bg-bg-elev/60 border border-divider rounded-sm p-[3vh]">
          <div className="h-[3px] w-[3vw] bg-accent mb-[2vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Pillar 02</div>
          <div className="font-display text-[2.8vw] leading-tight text-text mb-[1.5vh]">The OS</div>
          <p className="font-body text-[1.5vw] font-light text-text/75 leading-snug text-pretty">
            Reads your state. Routes hydration, recovery, action.
          </p>
        </div>
        <div className="bg-bg-elev/60 border border-divider rounded-sm p-[3vh]">
          <div className="h-[3px] w-[3vw] bg-primary mb-[2vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Pillar 03</div>
          <div className="font-display text-[2.8vw] leading-tight text-text mb-[1.5vh]">The Band</div>
          <p className="font-body text-[1.5vw] font-light text-text/75 leading-snug text-pretty">
            Feedback you can feel. Closes the loop physically.
          </p>
        </div>
      </div>
    </div>
  );
}
