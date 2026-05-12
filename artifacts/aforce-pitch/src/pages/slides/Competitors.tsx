export default function Competitors() {
  const competitors = [
    { name: "WHOOP", x: 14, y: 20, tone: "muted" },
    { name: "Oura", x: 22, y: 12, tone: "muted" },
    { name: "Fitbit", x: 30, y: 26, tone: "muted" },
    { name: "Garmin", x: 16, y: 32, tone: "muted" },
    { name: "LMNT", x: 78, y: 78, tone: "muted" },
    { name: "Liquid IV", x: 56, y: 82, tone: "muted" },
    { name: "Prime", x: 38, y: 86, tone: "muted" },
    { name: "Gatorade", x: 28, y: 90, tone: "muted" },
    { name: "BodyArmor", x: 46, y: 88, tone: "muted" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">13 — Competitors</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">13 / 23</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold mb-[1vh]">A new category — not a better drink.</div>
          <h2 className="font-display text-[3.4vw] leading-[0.95] tracking-tighter whitespace-nowrap">
            AForce owns the <span className="text-primary">white space.</span>
          </h2>
        </div>
        <p className="font-body text-[1vw] text-text/70 max-w-[26vw] leading-snug pb-[0.6vh] text-right">
          Wearables read the body but sell no fuel. Hydration brands sell fuel but read nothing. <span className="text-text">AForce closes the loop.</span>
        </p>
      </div>

      {/* 2x2 category map */}
      <div className="absolute top-[27vh] bottom-[14vh] left-[6vw] right-[6vw]">
        <div className="relative w-full h-full bg-bg-elev/40 rounded-2xl border border-text/10 overflow-hidden">

          {/* Quadrant tints */}
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/[0.14] via-primary/[0.05] to-transparent" />
          <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-blue/[0.04]" />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-accent/[0.04]" />

          {/* Axes */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-text/15" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text/15" />

          {/* Quadrant labels */}
          <div className="absolute top-[2.2vh] left-[1.6vw] font-body uppercase tracking-[0.28em] text-[0.7vw] text-blue/70 font-semibold">
            Wearable Platforms
            <div className="font-body normal-case tracking-normal text-[0.72vw] text-text/45 mt-[0.4vh]">Read the body · sell no fuel</div>
          </div>

          <div className="absolute top-[2.2vh] right-[1.6vw] text-right font-body uppercase tracking-[0.28em] text-[0.75vw] text-primary font-semibold">
            Performance OS
            <div className="font-body normal-case tracking-normal text-[0.72vw] text-text/55 mt-[0.4vh]">Fuel + intelligence + behavior</div>
          </div>

          <div className="absolute bottom-[2.2vh] left-[1.6vw] font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/45 font-semibold">
            Mass Functional Bev
            <div className="font-body normal-case tracking-normal text-[0.72vw] text-text/35 mt-[0.4vh]">Sugar + scale · zero intelligence</div>
          </div>

          <div className="absolute bottom-[2.2vh] right-[1.6vw] text-right font-body uppercase tracking-[0.28em] text-[0.7vw] text-accent/80 font-semibold">
            Premium Hydration
            <div className="font-body normal-case tracking-normal text-[0.72vw] text-text/45 mt-[0.4vh]">Cleaner formula · still no system</div>
          </div>

          {/* Competitor dots */}
          {competitors.map((c) => (
            <div
              key={c.name}
              className="absolute flex items-center gap-[0.4vw] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
            >
              <div className="w-[0.7vw] h-[0.7vw] rounded-full bg-text/30 ring-2 ring-text/10" />
              <span className="font-body text-[0.85vw] text-text/55">{c.name}</span>
            </div>
          ))}

          {/* AForce position — alone, top-right, hero */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: "78%", top: "22%" }}
          >
            <div className="absolute w-[14vw] h-[14vw] rounded-full bg-primary/15 blur-2xl -z-10" />
            <div className="relative flex items-center gap-[0.6vw] px-[1.1vw] py-[0.9vh] rounded-full bg-primary/15 border border-primary/55 shadow-[0_0_40px_rgba(229,51,65,0.35)]">
              <div className="w-[0.9vw] h-[0.9vw] rounded-full bg-primary ring-4 ring-primary/25" />
              <span className="font-display text-[1.7vw] leading-none text-primary tracking-tight">AForce</span>
            </div>
            <div className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-primary/85 font-semibold mt-[1.2vh]">Category of one</div>
          </div>

          {/* Axis labels */}
          <div className="absolute bottom-[0.6vh] left-1/2 -translate-x-1/2 font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40 whitespace-nowrap">
            Functional Product Depth →
          </div>
          <div
            className="absolute font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40"
            style={{
              left: "0.45vw",
              top: "50%",
              transform: "translateY(-50%)",
              writingMode: "vertical-rl",
              transformOrigin: "center",
              rotate: "180deg",
            }}
          >
            Intelligence ↑
          </div>
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
