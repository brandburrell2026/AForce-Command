import SlideChrome from "@/components/SlideChrome";

type Proof = {
  index: string;
  label: string;
  caption: string;
};

const PROOFS: Proof[] = [
  {
    index: "01",
    label: "Repeat purchase validation",
    caption: "Does the product earn a second order?",
  },
  {
    index: "02",
    label: "Subscription conversion",
    caption: "Does free behavior become paid commitment?",
  },
  {
    index: "03",
    label: "Retention proof",
    caption: "Does the ritual hold past day 28?",
  },
  {
    index: "04",
    label: "CAC efficiency",
    caption: "Is acquisition disciplined, not subsidized?",
  },
  {
    index: "05",
    label: "Ritual adoption",
    caption: "Is the protocol completed without prompting?",
  },
  {
    index: "06",
    label: "Ecosystem engagement",
    caption: "Do Circles, Territory, Coach compound?",
  },
];

export default function BuildProof() {
  return (
    <SlideChrome slide={21}>
      {/* Ambient red glow — top right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 88% 12%, rgba(226,92,92,0.11) 0%, transparent 70%)",
        }}
      />
      {/* Faint neural grid bloom — bottom right, reinforces behavioral system */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 45% 50% at 90% 92%, rgba(226,92,92,0.06) 0%, transparent 65%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[8vw] pt-[10vh] pb-[9vh]">
        {/* Eyebrow */}
        <div className="flex items-center justify-between">
          <div className="font-body uppercase tracking-[0.4em] text-[0.78vw] text-text/60 font-semibold">
            The Raise · Phase 1 Capital
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-semibold">
            $4,000,000 · 18 Months · Proof Before Scale
          </div>
        </div>

        {/* Headline */}
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter mt-[2.4vh] max-w-[88vw]">
          <span className="text-text">$4M buys an </span>
          <span className="text-primary">unfair 18 months.</span>
        </h2>

        {/* Subhead */}
        <div className="mt-[2.2vh] font-body text-[1.1vw] text-text/75 leading-[1.55] max-w-[60vw]">
          This raise is engineered to{" "}
          <span className="text-text">validate behavior before scale.</span>
        </div>

        {/* Proof ribbon — 6 validation milestones */}
        <div className="mt-[6vh] grid grid-cols-6 gap-x-[1.8vw]">
          {PROOFS.map((p) => (
            <div key={p.index} className="border-t border-text/15 pt-[1.6vh]">
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold tabular-nums">
                {p.index}
              </div>
              <div className="mt-[1.2vh] font-display text-[1.05vw] leading-[1.2] tracking-tight text-text">
                {p.label}
              </div>
              <div className="mt-[1vh] font-body text-[0.72vw] text-text/55 leading-[1.55]">
                {p.caption}
              </div>
            </div>
          ))}
        </div>

        {/* Editorial pull quote */}
        <div className="mt-auto pt-[5vh]">
          <div className="font-display text-[2.2vw] leading-[1.18] tracking-tight text-text/90 max-w-[70vw] italic">
            “The first phase is not about awareness.{" "}
            <span className="text-primary not-italic font-semibold">
              It is about validation.
            </span>
            ”
          </div>

          <div className="mt-[2.8vh] flex items-baseline justify-between gap-[3vw] border-t border-text/12 pt-[2vh]">
            <div className="font-display text-[1.5vw] leading-[1.15] tracking-tight text-text">
              Do people want this?{" "}
              <span className="text-primary">Do they come back?</span>
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.68vw] text-text/45 font-semibold text-right shrink-0">
              Validation · Not vanity scale
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
