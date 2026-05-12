export default function Traction() {
  const signals = [
    { value: "30M+", label: "Projected first-month impressions", sub: "from 179 launch creators" },
    { value: "3", label: "Pro team conversations", sub: "Clutch beta candidates" },
    { value: "10+", label: "Athlete advisors", sub: "founder network · NBA + Wall St" },
    { value: "120d", label: "To Summer '26 launch", sub: "supply chain locked" },
    { value: "100%", label: "Pre-seed coverage", sub: "$832K closed, $4M Seed open" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute top-[18vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">16 — Traction</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">16 / 23</div>
      </div>

      <div className="absolute top-[11vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">Proof Before Launch</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[4.4vw]">
          <span className="text-text">Momentum before </span>
          <span className="text-primary">launch.</span>
        </h1>
        <div className="font-body text-[1vw] text-text/60 mt-[1.2vh] max-w-[78vw] leading-tight">
          Capital, audience, media, and channel already aligning before national rollout.{" "}
          <span className="text-text/85">$832K closed · 179 launch creators · 2.3M+ pre-shelf audience · National TV catalyst booked.</span>
        </div>
      </div>

      {/* Hero metrics — 4 cards */}
      <div className="absolute top-[34vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[1.2vw] z-10" style={{ height: "30vh" }}>
        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-primary font-semibold mb-[0.8vh]">Friends &amp; Family</div>
          <div className="font-display text-[4vw] leading-[1] tracking-tight text-primary mb-[0.4vh]">$832K</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.75vw] text-text mb-[0.8vh]">Capital Closed</div>
          <div className="font-body text-[0.78vw] text-text/65 leading-snug mb-auto">Round closed. Pre-seed momentum carrying directly into the $4M Seed.</div>
          <div className="pt-[0.8vh] border-t border-primary/20 mt-[0.8vh]">
            <div className="font-body text-[0.62vw] text-text/55 uppercase tracking-[0.2em]">Q1 2026 · Closed</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-blue/[0.14] via-blue/[0.04] to-transparent border border-blue/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-blue" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-blue font-semibold mb-[0.8vh]">Creator Network</div>
          <div className="font-display text-[4vw] leading-[1] tracking-tight text-blue mb-[0.4vh]">179</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.75vw] text-text mb-[0.8vh]">Launch Creators</div>
          <div className="font-body text-[0.78vw] text-text/65 leading-snug mb-auto">Multi-platform creator network committed — TikTok, Instagram, YouTube.</div>
          <div className="pt-[0.8vh] border-t border-blue/20 mt-[0.8vh]">
            <div className="font-body text-[0.62vw] text-text/55 uppercase tracking-[0.2em]">Signed · Activating Summer 2026</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-primary font-semibold mb-[0.8vh]">National Catalyst</div>
          <div className="font-display text-[4vw] leading-[1] tracking-tight text-primary mb-[0.4vh]">S2</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.75vw] text-text mb-[0.8vh]">National TV Premiere</div>
          <div className="font-body text-[0.78vw] text-text/65 leading-snug mb-auto"><span className="text-text font-semibold">America's Real Deal — Season 2.</span> Filmed Summer '26. Aired Fall '26.</div>
          <div className="pt-[0.8vh] border-t border-primary/20 mt-[0.8vh]">
            <div className="font-body text-[0.62vw] text-text/55 uppercase tracking-[0.2em]">Booked · Launch-Aligned</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-accent" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-accent font-semibold mb-[0.8vh]">Audience Leverage</div>
          <div className="font-display text-[4vw] leading-[1] tracking-tight text-accent mb-[0.4vh]">2.3M+</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.75vw] text-text mb-[0.8vh]">Watching Before Shelf</div>
          <div className="font-body text-[0.78vw] text-text/65 leading-snug mb-auto">Audience already engaged before product hits retail. Owned distribution from day one.</div>
          <div className="pt-[0.8vh] border-t border-accent/20 mt-[0.8vh]">
            <div className="font-body text-[0.62vw] text-text/55 uppercase tracking-[0.2em]">Pre-Shelf Audience</div>
          </div>
        </div>
      </div>

      {/* Leading indicators strip */}
      <div className="absolute top-[67vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1vh]">
          <div className="h-px w-[2.5vw] bg-text/30" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-semibold">Leading Indicators</div>
          <div className="h-px flex-1 bg-text/10" />
        </div>
        <div className="grid grid-cols-5 gap-[0.9vw]">
          {signals.map((s, i) => (
            <div key={i} className="bg-bg-elev/40 border border-text/10 rounded-md px-[1vw] py-[1vh]">
              <div className="font-display text-[1.7vw] leading-none tracking-tight text-text">{s.value}</div>
              <div className="font-body text-[0.7vw] text-text/75 mt-[0.6vh] leading-tight font-semibold">{s.label}</div>
              <div className="font-body text-[0.6vw] text-text/40 mt-[0.3vh] leading-tight">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw] z-10">
        <div className="border-t border-text/10 pt-[1.2vh] grid grid-cols-[1.4fr_1fr] gap-[2vw] items-baseline">
          <h3 className="font-display text-[1.85vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            Product <span className="text-primary">ready.</span>{" "}
            System <span className="text-blue">ready.</span>{" "}
            Demand <span className="text-accent">building.</span>
          </h3>
          <div className="font-body text-[0.78vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Suppliers locked · Q2 2026 retail rollout<br/>
            Summer 2026 launch is committed.
          </div>
        </div>
      </div>
    </div>
  );
}
