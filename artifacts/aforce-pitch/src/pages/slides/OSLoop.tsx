export default function OSLoop() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">12 — The Loop</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 24</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[2vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">Hardware + Software</span>
        </div>
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter">
          One closed loop. Compounding data.
        </h2>
      </div>

      <div className="absolute top-[36vh] bottom-[6vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3" markerHeight="3" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8C8C9E" />
              </marker>
            </defs>
            <path d="M 30 18 L 70 18" stroke="#8C8C9E" strokeWidth="0.4" strokeDasharray="1.2 1.2" fill="none" markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />
            <path d="M 82 32 L 82 68" stroke="#8C8C9E" strokeWidth="0.4" strokeDasharray="1.2 1.2" fill="none" markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />
            <path d="M 70 82 L 30 82" stroke="#8C8C9E" strokeWidth="0.4" strokeDasharray="1.2 1.2" fill="none" markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />
            <path d="M 18 68 L 18 32" stroke="#8C8C9E" strokeWidth="0.4" strokeDasharray="1.2 1.2" fill="none" markerEnd="url(#arrow)" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="absolute top-0 left-0 w-[26%] bg-bg-elev border border-blue/40 rounded-lg p-[1.2vw]">
            <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-blue mb-[0.6vh]">01 — Drink</div>
            <div className="font-display text-[1.7vw] leading-tight text-text">A can or a stick.</div>
            <div className="font-body text-[1vw] text-text/65 mt-[0.4vh] leading-snug">pH 8.8 hydration enters the body.</div>
          </div>

          <div className="absolute top-0 right-0 w-[26%] bg-bg-elev border border-accent/40 rounded-lg p-[1.2vw]">
            <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-accent mb-[0.6vh]">02 — Score</div>
            <div className="font-display text-[1.7vw] leading-tight text-text">Body becomes data.</div>
            <div className="font-body text-[1vw] text-text/65 mt-[0.4vh] leading-snug">Intake, sweat, and weather feed the score.</div>
          </div>

          <div className="absolute bottom-0 right-0 w-[26%] bg-bg-elev border border-primary/40 rounded-lg p-[1.2vw]">
            <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-primary mb-[0.6vh]">03 — Coach</div>
            <div className="font-display text-[1.7vw] leading-tight text-text">AI calls the move.</div>
            <div className="font-body text-[1vw] text-text/65 mt-[0.4vh] leading-snug">Mode-aware voice, one-tap action.</div>
          </div>

          <div className="absolute bottom-0 left-0 w-[26%] bg-bg-elev border border-text/30 rounded-lg p-[1.2vw]">
            <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-text mb-[0.6vh]">04 — Decide</div>
            <div className="font-display text-[1.7vw] leading-tight text-text">Drink the next one.</div>
            <div className="font-body text-[1vw] text-text/65 mt-[0.4vh] leading-snug">The loop tightens with every cycle.</div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14vw] h-[14vw] rounded-full bg-bg-elev border-2 border-accent flex items-center justify-center">
            <div className="text-center">
              <div className="font-display text-[2.2vw] leading-none text-accent">AForce</div>
              <div className="font-body uppercase tracking-[0.25em] text-[1vw] text-text/70 mt-[0.8vh]">The system</div>
              <div className="font-body uppercase tracking-[0.2em] text-[0.75vw] text-muted mt-[0.6vh]">Circles · Territory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
