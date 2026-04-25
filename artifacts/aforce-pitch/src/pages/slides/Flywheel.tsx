export default function Flywheel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">13 — Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 22</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[4vw] bg-blue" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-blue font-semibold">Hybrid CPG + SaaS</span>
        </div>
        <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter text-balance">
          The AForce <span className="text-blue">revenue flywheel.</span>
        </h2>
        <p className="mt-[1.4vh] font-body text-[1.2vw] text-text/70 max-w-[80vw] leading-snug">
          <span className="text-text">Products</span> acquire <span className="text-muted">→</span> <span className="text-text">OS</span> subscribes <span className="text-muted">→</span> <span className="text-text">Data</span> retains <span className="text-muted">→</span> <span className="text-text">LTV compounds.</span>
        </p>
      </div>

      <div className="absolute top-[34vh] left-[6vw] right-[6vw] grid grid-cols-6 gap-[1.2vw]">
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-blue">
          <div className="font-display text-[2vw] leading-none text-text">$52</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">Blended AOV</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-blue">
          <div className="font-display text-[2vw] leading-none text-text">$383</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">Blended CLTV (12–18 mo)</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-blue">
          <div className="font-display text-[2vw] leading-none text-text">65%</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">Gross margin (CPG)</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-primary">
          <div className="font-display text-[2vw] leading-none text-primary">5:1</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">LTV:CAC (CPG)</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-accent">
          <div className="font-display text-[2vw] leading-none text-accent">90%+</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">OS digital margin</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[1.1vw] border-t-2 border-accent">
          <div className="font-display text-[2vw] leading-none text-accent">21:1</div>
          <div className="font-body text-[0.95vw] text-text/60 mt-[0.6vh] leading-snug">LTV:CAC at OS bundle</div>
        </div>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw]">
        <div className="font-body uppercase tracking-[0.3em] text-[1vw] text-muted mb-[1.4vh]">Revenue Stack</div>
        <div className="grid grid-cols-5 gap-[1.2vw]">
          <div className="bg-bg-elev rounded-md p-[1.2vw] border-l-2 border-blue">
            <div className="font-display text-[1.2vw] text-blue mb-[0.6vh]">01</div>
            <div className="font-display text-[1.25vw] text-text leading-tight mb-[0.4vh]">DTC Subscriptions</div>
            <div className="font-body text-[0.9vw] text-text/60 leading-snug">Shopify · sticks · highest margin.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.2vw] border-l-2 border-blue">
            <div className="font-display text-[1.2vw] text-blue mb-[0.6vh]">02</div>
            <div className="font-display text-[1.25vw] text-text leading-tight mb-[0.4vh]">Retail</div>
            <div className="font-body text-[0.9vw] text-text/60 leading-snug">Premium grocery · gyms · wellness.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.2vw] border-l-2 border-blue">
            <div className="font-display text-[1.2vw] text-blue mb-[0.6vh]">03</div>
            <div className="font-display text-[1.25vw] text-text leading-tight mb-[0.4vh]">Amazon</div>
            <div className="font-body text-[0.9vw] text-text/60 leading-snug">Search-driven · efficient CAC.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.2vw] border-l-2 border-accent">
            <div className="font-display text-[1.2vw] text-accent mb-[0.6vh]">04</div>
            <div className="font-display text-[1.25vw] text-text leading-tight mb-[0.4vh]">AForce OS</div>
            <div className="font-body text-[0.9vw] text-text/60 leading-snug">$5 / $15 / $50 mo. Subscription LTV.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.2vw] border-l-2 border-primary">
            <div className="font-display text-[1.2vw] text-primary mb-[0.6vh]">05</div>
            <div className="font-display text-[1.25vw] text-text leading-tight mb-[0.4vh]">Performance Platform</div>
            <div className="font-body text-[0.9vw] text-text/60 leading-snug">Insights · habits · ecosystem lock-in.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
