export default function Competitors() {
  const hydration = ["Liquid IV", "LMNT", "Gatorade"];
  const wearables = ["WHOOP", "Oura", "Apple Watch"];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">14 — Competitors</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">14 / 25</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="font-body uppercase tracking-[0.32em] text-[1vw] text-primary font-semibold mb-[1vh]">Two industries. One intersection.</div>
          <h2 className="font-display text-[4vw] leading-[0.95] tracking-tighter whitespace-nowrap">
            AForce is a <span className="text-primary">category of one.</span>
          </h2>
        </div>
        <p className="font-body text-[1vw] text-text/65 max-w-[26vw] leading-snug pb-[0.6vh] text-right">
          Hydration brands sell fuel and read nothing. Wearables read the body and sell no fuel. <span className="text-text">AForce is the only system that does both.</span>
        </p>
      </div>

      {/* Venn diagram */}
      <div className="absolute top-[28vh] bottom-[14vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full">
          <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
            <defs>
              <radialGradient id="hydroGrad" cx="35%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#5478D5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#5478D5" stopOpacity="0.04" />
              </radialGradient>
              <radialGradient id="wearGrad" cx="65%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#F5D637" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#F5D637" stopOpacity="0.04" />
              </radialGradient>
              <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E53341" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#E53341" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#E53341" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glow behind intersection */}
            <circle cx="500" cy="250" r="180" fill="url(#coreGlow)" />

            {/* Left circle — Hydration Brands */}
            <circle cx="380" cy="250" r="220" fill="url(#hydroGrad)" stroke="#5478D5" strokeWidth="1.5" strokeOpacity="0.5" />

            {/* Right circle — Wearable Platforms */}
            <circle cx="620" cy="250" r="220" fill="url(#wearGrad)" stroke="#F5D637" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>

          {/* Left circle label */}
          <div className="absolute" style={{ left: "5%", top: "4%" }}>
            <div className="font-body uppercase tracking-[0.32em] text-[1.44vw] text-blue font-semibold">Hydration Brands</div>
            <div className="font-body text-[1.35vw] text-text/55 mt-[0.6vh]">Sell fuel · read nothing</div>
          </div>

          {/* Left circle competitors — vertical stack */}
          <div className="absolute flex flex-col gap-[2.2vh] items-start" style={{ left: "7%", top: "32%" }}>
            {hydration.map((c) => (
              <div key={c} className="flex items-center gap-[0.9vw]">
                <div className="w-[0.95vw] h-[0.95vw] rounded-full bg-blue/60" />
                <span className="font-body text-[1.8vw] text-text/85">{c}</span>
              </div>
            ))}
          </div>

          {/* Right circle label */}
          <div className="absolute text-right" style={{ right: "5%", top: "4%" }}>
            <div className="font-body uppercase tracking-[0.32em] text-[1.44vw] text-accent font-semibold">Wearable Platforms</div>
            <div className="font-body text-[1.35vw] text-text/55 mt-[0.6vh]">Read the body · sell no fuel</div>
          </div>

          {/* Right circle competitors */}
          <div className="absolute flex flex-col gap-[2.2vh] items-end" style={{ right: "7%", top: "32%" }}>
            {wearables.map((c) => (
              <div key={c} className="flex items-center gap-[0.9vw]">
                <span className="font-body text-[1.8vw] text-text/85">{c}</span>
                <div className="w-[0.95vw] h-[0.95vw] rounded-full bg-accent/60" />
              </div>
            ))}
          </div>

          {/* Center — AForce */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="absolute w-[26vw] h-[26vw] rounded-full bg-primary/20 blur-3xl -z-10" />
            <div className="font-body uppercase tracking-[0.36em] text-[1.4vw] text-primary/90 font-semibold mb-[1.6vh]">The Intersection</div>
            <div className="relative px-[2.6vw] py-[1.8vh] rounded-full bg-primary/15 border-2 border-primary/60 shadow-[0_0_80px_rgba(229,51,65,0.55)]">
              <span className="font-display text-[6vw] leading-none text-primary tracking-tight">AForce</span>
            </div>
            <div className="font-display text-[2.4vw] text-text mt-[2vh] tracking-tight">Performance OS</div>
            <div className="font-body text-[1.4vw] text-text/65 mt-[0.8vh]">Drink · Sense · Coach · Compound</div>
          </div>

          {/* Sub-tags below circles for quadrant logic */}
          <div className="absolute bottom-[3%] left-[14%] font-body uppercase tracking-[0.28em] text-[1.2vw] text-text/45">$50B category</div>
          <div className="absolute bottom-[3%] right-[14%] font-body uppercase tracking-[0.28em] text-[1.2vw] text-text/45">$80B category</div>
        </div>
      </div>

      <div className="absolute bottom-[4vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.4vh] flex items-baseline justify-between gap-[2vw]">
          <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight">
            <span className="text-text/55">The category has </span>
            <span className="text-text">drinks.</span>
            <span className="text-text/55"> AForce has a </span>
            <span className="text-primary">loop.</span>
          </div>
          <div className="font-body text-[0.78vw] text-text/45 italic max-w-[34vw] text-right leading-snug">
            What we don't pretend is a moat: the can, the flavor, the price point. Those get copied. The system does not.
          </div>
        </div>
      </div>
    </div>
  );
}
