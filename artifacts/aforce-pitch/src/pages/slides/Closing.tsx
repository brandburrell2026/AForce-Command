export default function Closing() {
  const base = import.meta.env.BASE_URL;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-0 bg-gradient-to-br from-blue/[0.10] via-transparent to-primary/[0.08] pointer-events-none" />
      <div className="absolute -top-[20vh] -right-[10vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.08] blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20vh] -left-[10vw] w-[45vw] h-[45vw] rounded-full bg-primary/[0.06] blur-[120px] pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">22 — The Ask</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">22 / 22</div>
      </div>

      <div className="absolute top-[14vh] bottom-[12vh] left-[6vw] w-[30vw] z-10">
        <div className="relative h-full w-full rounded-2xl overflow-hidden ring-1 ring-text/10 bg-bg-elev">
          <img
            src={`${base}brandon.jpg`}
            alt="Brandon Burrell, Founder of AForce"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/20 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-[1.6vw]">
            <div className="font-display text-[2.2vw] leading-[1] tracking-tight text-text">Brandon Burrell</div>
            <div className="font-body uppercase tracking-[0.28em] text-[0.9vw] text-blue font-semibold mt-[0.8vh]">Founder · AForce</div>
            <div className="font-body italic text-[0.95vw] text-text/70 mt-[1.2vh] leading-snug">
              "Hydration is the wedge. Intelligence is the moat."
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-[14vh] bottom-[12vh] left-[40vw] right-[6vw] flex flex-col z-10">
        <div className="flex items-center gap-[1vw] mb-[1.4vh]">
          <div className="h-px w-[3vw] bg-blue" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-blue font-semibold">Series Seed</div>
        </div>

        <h1 className="font-display leading-[0.92] tracking-tighter text-balance">
          <span className="text-[8.4vw] text-primary">$4M</span>
          <span className="text-[8.4vw] text-text"> Seed.</span>
        </h1>
        <div className="font-body text-[1.25vw] text-text/70 mt-[1.4vh] leading-tight">
          <span className="text-text">Q1 2026 close</span>
          <span className="text-text/40 mx-[0.6vw]">·</span>
          <span className="text-text">Spring 2026 launch</span>
          <span className="text-text/40 mx-[0.6vw]">·</span>
          <span className="text-text">National media catalyst</span>
        </div>

        <h2 className="font-display text-[2.4vw] leading-[1.08] tracking-tight mt-[4.2vh] text-text/95 text-balance">
          AForce isn't a drink.{" "}
          <span className="text-text/55">It's the </span>
          <span className="text-blue">operating system</span>
          <span className="text-text/55"> for human performance.</span>
        </h2>

        <div className="mt-auto">
          <div className="flex items-center gap-[1vw] mb-[1.6vh]">
            <div className="h-px w-[3vw] bg-accent" />
            <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">Why now · Proof</div>
          </div>
          <div className="grid grid-cols-4 gap-[1.4vw] border-t border-text/10 pt-[2vh]">
            <div>
              <div className="font-display text-[2.6vw] leading-none tracking-tight text-text">8.7×</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Revenue<br/>growth · 24 mo</div>
            </div>
            <div>
              <div className="font-display text-[2.6vw] leading-none tracking-tight text-blue">21:1</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">LTV : CAC<br/>at OS bundle</div>
            </div>
            <div>
              <div className="font-display text-[2.6vw] leading-none tracking-tight text-text">$383</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">Blended<br/>customer LTV</div>
            </div>
            <div>
              <div className="font-display text-[2.6vw] leading-none tracking-tight text-accent">Q4 '27</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/65 mt-[0.8vh] leading-snug">EBITDA<br/>breakeven</div>
            </div>
          </div>

          <div className="mt-[3vh] flex items-center gap-[1.6vw] font-body text-[0.95vw] text-text/80 flex-wrap">
            <a href="mailto:bburrell@alkalineforce.com" className="flex items-center gap-[0.5vw] hover:text-blue transition-colors">
              <span className="text-blue">✉</span>
              <span>bburrell@alkalineforce.com</span>
            </a>
            <span className="text-text/25">·</span>
            <span className="flex items-center gap-[0.5vw]">
              <span className="text-blue">☏</span>
              <span>+1 205.243.9447</span>
            </span>
            <span className="text-text/25">·</span>
            <span className="flex items-center gap-[0.5vw]">
              <span className="text-blue">⌂</span>
              <span>drinkaforce.com</span>
            </span>
            <span className="text-text/25">·</span>
            <span className="flex items-center gap-[0.5vw]">
              <span className="text-blue">@</span>
              <span>@brandburrell</span>
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[1.6vh] left-[6vw] font-body text-[0.75vw] text-muted/50 z-10">
        Copyright © 2026 AForce. All rights reserved.
      </div>
    </div>
  );
}
