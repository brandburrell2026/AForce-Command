export default function Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute inset-0 bg-gradient-to-br from-blue/[0.08] via-transparent to-primary/[0.06] pointer-events-none" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-display text-[1.6vw] tracking-tight text-text">
          A<span className="text-blue">FORCE</span>
        </div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">22 / 22</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] w-[50vw]">
        <h1 className="font-display text-[4.4vw] leading-[1] tracking-tighter text-balance">
          <span className="text-blue">AFORCE</span> is not a drink.
        </h1>
        <h2 className="font-display text-[3.6vw] leading-[1.05] tracking-tighter text-text/85 mt-[2vh]">
          It's the <span className="text-text">operating system</span> for human performance.
        </h2>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] w-[44vw] bg-bg-elev rounded-2xl border border-text/10 p-[2vw] flex items-center gap-[2vw]">
        <div className="w-[8vw] h-[8vw] rounded-full bg-gradient-to-br from-blue/30 to-primary/20 border-2 border-blue/40 flex items-center justify-center shrink-0">
          <span className="font-display text-[3vw] text-text/80">BB</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-[0.8vw] mb-[1.4vh]">
            <div className="font-display text-[1.8vw] text-text leading-tight">Brandon Burrell</div>
            <div className="font-body text-[1.05vw] text-blue uppercase tracking-[0.2em]">Founder</div>
          </div>
          <div className="grid grid-cols-2 gap-x-[1.4vw] gap-y-[1.1vh] font-body text-[1.05vw] text-text/80">
            <div className="flex items-center gap-[0.7vw]">
              <span className="text-blue text-[1.1vw]">@</span>
              <span>@brandburrell</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="text-blue text-[1.1vw]">⌂</span>
              <span>www.drinkaforce.com</span>
            </div>
            <div className="flex items-center gap-[0.7vw] col-span-1">
              <span className="text-blue text-[1.1vw]">✉</span>
              <span className="whitespace-nowrap">bburrell@alkalineforce.com</span>
            </div>
            <div className="flex items-center gap-[0.7vw]">
              <span className="text-blue text-[1.1vw]">☏</span>
              <span>+1 205.243.9447</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-[14vh] bottom-[6vh] right-[6vw] w-[36vw] flex flex-col justify-between gap-[1.6vh]">
        {[
          {
            title: "Category-Defining CPG + SaaS Platform",
            body: "A structural moat combining premium physical products with a high-margin subscription software platform — no competitor offers both.",
          },
          {
            title: "Omnichannel Distribution from Day One",
            body: "DTC, Amazon, specialty retail, and gym channels create diversified revenue streams and broad consumer touchpoints from day one.",
          },
          {
            title: "Aligned with Premium, High-Growth Category Trends",
            body: "Positioned in a rapidly consolidating category where clean, functional, performance-driven brands command the highest strategic multiples.",
          },
          {
            title: "National Media Catalyst at Launch",
            body: "Spring 2026 product launch is aligned with the national premiere of America's Real Deal — Season 2, creating brand awareness at exactly the right moment.",
          },
        ].map((p, i) => (
          <div key={i} className="flex items-start gap-[1vw]">
            <div className="font-display text-[1.6vw] text-blue leading-none mt-[0.4vh] shrink-0">›</div>
            <div className="flex-1">
              <div className="font-display text-[1.4vw] text-text leading-tight mb-[0.6vh]">{p.title}</div>
              <div className="font-body text-[1vw] text-text/65 leading-snug">{p.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-[1.6vh] left-[6vw] font-body text-[0.85vw] text-muted/60">
        Copyright © 2026 AForce. All rights reserved.
      </div>
    </div>
  );
}
