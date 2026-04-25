export default function Funding() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">26 — Funding Strategy</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">26 / 28</div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 75% 50%, rgba(229,51,65,0.18) 0%, transparent 55%)" }}
      />

      <div className="absolute top-[16vh] left-[6vw] right-[6vw] grid grid-cols-[1.2fr_1fr] gap-[4vw]">
        <div>
          <div className="flex items-center gap-[1.2vw] mb-[3vh]">
            <div className="h-[2px] w-[5vw] bg-primary" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">Strategic Investment Opportunity</span>
          </div>
          <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter text-balance">
            AForce funding strategy — <span className="text-primary">$4M Seed.</span>
          </h2>
          <p className="mt-[3vh] font-body text-[1.35vw] text-text/75 max-w-[44vw] leading-snug">
            AForce is raising a Seed round to support the launch and scale of its hydration and functional wellness platform — riding strong consumer demand for clean, performance-oriented products.
          </p>
        </div>

        <div className="bg-bg-elev rounded-lg p-[2vw] border border-text/10 self-center">
          <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-muted mb-[2vh]">Round Details</div>
          <div className="space-y-[2.2vh]">
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.95vw] text-muted">Instrument</div>
              <div className="font-display text-[1.7vw] text-text mt-[0.4vh]">Series Seed Preferred</div>
            </div>
            <div className="h-[1px] bg-divider" />
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.95vw] text-muted">Round Size</div>
              <div className="font-display text-[3vw] leading-none text-primary mt-[0.4vh]">$4M</div>
            </div>
            <div className="h-[1px] bg-divider" />
            <div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.95vw] text-muted">Target Close</div>
              <div className="font-display text-[1.7vw] text-text mt-[0.4vh]">Q1 2026</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[8vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[2vw]">
        <div className="bg-bg-elev rounded-md p-[1.6vw] border-t-2 border-primary">
          <div className="font-display text-[1.7vw] text-text mb-[1vh]">Market Timing</div>
          <div className="font-body text-[1.15vw] text-text/70 leading-snug">Consumers are rapidly shifting toward clean-label, performance-focused beverages — aligning directly with AForce&apos;s alkaline + superfood approach.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.6vw] border-t-2 border-blue">
          <div className="font-display text-[1.7vw] text-text mb-[1vh]">Proven Team</div>
          <div className="font-body text-[1.15vw] text-text/70 leading-snug">Experienced leadership with track record of success in scaling operations and building consumer brands.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.6vw] border-t-2 border-accent">
          <div className="font-display text-[1.7vw] text-text mb-[1vh]">Long-Term Optionality</div>
          <div className="font-body text-[1.15vw] text-text/70 leading-snug">As AForce grows, partnerships with retailers, wellness brands, and industry participants become natural strategic options.</div>
        </div>
      </div>
    </div>
  );
}
