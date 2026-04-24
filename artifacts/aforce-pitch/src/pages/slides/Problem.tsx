export default function Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">03 — Problem</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">03 / 15</div>
      </div>

      <div className="absolute top-[22vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[70vw]">
          Performance is reactive.
        </h2>
        <p className="mt-[3vh] font-body text-[1.6vw] font-light text-muted max-w-[55vw] text-pretty">
          Three failures the category has lived with for too long.
        </p>
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-3 gap-[3vw]">
          <div>
            <div className="font-display text-[2.5vw] text-primary mb-[1.5vh]">01</div>
            <div className="h-[1px] w-full bg-divider mb-[2vh]" />
            <p className="font-body text-[1.5vw] font-medium text-text/90 text-pretty leading-snug">
              Hydration drinks have not changed in thirty years.
            </p>
          </div>
          <div>
            <div className="font-display text-[2.5vw] text-primary mb-[1.5vh]">02</div>
            <div className="h-[1px] w-full bg-divider mb-[2vh]" />
            <p className="font-body text-[1.5vw] font-medium text-text/90 text-pretty leading-snug">
              Wearables track. They never intervene.
            </p>
          </div>
          <div>
            <div className="font-display text-[2.5vw] text-primary mb-[1.5vh]">03</div>
            <div className="h-[1px] w-full bg-divider mb-[2vh]" />
            <p className="font-body text-[1.5vw] font-medium text-text/90 text-pretty leading-snug">
              Recovery is sold as luxury, not built as system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
