export default function Traction() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">18 — Traction</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">18 / 22</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[4vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-primary font-semibold">Pre-Launch Momentum</span>
        </div>
        <h2 className="font-display text-[3.8vw] leading-[1] tracking-tighter text-balance">
          Traction <span className="text-primary">highlights.</span>
        </h2>
      </div>

      <div className="absolute top-[32vh] bottom-[5vh] left-[6vw] right-[6vw] grid grid-cols-[1fr_1.6fr] gap-[3vw]">
        <div className="flex flex-col gap-[2vh]">
          <div className="bg-bg-elev rounded-lg p-[1.8vw] border-t-2 border-blue">
            <div className="font-display text-[5vw] leading-none text-blue">179</div>
            <div className="font-body text-[1.1vw] text-text/65 mt-[0.8vh] uppercase tracking-[0.22em]">Creators</div>
          </div>
          <div className="bg-bg-elev rounded-lg p-[1.8vw] border-t-2 border-accent">
            <div className="font-body uppercase tracking-[0.25em] text-[0.95vw] text-muted mb-[0.8vh]">Projected Launch Reach</div>
            <div className="font-display text-[4.6vw] leading-none text-accent">2.3M+</div>
            <div className="font-body text-[1.1vw] text-text/65 mt-[0.8vh]">Combined creator audience.</div>
          </div>
        </div>

        <div className="flex flex-col gap-[1vh]">
          <div className="bg-bg-elev rounded-md px-[1.2vw] py-[0.9vw] border border-text/10 flex items-start gap-[1vw]">
            <div className="font-display text-[1.2vw] text-primary shrink-0 mt-[0.2vh]">01</div>
            <div>
              <div className="font-display text-[1.2vw] text-text mb-[0.2vh]">Fundraising &amp; Pre-Sales</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">Successfully closed <span className="text-text font-semibold">$630K</span> in friends &amp; family round.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md px-[1.2vw] py-[0.9vw] border border-text/10 flex items-start gap-[1vw]">
            <div className="font-display text-[1.2vw] text-primary shrink-0 mt-[0.2vh]">02</div>
            <div>
              <div className="font-display text-[1.2vw] text-text mb-[0.2vh]">Hydration Product Development</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">Final formulations completed across sticks, RTD, and canisters. Supplier relationships established; first production run scheduled Spring 2026.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md px-[1.2vw] py-[0.9vw] border border-text/10 flex items-start gap-[1vw]">
            <div className="font-display text-[1.2vw] text-primary shrink-0 mt-[0.2vh]">03</div>
            <div>
              <div className="font-display text-[1.2vw] text-text mb-[0.2vh]">OS Product Development</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">AForce OS performance platform is product-ready and scheduled to launch alongside hydration drinks this summer.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md px-[1.2vw] py-[0.9vw] border border-accent/40 flex items-start gap-[1vw]">
            <div className="font-display text-[1.2vw] text-accent shrink-0 mt-[0.2vh]">04</div>
            <div>
              <div className="font-display text-[1.2vw] text-text mb-[0.2vh]">National Media Exposure</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">Selected to premiere on <span className="text-text font-semibold">America&apos;s Real Deal — Season 2</span>, filming Summer 2026, airing nationally Fall.</div>
            </div>
          </div>
          <div className="bg-bg-elev rounded-md px-[1.2vw] py-[0.9vw] border border-text/10 flex items-start gap-[1vw]">
            <div className="font-display text-[1.2vw] text-primary shrink-0 mt-[0.2vh]">05</div>
            <div>
              <div className="font-display text-[1.2vw] text-text mb-[0.2vh]">Retail &amp; Distribution</div>
              <div className="font-body text-[0.95vw] text-text/65 leading-snug">Buyer meetings underway with premium retailers; preliminary engagement with national distribution partners targeting Q2 2026 rollout.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
