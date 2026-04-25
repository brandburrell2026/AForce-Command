export default function OSRoadmap() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute top-[18vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">14 — OS Roadmap</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">14 / 25</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-accent font-semibold">The Billion-Dollar OS</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">One OS. Three </span>
          <span className="text-primary">phases.</span>
          <span className="text-text"> A billion-dollar </span>
          <span className="text-accent">moat.</span>
        </h1>
        <div className="font-body text-[1.05vw] text-text/60 mt-[1.6vh] max-w-[58vw] ml-auto leading-tight text-right">
          Each phase unlocks a new revenue engine on the same platform — consumer DTC, team SaaS, then enterprise + medical contracts.{" "}
          <span className="text-text/85">The moat compounds with every athlete, every roster, every roster-year.</span>
        </div>
      </div>

      <div className="absolute top-[40vh] bottom-[17vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.6vw] z-10">

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.8vw] pl-[10vw] flex flex-col overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-primary rounded-t-2xl" />

          {/* Floating AI Coach phone — hero specimen */}
          <div
            className="absolute -left-[1.5vw] -top-[10vh] w-[9.5vw] z-20 pointer-events-none"
            style={{ filter: "drop-shadow(0 18px 36px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(229,51,65,0.28))" }}
          >
            <img
              src={`${import.meta.env.BASE_URL}ai-coach-phone-mockup.png`}
              alt="AForce AI Coach — live in your pocket"
              className="w-full h-auto block"
            />
            <div className="absolute -bottom-[1.2vh] left-1/2 -translate-x-1/2 px-[0.7vw] py-[0.25vh] rounded-full bg-primary text-white font-body uppercase tracking-[0.22em] text-[0.55vw] font-bold whitespace-nowrap shadow-lg">
              ● Live in pocket
            </div>
          </div>

          <div className="flex items-center justify-between mb-[1.6vh]">
            <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-primary font-semibold">Phase 1 · Consumer</div>
            <div className="px-[0.7vw] py-[0.3vh] rounded-full border border-primary/55 bg-primary/15 font-body uppercase tracking-[0.18em] text-[0.6vw] text-primary font-semibold flex items-center gap-[0.4vw]">
              <span className="w-[0.35vw] h-[0.35vw] rounded-full bg-primary inline-block" />
              Live 2026
            </div>
          </div>
          <div className="font-display text-[2.8vw] leading-[1] tracking-tight text-text mb-[0.6vh]">AI Coach</div>
          <div className="font-body text-[0.9vw] text-text/65 leading-snug mb-[1.4vh]">Voice-first hydration intelligence in every consumer's pocket. One command at a time.</div>
          <ul className="space-y-[0.8vh] font-body text-[0.8vw] text-text/80 mb-[1.4vh] leading-snug">
            <li className="flex gap-[0.7vw]"><span className="text-primary mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Real-time scoring.</span> Hydration, energy, recovery — measured, not guessed.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-primary mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Adaptive protocols.</span> The OS rewrites your day in response to live biometrics.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-primary mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Social Mode.</span> Owns the after-hours moment competitors can't touch.</span></li>
          </ul>
          <div className="mt-auto pt-[1.2vh] border-t border-primary/20">
            <div className="flex items-baseline gap-[0.6vw]">
              <div className="font-display text-[2.2vw] leading-none text-primary">$383</div>
              <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.18em] leading-tight">Blended<br/>Customer LTV</div>
            </div>
            <div className="font-body text-[0.7vw] text-text/50 mt-[0.6vh] uppercase tracking-[0.2em]">$200B+ functional bev market</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-blue/[0.14] via-blue/[0.04] to-transparent border border-blue/30 p-[1.8vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-blue" />
          <div className="flex items-center justify-between mb-[1.6vh]">
            <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-blue font-semibold">Phase 2 · Teams</div>
            <div className="px-[0.7vw] py-[0.3vh] rounded-full border border-blue/55 bg-blue/15 font-body uppercase tracking-[0.18em] text-[0.6vw] text-blue font-semibold">2027</div>
          </div>
          <div className="font-display text-[2.8vw] leading-[1] tracking-tight text-text mb-[0.6vh]">Clutch</div>
          <div className="font-body text-[0.9vw] text-text/65 leading-snug mb-[1.4vh]">Coach-side roster command grid. Per-seat SaaS layered with a hardware attach.</div>
          <ul className="space-y-[0.8vh] font-body text-[0.8vw] text-text/80 mb-[1.4vh] leading-snug">
            <li className="flex gap-[0.7vw]"><span className="text-blue mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Live roster tier.</span> Every athlete reads PLATINUM → STABLE → RECOVERY → DEPLETED.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-blue mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Heat Mode.</span> Auto-replenish logic + game-day command tools.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-blue mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">CLUTCH Clip.</span> Wearable hardware attach at the elite tier.</span></li>
          </ul>
          <div className="mt-auto pt-[1.2vh] border-t border-blue/20">
            <div className="flex items-baseline gap-[0.6vw]">
              <div className="font-display text-[2.2vw] leading-none text-blue">$4B+</div>
              <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.18em] leading-tight">Team performance<br/>SaaS market</div>
            </div>
            <div className="font-body text-[0.7vw] text-text/50 mt-[0.6vh] uppercase tracking-[0.2em]">High school · College · Pro · Military</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[1.8vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-accent" />
          <div className="flex items-center justify-between mb-[1.6vh]">
            <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-accent font-semibold">Phase 3 · Enterprise</div>
            <div className="px-[0.7vw] py-[0.3vh] rounded-full border border-accent/55 bg-accent/15 font-body uppercase tracking-[0.18em] text-[0.6vw] text-accent font-semibold">2028</div>
          </div>
          <div className="font-display text-[2.8vw] leading-[1] tracking-tight text-text mb-[0.6vh]">Guardian</div>
          <div className="font-body text-[0.9vw] text-text/65 leading-snug mb-[1.4vh]">Roster-wide risk + injury prevention. Five-figure ACV contracts with medical escalation paths.</div>
          <ul className="space-y-[0.8vh] font-body text-[0.8vw] text-text/80 mb-[1.4vh] leading-snug">
            <li className="flex gap-[0.7vw]"><span className="text-accent mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Composite risk score.</span> OPTIMAL → WATCH → MODERATE → CRITICAL per athlete.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-accent mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Body Risk Map.</span> Critical injury alerts before the play breaks down.</span></li>
            <li className="flex gap-[0.7vw]"><span className="text-accent mt-[0.3vh] text-[0.6vw]">●</span><span><span className="text-text font-semibold">Medical escalation.</span> Coach + medical paths inside the same OS.</span></li>
          </ul>
          <div className="mt-auto pt-[1.2vh] border-t border-accent/20">
            <div className="flex items-baseline gap-[0.6vw]">
              <div className="font-display text-[2.2vw] leading-none text-accent">$12B+</div>
              <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.18em] leading-tight">Sports med +<br/>wellness risk market</div>
            </div>
            <div className="font-body text-[0.7vw] text-text/50 mt-[0.6vh] uppercase tracking-[0.2em]">Sports orgs · Military · Enterprise</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Compounding</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between gap-[2vw]">
          <h3 className="font-display text-[2.2vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            <span className="text-text/55">Three engines.</span> One platform.{" "}
            <span className="text-primary">$216B+</span> in compounding{" "}
            <span className="text-accent">TAM.</span>
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Each phase compounds<br/>on the layer below it.
          </div>
        </div>
      </div>
    </div>
  );
}
