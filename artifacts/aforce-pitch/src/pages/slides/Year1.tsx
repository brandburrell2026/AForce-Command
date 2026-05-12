import { Fragment } from "react";

export default function Year1() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 18% 30%, rgba(84,120,213,0.18) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 45% at 85% 80%, rgba(245,214,55,0.10) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">19 — Path to $3.2M</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">19 / 23</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-blue font-semibold">Growth driven by repeat behavior</span>
          </div>
          <h2 className="font-display text-[3.6vw] leading-[0.95] tracking-tighter whitespace-nowrap">
            <span className="text-blue">60,000</span>
            <span className="text-text/60"> orders × </span>
            <span className="text-primary">$52</span>
            <span className="text-text/60"> AOV = </span>
            <span className="text-text">$3.2M.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[24vw] leading-snug pb-[1vh] text-right">
          DTC, Amazon, retail activation, and OS subscription work together to drive repeat purchase.
        </p>
      </div>

      <div className="absolute top-[36vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2.4vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-accent font-semibold">Acquisition → Retention Engine</div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-x-[0.6vw]">
          {[
            { stage: "Acquire", title: "Meta + Google", body: "Paid + creators · top-of-funnel intent capture", color: "text-blue", border: "border-blue/40" },
            { stage: "Capture", title: "Hydration Quiz", body: "Converts intent · email + SMS opt-in · qualified lead", color: "text-text", border: "border-text/20" },
            { stage: "Activate", title: "7-Day Starter Bundle", body: "Creates first protocol · habit-forming · proves the product", color: "text-primary", border: "border-primary/40" },
            { stage: "Retain", title: "Email · SMS · Retargeting", body: "Drives repeat purchases on sticks, drinks, canisters", color: "text-text", border: "border-text/20" },
            { stage: "Expand", title: "AForce OS Subscription", body: "Deepens retention · recurring software layer", color: "text-accent", border: "border-accent/40" },
          ].map((s, i, arr) => (
            <Fragment key={i}>
              <div className={`relative rounded-xl border ${s.border} bg-bg-elev/40 p-[1.1vw] flex flex-col`}>
                <div className={`font-body uppercase tracking-[0.28em] text-[0.7vw] font-semibold ${s.color}`}>{s.stage}</div>
                <div className="font-display text-[1.25vw] leading-tight tracking-tight text-text mt-[0.8vh]">{s.title}</div>
                <div className="font-body text-[0.78vw] text-text/60 leading-snug mt-[0.8vh]">{s.body}</div>
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center justify-center">
                  <div className="font-display text-[1.6vw] text-text/30 leading-none">›</div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="absolute top-[64vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[2vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-blue font-semibold">Phased Channel Mix</div>
        </div>

        <div className="grid grid-cols-2 gap-[2.4vw]">
          <div className="border-l-2 border-blue pl-[1.4vw]">
            <div className="flex items-baseline gap-[1vw]">
              <div className="font-display text-[2vw] leading-none tracking-tight text-blue">H1</div>
              <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-text/70 font-semibold">DTC + Amazon Foundation</div>
            </div>
            <div className="font-body text-[0.95vw] text-text/75 leading-snug mt-[1.2vh]">
              Shopify storefront and Amazon launch, fueled by Meta and Google. New York City gym + fitness activations seed the early flywheel.
            </div>
          </div>

          <div className="border-l-2 border-accent pl-[1.4vw]">
            <div className="flex items-baseline gap-[1vw]">
              <div className="font-display text-[2vw] leading-none tracking-tight text-accent">H2</div>
              <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-text/70 font-semibold">Retail + National Media</div>
            </div>
            <div className="font-body text-[0.95vw] text-text/75 leading-snug mt-[1.2vh]">
              Luxury gyms, residential communities, and specialty retail come online — amplified by <span className="text-accent">America's Real Deal Season 2</span> as Brandon's national credibility unlock.
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[1.4vh] left-[6vw] right-[6vw] font-body text-[0.62vw] text-text/40 leading-snug max-w-[88vw]">
        <span className="text-text/55 uppercase tracking-[0.22em] font-semibold">Forward-Looking Statements · </span>
        Figures shown are management projections based on current assumptions about market conditions, execution, and capital deployment. They are not guarantees of future performance. Actual results may differ materially. Provided for informational purposes only; does not constitute an offer to sell or a solicitation to buy any securities.
      </div>

      <div className="absolute bottom-[7vh] left-[6vw] right-[6vw]">
        <div className="font-display text-[1.3vw] leading-tight tracking-tight mb-[1.6vh]">
          <span className="text-text/55">Performance creates retention. </span>
          <span className="text-accent">Retention drives revenue.</span>
        </div>
        <div className="border-t border-text/10 pt-[2vh] grid grid-cols-4 gap-[1.4vw]">
          <div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-primary">$52</div>
            <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Average<br/>order value</div>
          </div>
          <div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-blue">5–7×</div>
            <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Annual repeat<br/>per customer</div>
          </div>
          <div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">~10K</div>
            <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Active<br/>customers · 2026</div>
          </div>
          <div>
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-accent">60K</div>
            <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Total orders<br/>across DTC · Amazon · Retail</div>
          </div>
        </div>
      </div>
    </div>
  );
}
