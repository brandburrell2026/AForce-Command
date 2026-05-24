import SlideChrome from "@/components/SlideChrome";

type Kpi = { value: string; label: string };

const KPIS: Kpi[] = [
  { value: "$27.8M", label: "2028 Revenue Target" },
  { value: "Q4 2027", label: "Breakeven" },
  { value: "62–65%", label: "Gross Margin" },
  { value: "5–7×", label: "Repeat Purchase Frequency" },
];

type Allocation = {
  index: string;
  title: string;
  detail: string;
};

const ALLOCATIONS: Allocation[] = [
  {
    index: "01",
    title: "Product + Inventory",
    detail: "Initial production, hydration sticks, cans, fulfillment",
  },
  {
    index: "02",
    title: "AForce OS",
    detail: "AI coach, onboarding, retention engine, behavioral loop",
  },
  {
    index: "03",
    title: "Customer Acquisition",
    detail: "Meta, Google, referral loops, launch events",
  },
  {
    index: "04",
    title: "Team + Operations",
    detail: "Key hires, infrastructure, Miami rollout",
  },
];

export default function BuildProof() {
  return (
    <SlideChrome slide={21}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 85% 15%, rgba(226,92,92,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[8vw] pt-[10vh] pb-[9vh]">
        {/* Eyebrow */}
        <div className="flex items-center justify-between">
          <div className="font-body uppercase tracking-[0.4em] text-[0.78vw] text-text/45 font-semibold">
            The Raise · Phase 1 Capital
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold">
            $4,000,000 · 18 Months · Proof Before Scale
          </div>
        </div>

        {/* Headline */}
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter mt-[2.2vh] max-w-[88vw]">
          <span className="text-text">$4M buys an </span>
          <span className="text-primary">unfair 18 months.</span>
        </h2>

        <div className="mt-[1.8vh] font-body text-[1.05vw] text-text/65 leading-[1.55] max-w-[60vw]">
          Every dollar in this round is tied to{" "}
          <span className="text-text">measurable proof</span> — not vanity
          scale.
        </div>

        {/* KPI row */}
        <div className="mt-[5vh] grid grid-cols-4 gap-[1.4vw]">
          {KPIS.map((k) => (
            <div
              key={k.label}
              className="relative rounded-[0.6vw] px-[1.4vw] py-[2.2vh] overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)",
                border: "1px solid rgba(226,92,92,0.22)",
                boxShadow:
                  "inset 0 0 30px rgba(226,92,92,0.06), 0 0 24px rgba(226,92,92,0.04)",
              }}
            >
              <div className="font-display text-[2.4vw] leading-[1] tracking-tight text-text tabular-nums">
                {k.value}
              </div>
              <div className="mt-[1vh] font-body uppercase tracking-[0.28em] text-[0.65vw] text-text/55 font-semibold">
                {k.label}
              </div>
            </div>
          ))}
        </div>

        {/* Allocation row */}
        <div className="mt-[4vh] grid grid-cols-4 gap-[1.4vw]">
          {ALLOCATIONS.map((a) => (
            <div
              key={a.index}
              className="border-t border-text/15 pt-[1.6vh]"
            >
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold tabular-nums">
                {a.index}
              </div>
              <div className="mt-[1vh] font-display text-[1.55vw] leading-[1.1] tracking-tight text-text">
                {a.title}
              </div>
              <div className="mt-[1.2vh] font-body text-[0.8vw] text-text/55 leading-[1.55]">
                {a.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom statement */}
        <div className="mt-auto pt-[3vh] flex items-baseline justify-between gap-[3vw]">
          <div className="font-display text-[1.8vw] leading-[1.15] tracking-tight text-text">
            The raise funds <span className="text-primary">proof</span> — not
            scale.
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold text-right">
            Disciplined capital · Measured outcomes
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
