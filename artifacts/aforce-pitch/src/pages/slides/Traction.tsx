export default function Traction() {
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

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">Proof Before Launch</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">Momentum before </span>
          <span className="text-primary">launch.</span>
        </h1>
        <div className="font-body text-[1.1vw] text-text/60 mt-[1.6vh] max-w-[78vw] leading-tight">
          Capital, product, audience, and media are aligning before national rollout.{" "}
          <span className="text-text/85">$832K committed. 179 launch creators. 2.3M+ watching before product is on shelf. National TV catalyst booked.</span>
        </div>
      </div>

      <div className="absolute top-[40vh] bottom-[22vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[1.4vw] z-10">

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-primary font-semibold mb-[1.2vh]">Friends &amp; Family</div>
          <div className="font-display text-[5.4vw] leading-[1] tracking-tight text-primary mb-[0.6vh]">$832K</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-text mb-[1vh]">Capital Closed</div>
          <div className="font-body text-[0.85vw] text-text/65 leading-snug mb-auto">Round closed. Pre-seed momentum carrying directly into the $4M Seed.</div>
          <div className="pt-[1.4vh] border-t border-primary/20 mt-[1.4vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">Q1 2026 · Closed</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-blue/[0.14] via-blue/[0.04] to-transparent border border-blue/30 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-blue" />
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-blue font-semibold mb-[1.2vh]">Creator Network</div>
          <div className="font-display text-[5.4vw] leading-[1] tracking-tight text-blue mb-[0.6vh]">179</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-text mb-[1vh]">Launch Creators</div>
          <div className="font-body text-[0.85vw] text-text/65 leading-snug mb-auto">Multi-platform creator network committed to the launch wave — TikTok, Instagram, YouTube.</div>
          <div className="pt-[1.4vh] border-t border-blue/20 mt-[1.4vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">Signed · Activating Spring 2026</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-accent" />
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-accent font-semibold mb-[1.2vh]">Audience Leverage</div>
          <div className="font-display text-[5.4vw] leading-[1] tracking-tight text-accent mb-[0.6vh]">2.3M+</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-text mb-[1vh]">Watching Before Shelf</div>
          <div className="font-body text-[0.85vw] text-text/65 leading-snug mb-auto">Audience already engaged before the product hits retail. Demand is observable, not projected — owned distribution from day one.</div>
          <div className="pt-[1.4vh] border-t border-accent/20 mt-[1.4vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">Pre-Shelf Audience</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-primary" />
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-primary font-semibold mb-[1.2vh]">National Catalyst</div>
          <div className="font-display text-[5.4vw] leading-[1] tracking-tight text-primary mb-[0.6vh]">S2</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.85vw] text-text mb-[1vh]">National TV Premiere</div>
          <div className="font-body text-[0.85vw] text-text/65 leading-snug mb-auto"><span className="text-text font-semibold">America's Real Deal — Season 2.</span> Filmed Summer 2026. Aired nationally Fall 2026.</div>
          <div className="pt-[1.4vh] border-t border-primary/20 mt-[1.4vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">Booked · Launch-Aligned</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Foundation Ready</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] grid grid-cols-[1.4fr_1fr] gap-[2vw] items-baseline">
          <h3 className="font-display text-[2.1vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            Product <span className="text-primary">ready.</span>{" "}
            System <span className="text-blue">ready.</span>{" "}
            Demand <span className="text-accent">building.</span>
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Suppliers · Q2 2026 retail rollout<br/>
            Spring 2026 launch is locked.
          </div>
        </div>
      </div>
    </div>
  );
}
