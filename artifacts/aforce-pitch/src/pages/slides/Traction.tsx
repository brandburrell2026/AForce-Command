export default function Traction() {
  const proofRows = [
    {
      headline: "30M+ projected impressions",
      sub: "179 signed creators · avg 168K reach · activating Summer 2026",
    },
    {
      headline: "3 pro team beta conversations",
      sub: "Clutch beta candidates · NBA + college programs · LOIs in progress",
    },
    {
      headline: "10+ athlete advisors confirmed",
      sub: "Founder network — NBA + Wall Street community · active ambassadors",
    },
    {
      headline: "Supply chain locked",
      sub: "Co-packer contracted · 3 SKUs · cans + sticks · Q2 production confirmed",
    },
    {
      headline: "$49 blended CAC modeled conservatively",
      sub: "vs. Liquid IV $40–$70 industry range · creator-organic mix reduces paid dependency",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute top-[18vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">18 — Traction</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">18 / 25</div>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">Proof Before Launch</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[4.2vw]">
          <span className="text-text">Momentum before </span>
          <span className="text-primary">launch.</span>
        </h1>
      </div>

      {/* Hero metrics — 4 cards */}
      <div className="absolute top-[28vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[1.2vw] z-10" style={{ height: "26vh" }}>
        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-primary font-semibold mb-[0.8vh]">Capital Closed</div>
          <div className="font-display text-[3.6vw] leading-[1] tracking-tight text-primary mb-[0.4vh]">$832K</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.7vw] text-text mb-[0.8vh]">Friends &amp; Family Pre-Seed</div>
          <div className="font-body text-[0.75vw] text-text/65 leading-snug mb-auto">Round closed. Pre-seed momentum carrying directly into the $4M Seed.</div>
          <div className="pt-[0.7vh] border-t border-primary/20 mt-[0.7vh]">
            <div className="font-body text-[0.6vw] text-text/55 uppercase tracking-[0.2em]">Q1 2026 · Closed</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-blue/[0.14] via-blue/[0.04] to-transparent border border-blue/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-blue" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-blue font-semibold mb-[0.8vh]">Launch Creators</div>
          <div className="font-display text-[3.6vw] leading-[1] tracking-tight text-blue mb-[0.4vh]">179</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.7vw] text-text mb-[0.8vh]">Signed Across TikTok / IG / YT</div>
          <div className="font-body text-[0.75vw] text-text/65 leading-snug mb-auto">Multi-platform creator network committed and contracted.</div>
          <div className="pt-[0.7vh] border-t border-blue/20 mt-[0.7vh]">
            <div className="font-body text-[0.6vw] text-text/55 uppercase tracking-[0.2em]">Activating Summer 2026</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-primary font-semibold mb-[0.8vh]">National TV Premiere</div>
          <div className="font-display text-[3.6vw] leading-[1] tracking-tight text-primary mb-[0.4vh]">S2</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.7vw] text-text mb-[0.8vh]">America's Real Deal</div>
          <div className="font-body text-[0.75vw] text-text/65 leading-snug mb-auto">Filmed Summer '26 · Aired Fall '26. National catalyst aligned to launch window.</div>
          <div className="pt-[0.7vh] border-t border-primary/20 mt-[0.7vh]">
            <div className="font-body text-[0.6vw] text-text/55 uppercase tracking-[0.2em]">Booked · Launch-Aligned</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[1.2vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-accent" />
          <div className="font-body uppercase tracking-[0.26em] text-[0.65vw] text-accent font-semibold mb-[0.8vh]">Pre-Shelf Audience</div>
          <div className="font-display text-[3.6vw] leading-[1] tracking-tight text-accent mb-[0.4vh]">2.3M+</div>
          <div className="font-body uppercase tracking-[0.2em] text-[0.7vw] text-text mb-[0.8vh]">Watching Before Day One</div>
          <div className="font-body text-[0.75vw] text-text/65 leading-snug mb-auto">Owned distribution before product hits retail.</div>
          <div className="pt-[0.7vh] border-t border-accent/20 mt-[0.7vh]">
            <div className="font-body text-[0.6vw] text-text/55 uppercase tracking-[0.2em]">Owned Audience</div>
          </div>
        </div>
      </div>

      {/* Proof checklist — what we can prove today, not projected */}
      <div className="absolute top-[57vh] bottom-[10vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[2.5vw] bg-text/30" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-semibold">What We Can Prove Today — Not Projected</div>
          <div className="h-px flex-1 bg-text/10" />
        </div>
        <div className="grid grid-cols-5 gap-[0.9vw]">
          {proofRows.map((r, i) => (
            <div key={i} className="bg-bg-elev/40 border border-text/10 rounded-md px-[0.9vw] py-[1vh] flex flex-col">
              <div className="flex items-start gap-[0.5vw]">
                <span className="font-display text-[1vw] leading-none text-primary mt-[0.1vh]">✓</span>
                <div className="font-display text-[0.95vw] leading-tight tracking-tight text-text">{r.headline}</div>
              </div>
              <div className="font-body text-[0.65vw] text-text/55 mt-[0.7vh] leading-snug">{r.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[2.5vh] left-[6vw] right-[6vw] z-10">
        <div className="border-t border-text/10 pt-[1.2vh] grid grid-cols-[1.4fr_1fr] gap-[2vw] items-baseline">
          <h3 className="font-display text-[1.6vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            Product <span className="text-primary">ready.</span>{" "}
            System <span className="text-blue">ready.</span>{" "}
            Demand <span className="text-accent">building.</span>
          </h3>
          <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Suppliers locked · Q2 2026 retail rollout<br/>
            Summer 2026 launch is committed.
          </div>
        </div>
      </div>
    </div>
  );
}
