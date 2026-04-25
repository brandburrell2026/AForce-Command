const COLOR_BORDER: Record<string, string> = {
  primary: "border-primary",
  blue: "border-blue",
  accent: "border-accent",
};
const COLOR_TEXT: Record<string, string> = {
  primary: "text-primary",
  blue: "text-blue",
  accent: "text-accent",
};

export default function GTM() {
  const phases = [
    {
      label: "Phase 1",
      window: "0–6 months",
      tag: "Current",
      color: "primary",
      items: ["DTC launch (Shopify — first)", "Amazon + TikTok Shops", "Initial PR + influencer seeding", "AForce OS Beta launch"],
    },
    {
      label: "Phase 2",
      window: "6–12 months",
      color: "primary",
      items: ["Regional retail (NYC, Northeast)", "Gym + specialty health partnerships", "Subscription program push", "OS user growth + data expansion"],
    },
    {
      label: "Phase 3",
      window: "12–24 months",
      color: "blue",
      items: ["National distribution (Whole Foods, Sprouts, Erewhon)", "Expanded SKUs", "Major athlete sponsorships", "AForce OS v2 personalization engine"],
    },
    {
      label: "Phase 4",
      window: "24–36 months",
      color: "blue",
      items: ["International expansion", "AI coaching + predictive system", "Wearable integration (Apple, WHOOP)"],
    },
    {
      label: "Phase 5",
      window: "36–48 months",
      color: "accent",
      items: ["Strategic CPG distributor partnerships", "Foodservice, universities, hospitals", "Licensing AForce OS to partners"],
    },
    {
      label: "Phase 6",
      window: "48+ months",
      color: "accent",
      items: ["M&A positioning for acquisition / IPO", "Category leader in hydration intelligence", "Global performance data platform"],
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">17 — Go-To-Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">17 / 23</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[3vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">Roadmap</span>
        </div>
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance">
          Go-to-market <span className="text-accent">roadmap.</span>
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-6 gap-[1.2vw]">
        {phases.map((p, i) => (
          <div key={i} className={`bg-bg-elev rounded-md p-[1.2vw] border-t-2 ${COLOR_BORDER[p.color]}`}>
            <div className={`font-body uppercase tracking-[0.25em] text-[0.9vw] ${COLOR_TEXT[p.color]} font-semibold mb-[0.6vh]`}>{p.label}</div>
            <div className="font-display text-[1.1vw] text-text mb-[0.4vh]">{p.window}</div>
            {p.tag && <div className="inline-block px-[0.6vw] py-[0.2vh] bg-primary/15 border border-primary/30 rounded text-primary text-[0.8vw] uppercase tracking-[0.2em] mb-[1vh]">{p.tag}</div>}
            <ul className="font-body text-[0.95vw] text-text/70 leading-snug space-y-[0.6vh] mt-[1vh]">
              {p.items.map((it, j) => (
                <li key={j} className="flex gap-[0.4vw]">
                  <span className={`${COLOR_TEXT[p.color]} mt-[0.1vh]`}>·</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] text-center font-body text-[1.3vw] text-muted">
        AForce scales both product distribution and its performance intelligence platform simultaneously.
      </div>
    </div>
  );
}
