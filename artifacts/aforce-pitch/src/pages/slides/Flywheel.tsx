export default function Flywheel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 50% at 78% 60%, rgba(245,214,55,0.13) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 22% 70%, rgba(84,120,213,0.12) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">13 — Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 22</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Hybrid CPG + SaaS</span>
          </div>
          <h2 className="font-display text-[4.2vw] leading-[0.92] tracking-tighter whitespace-nowrap">
            <span className="text-text/55">5:1</span>
            <span className="text-text/35 mx-[0.6vw]">→</span>
            <span className="text-accent">21:1.</span>
            <span className="text-text"> The OS multiplier.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          CPG-grade unit economics compound when paired with the $5–$50/mo AForce OS subscription.
        </p>
      </div>

      <div className="absolute top-[32vh] bottom-[26vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full flex flex-col justify-center gap-[5.5vh]">

          <div className="relative">
            <div className="flex items-baseline justify-between mb-[1.4vh]">
              <div className="flex items-baseline gap-[1vw]">
                <span className="font-body uppercase tracking-[0.32em] text-[1vw] text-text/75">CPG Only</span>
                <span className="font-body text-[0.95vw] text-text/45">$52 AOV · 65% gross margin · DTC + Retail + Amazon</span>
              </div>
            </div>
            <div className="flex items-center gap-[1.6vw]">
              <div className="relative h-[3.6vh] flex-1 bg-bg-elev rounded-md overflow-hidden border border-text/8">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${(5 / 21) * 100}%`,
                    background: "linear-gradient(to right, rgba(84,120,213,0.55), #5478D5)",
                    boxShadow: "0 0 24px rgba(84,120,213,0.45)",
                  }}
                />
              </div>
              <div className="flex items-baseline gap-[0.5vw] w-[10vw] justify-end">
                <div className="font-display text-[3.2vw] text-blue leading-none">5:1</div>
                <div className="font-body uppercase tracking-[0.24em] text-[0.8vw] text-text/55">LTV:CAC</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="flex items-baseline justify-between mb-[1.4vh]">
              <div className="flex items-baseline gap-[1vw]">
                <span className="font-body uppercase tracking-[0.32em] text-[1vw] text-accent">CPG + OS Bundle</span>
                <span className="font-body text-[0.95vw] text-text/45">+ $5 / $15 / $50 mo subscription · 90%+ digital margin · ecosystem lock-in</span>
              </div>
            </div>
            <div className="flex items-center gap-[1.6vw]">
              <div className="relative h-[5.4vh] flex-1 bg-bg-elev rounded-md overflow-hidden border border-text/8">
                <div
                  className="h-full rounded-md relative"
                  style={{
                    width: "100%",
                    background: "linear-gradient(to right, #5478D5 0%, #5478D5 22%, #8AB4D4 35%, #F5D637 90%, #F5E37A 100%)",
                    boxShadow: "0 0 36px rgba(245,214,55,0.4)",
                  }}
                >
                  <div className="absolute inset-y-0 w-px bg-bg/70" style={{ left: `${(5 / 21) * 100}%` }} />
                  <div
                    className="absolute -top-[2.4vh] font-body uppercase tracking-[0.28em] text-[0.78vw] text-text/55 whitespace-nowrap"
                    style={{ left: `${(5 / 21) * 100}%`, transform: "translateX(-50%)" }}
                  >
                    ← CPG │ + OS →
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-[0.5vw] w-[10vw] justify-end">
                <div className="font-display text-[5.2vw] text-accent leading-none">21:1</div>
              </div>
            </div>
            <div className="absolute -bottom-[5vh] right-[1vw] flex items-baseline gap-[0.6vw]">
              <div className="font-display text-[1.6vw] text-accent leading-none">4.2×</div>
              <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-text/55">Unit-economics leverage</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[14vh] left-[6vw] right-[6vw] flex items-baseline justify-between gap-[2vw]">
        <div className="flex items-baseline gap-[0.6vw]">
          <span className="font-display text-[2.2vw] text-text leading-none">$52</span>
          <span className="font-body uppercase tracking-[0.24em] text-[0.82vw] text-text/55">Blended AOV</span>
        </div>
        <div className="w-[1px] h-[2.5vh] bg-divider" />
        <div className="flex items-baseline gap-[0.6vw]">
          <span className="font-display text-[2.2vw] text-text leading-none">$383</span>
          <span className="font-body uppercase tracking-[0.24em] text-[0.82vw] text-text/55">Blended CLTV · 12–18 mo</span>
        </div>
        <div className="w-[1px] h-[2.5vh] bg-divider" />
        <div className="flex items-baseline gap-[0.6vw]">
          <span className="font-display text-[2.2vw] text-blue leading-none">65%</span>
          <span className="font-body uppercase tracking-[0.24em] text-[0.82vw] text-text/55">Gross Margin · CPG</span>
        </div>
        <div className="w-[1px] h-[2.5vh] bg-divider" />
        <div className="flex items-baseline gap-[0.6vw]">
          <span className="font-display text-[2.2vw] text-accent leading-none">90%+</span>
          <span className="font-body uppercase tracking-[0.24em] text-[0.82vw] text-text/55">OS Digital Margin</span>
        </div>
      </div>

      <div className="absolute bottom-[4vh] left-[6vw] right-[6vw] border-t border-divider pt-[1.6vh]">
        <div className="flex items-baseline gap-[1.2vw] flex-wrap">
          <span className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-muted">Revenue Stack</span>
          <span className="font-body text-[0.98vw]">
            <span className="text-text">DTC Subscriptions</span>
            <span className="text-text/35 mx-[0.7vw]">·</span>
            <span className="text-text">Retail</span>
            <span className="text-text/35 mx-[0.7vw]">·</span>
            <span className="text-text">Amazon</span>
            <span className="text-text/35 mx-[0.7vw]">·</span>
            <span className="text-accent">AForce OS</span>
            <span className="text-text/35 mx-[0.7vw]">·</span>
            <span className="text-primary">Performance Platform</span>
          </span>
        </div>
      </div>
    </div>
  );
}
