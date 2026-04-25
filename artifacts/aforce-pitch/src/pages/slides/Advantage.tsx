export default function Advantage() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">20 — Competitive Advantage</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">20 / 29</div>
      </div>

      <div
        className="absolute inset-y-0 right-0 w-[40vw] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at right center, rgba(84,120,213,0.15) 0%, transparent 60%)" }}
      />

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-blue" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">The Moat</span>
        </div>
        <h2 className="font-display text-[6vw] leading-[0.95] tracking-tighter text-balance">
          AForce competitive <span className="text-blue">advantage.</span>
        </h2>
      </div>

      <div className="absolute bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-x-[3vw] gap-y-[3vh]">
        <div className="flex items-start gap-[1.2vw]">
          <div className="font-display text-[2vw] text-blue shrink-0 mt-[0.2vh]">01</div>
          <div>
            <div className="font-display text-[2vw] text-text mb-[0.8vh]">Performance Intelligence Platform</div>
            <div className="font-body text-[1.25vw] text-text/70 leading-snug">The only hydration brand powered by a real-time performance engine that tracks, learns, and optimizes user behavior.</div>
          </div>
        </div>
        <div className="flex items-start gap-[1.2vw]">
          <div className="font-display text-[2vw] text-blue shrink-0 mt-[0.2vh]">02</div>
          <div>
            <div className="font-display text-[2vw] text-text mb-[0.8vh]">Closed-Loop Data System</div>
            <div className="font-body text-[1.25vw] text-text/70 leading-snug">Every user interaction feeds AForce OS — continuously improving recommendations, outcomes, and retention.</div>
          </div>
        </div>
        <div className="flex items-start gap-[1.2vw]">
          <div className="font-display text-[2vw] text-blue shrink-0 mt-[0.2vh]">03</div>
          <div>
            <div className="font-display text-[2vw] text-text mb-[0.8vh]">Multi-Format Product Ecosystem</div>
            <div className="font-body text-[1.25vw] text-text/70 leading-snug">Hydration sticks, RTD beverages, and functional formats designed to drive daily usage and data capture.</div>
          </div>
        </div>
        <div className="flex items-start gap-[1.2vw]">
          <div className="font-display text-[2vw] text-blue shrink-0 mt-[0.2vh]">04</div>
          <div>
            <div className="font-display text-[2vw] text-text mb-[0.8vh]">Premium Functional Formulation</div>
            <div className="font-body text-[1.25vw] text-text/70 leading-snug">Clean-label, mineral-based hydration with clinically relevant ingredients for performance, recovery, and longevity.</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] text-center">
        <span className="font-body text-[1.4vw] text-blue uppercase tracking-[0.25em]">
          Only hydration brand building a real-time performance operating system.
        </span>
      </div>
    </div>
  );
}
