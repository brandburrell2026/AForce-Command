const PHASE_COLORS: Record<string, { accent: string; ring: string; bar: string; bg: string; dot: string }> = {
  primary: {
    accent: "text-primary",
    ring: "ring-primary/35",
    bar: "bg-primary",
    bg: "from-primary/[0.10] to-primary/0",
    dot: "bg-primary",
  },
  blue: {
    accent: "text-blue",
    ring: "ring-blue/35",
    bar: "bg-blue",
    bg: "from-blue/[0.10] to-blue/0",
    dot: "bg-blue",
  },
  accent: {
    accent: "text-accent",
    ring: "ring-accent/35",
    bar: "bg-accent",
    bg: "from-accent/[0.10] to-accent/0",
    dot: "bg-accent",
  },
};

export default function GTM() {
  const phases = [
    {
      label: "Phase 1",
      window: "0–6 mo",
      tag: "Current",
      color: "primary",
      items: ["DTC launch (Shopify)", "Amazon + TikTok Shops", "PR + influencer seeding", "OS Beta launch"],
    },
    {
      label: "Phase 2",
      window: "6–12 mo",
      color: "primary",
      items: ["Regional retail (NYC, Northeast)", "Gym + specialty health", "Subscription push", "OS data expansion"],
    },
    {
      label: "Phase 3",
      window: "12–24 mo",
      color: "blue",
      items: ["National retail (Whole Foods, Sprouts, Erewhon)", "Expanded SKUs", "Athlete sponsorships", "OS v2 personalization"],
    },
    {
      label: "Phase 4",
      window: "24–36 mo",
      color: "blue",
      items: ["International expansion", "Predictive AI coaching", "Wearable integration (Apple, WHOOP)"],
    },
    {
      label: "Phase 5",
      window: "36–48 mo",
      color: "accent",
      items: ["Strategic CPG partnerships", "Foodservice + institutions", "OS licensing to partners"],
    },
    {
      label: "Phase 6",
      window: "48+ mo",
      color: "accent",
      items: ["M&A / IPO positioning", "Category leader: performance intelligence", "Global performance data platform"],
    },
  ];

  const eras = [
    { label: "Build", color: "primary", phases: "Phases 1–2", window: "0–12 mo" },
    { label: "Scale", color: "blue", phases: "Phases 3–4", window: "12–36 mo" },
    { label: "Lead", color: "accent", phases: "Phases 5–6", window: "36+ mo" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 15% 35%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 50% 60%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 85% 80%, rgba(245,214,55,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">20 — Go-To-Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">20 / 28</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Roadmap</span>
          </div>
          <h2 className="font-display text-[4.8vw] leading-[0.92] tracking-tighter">
            Build. Scale. <span className="text-accent">Lead.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[28vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">We don't sell hydration.</span> <span className="text-accent">We install a daily performance system.</span>
        </p>
      </div>

      <div className="absolute top-[34vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-3 gap-[1vw]">
          {eras.map((e) => {
            const c = PHASE_COLORS[e.color];
            return (
              <div key={e.label} className="flex items-center gap-[0.8vw]">
                <div className={`w-[0.8vw] h-[0.8vw] rounded-full ${c.dot}`} />
                <div className="flex items-baseline gap-[0.7vw]">
                  <div className={`font-display text-[1.7vw] leading-none ${c.accent}`}>{e.label}</div>
                  <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/45 font-semibold">{e.phases} · {e.window}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="mt-[1.6vh] h-[3px] rounded-full"
          style={{ background: "linear-gradient(to right, #E53341 0%, #E53341 33.33%, #5478D5 33.33%, #5478D5 66.66%, #F5D637 66.66%, #F5D637 100%)" }}
        />
      </div>

      <div className="absolute top-[44vh] bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-6 gap-[0.7vw]">
        {phases.map((p) => {
          const c = PHASE_COLORS[p.color];
          return (
            <div key={p.label} className={`relative rounded-2xl ring-1 ${c.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}>
              <div className={`absolute inset-0 bg-gradient-to-b ${c.bg} pointer-events-none`} />
              <div className={`absolute inset-x-0 top-0 h-[3px] ${c.bar}`} />
              <div className="relative p-[1.1vw] flex flex-col h-full">
                <div className={`font-body uppercase tracking-[0.28em] text-[0.95vw] font-semibold ${c.accent}`}>{p.label}</div>
                <div className="font-display text-[2.1vw] leading-[1] tracking-tight text-text mt-[0.8vh]">{p.window}</div>
                {p.tag && (
                  <div className="self-start px-[0.7vw] py-[0.3vh] mt-[1.2vh] bg-primary/20 ring-1 ring-primary/40 rounded text-primary font-body text-[0.78vw] uppercase tracking-[0.22em] font-semibold">
                    {p.tag}
                  </div>
                )}
                <ul className={`font-body text-[1.18vw] text-text/85 leading-[1.32] mt-[2vh] flex-1 flex flex-col ${p.items.length >= 4 ? "justify-between" : "gap-[2vh]"}`}>
                  {p.items.map((it, j) => (
                    <li key={j} className="flex gap-[0.55vw]">
                      <span className={`${c.accent} mt-[0.05vh] shrink-0 text-[1.3vw] leading-none`}>·</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center gap-[1vw] mb-[1.2vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Why This Compounds</div>
          </div>
          <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">Hardware </span>
            <span className="text-text">scales</span>
            <span className="text-text/55">. Software </span>
            <span className="text-text">compounds</span>
            <span className="text-text/55">. The </span>
            <span className="text-accent">OS creates retention.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
