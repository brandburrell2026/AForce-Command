export default function Delivers() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">17 — Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">17 / 29</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">Unit Economics</span>
        </div>
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          AForce delivers a scalable <span className="text-primary">5:1 LTV:CAC</span> across DTC + Retail.
        </h2>
        <p className="mt-[2vh] font-body text-[1.4vw] text-text/70 max-w-[65vw] leading-snug">
          Multi-format model increases frequency, margin, and LTV. Average purchase frequency: 5–7 orders per year across formats.
        </p>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] grid grid-cols-[1fr_1fr] gap-[4vw]">
        <div className="bg-bg-elev rounded-lg p-[2vw] border border-text/10">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-primary mb-[2vh]">Core Metrics</div>
          <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[2vh]">
            <div>
              <div className="font-display text-[3.4vw] leading-none text-text">$52</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">Blended AOV</div>
            </div>
            <div>
              <div className="font-display text-[3.4vw] leading-none text-text">$383</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">Blended CLTV <span className="text-muted">(12–18 mo)</span></div>
            </div>
            <div>
              <div className="font-display text-[3.4vw] leading-none text-text">65%</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">Gross Margin</div>
            </div>
            <div>
              <div className="font-display text-[3.4vw] leading-none text-text">$49</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">Blended CAC</div>
            </div>
            <div>
              <div className="font-display text-[3.4vw] leading-none text-primary">5:1</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">LTV : CAC Ratio</div>
            </div>
            <div>
              <div className="font-display text-[3.4vw] leading-none text-text">$249</div>
              <div className="font-body text-[1.05vw] text-text/65 mt-[0.6vh]">Contribution Profit / CAC</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="font-body uppercase tracking-[0.3em] text-[1.1vw] text-muted mb-[2vh]">Product Mix Driving Economics</div>
          <div className="grid grid-cols-2 gap-[1.2vw] flex-1">
            <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-primary flex flex-col justify-between">
              <div className="font-display text-[3.6vw] leading-none text-primary">40<span className="text-[2vw]">%</span></div>
              <div>
                <div className="font-display text-[1.4vw] text-text">Hydration Drinks</div>
                <div className="font-body text-[1vw] text-text/55">RTD cans</div>
              </div>
            </div>
            <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-blue flex flex-col justify-between">
              <div className="font-display text-[3.6vw] leading-none text-blue">25<span className="text-[2vw]">%</span></div>
              <div>
                <div className="font-display text-[1.4vw] text-text">Hydration Sticks</div>
                <div className="font-body text-[1vw] text-text/55">14g portable</div>
              </div>
            </div>
            <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-accent flex flex-col justify-between">
              <div className="font-display text-[3.6vw] leading-none text-accent">20<span className="text-[2vw]">%</span></div>
              <div>
                <div className="font-display text-[1.4vw] text-text">Energy Drinks</div>
                <div className="font-body text-[1vw] text-text/55">Performance line</div>
              </div>
            </div>
            <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-text/30 flex flex-col justify-between">
              <div className="font-display text-[3.6vw] leading-none text-text">15<span className="text-[2vw]">%</span></div>
              <div>
                <div className="font-display text-[1.4vw] text-text">Hydration Canisters</div>
                <div className="font-body text-[1vw] text-text/55">Bulk format</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
