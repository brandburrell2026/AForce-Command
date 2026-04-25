export default function Flywheel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">16 — Revenue Flywheel</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">16 / 28</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] w-[40vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[4vw] bg-blue" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-blue font-semibold">Hybrid CPG + SaaS</span>
        </div>
        <h2 className="font-display text-[3.8vw] leading-[1] tracking-tighter text-balance">
          The AForce <span className="text-blue">revenue flywheel.</span>
        </h2>
      </div>

      <div className="absolute top-[40vh] bottom-[6vh] left-[6vw] w-[38vw] flex flex-col justify-start">
        <p className="font-body text-[1.25vw] text-text/85 leading-snug mb-[2.4vh]">
          <span className="text-text font-semibold">Products</span> acquire customers <span className="text-muted">→</span> <span className="text-text font-semibold">OS</span> converts them to subscribers <span className="text-muted">→</span> <span className="text-text font-semibold">Data</span> drives retention <span className="text-muted">→</span> <span className="text-text font-semibold">Lifetime value</span> compounds.
        </p>
        <div className="bg-bg-elev rounded-lg border-l-2 border-blue p-[1.4vw]">
          <div className="font-body text-[1.05vw] text-text/85 leading-snug">
            AForce turns product customers into high-margin subscribers — where data, behavior, and performance insights drive compounding lifetime value.
          </div>
        </div>
      </div>

      <div className="absolute top-[13vh] bottom-[6vh] right-[6vw] w-[46vw]">
        <div className="flex flex-col gap-[1.4vh] h-full justify-end">
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.4vw] text-blue shrink-0 mt-[0.2vh]">01</div>
            <div>
              <div className="font-display text-[1.4vw] text-text mb-[0.4vh]">DTC Subscriptions</div>
              <div className="font-body text-[1.05vw] text-text/65 leading-snug">Shopify bundles · Hydration sticks · Highest gross margins · Direct ownership.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.4vw] text-blue shrink-0 mt-[0.2vh]">02</div>
            <div>
              <div className="font-display text-[1.4vw] text-text mb-[0.4vh]">Retail Distribution</div>
              <div className="font-body text-[1.05vw] text-text/65 leading-snug">Premium grocery · Specialty wellness · Gyms · Performance retailers.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-text/10 flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.4vw] text-blue shrink-0 mt-[0.2vh]">03</div>
            <div>
              <div className="font-display text-[1.4vw] text-text mb-[0.4vh]">Amazon Marketplace</div>
              <div className="font-body text-[1.05vw] text-text/65 leading-snug">Search-driven growth · High repeat purchase · Efficient CAC.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-accent/40 flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.4vw] text-accent shrink-0 mt-[0.2vh]">04</div>
            <div>
              <div className="font-display text-[1.4vw] text-text mb-[0.4vh]">AForce OS Platform <span className="text-muted text-[1.1vw]">— Subscription Layer</span></div>
              <div className="font-body text-[1.05vw] text-text/65 leading-snug">$5 / $15 / mo tiers · Real-time command engine · Personalized optimization · LTV expansion.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border border-primary/40 flex items-start gap-[1.2vw]">
            <div className="font-display text-[1.4vw] text-primary shrink-0 mt-[0.2vh]">05</div>
            <div>
              <div className="font-display text-[1.4vw] text-text mb-[0.4vh]">Performance Intelligence Platform</div>
              <div className="font-body text-[1.05vw] text-text/65 leading-snug">Personalized insights · Habit formation · Ecosystem lock-in · LTV compounding.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
