export default function Competitors() {
  const features = [
    ["Electrolytes",          true,  true,  true,  true,  true,  true],
    ["Alkaline (pH 8.8+)",    true,  false, false, false, false, false],
    ["Functional Superfoods", true,  false, false, false, false, false],
    ["Subscription Platform", true,  "warn", "warn", false, false, false],
    ["AI Hydration Coaching", true,  false, false, false, false, false],
    ["Wearable Integration",  true,  false, false, false, false, false],
    ["Hydration Intelligence",true,  false, false, false, false, false],
    ["Behavioral Data",       true,  false, false, false, false, false],
  ] as const;

  const cell = (v: boolean | "warn") => {
    if (v === true) return <span className="inline-flex items-center justify-center w-[2vw] h-[2vw] rounded-full bg-blue/15 border border-blue/40 text-blue font-display text-[1.2vw]">✓</span>;
    if (v === "warn") return <span className="inline-flex items-center justify-center w-[2vw] h-[2vw] rounded-full bg-accent/15 border border-accent/40 text-accent font-display text-[1.1vw]">!</span>;
    return <span className="inline-flex items-center justify-center w-[2vw] h-[2vw] rounded-full bg-primary/10 border border-primary/30 text-primary/70 font-display text-[1.1vw]">×</span>;
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">21 — Competitors</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">21 / 29</div>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance">
          AForce vs. <span className="text-primary">competitors.</span>
        </h2>
        <p className="font-body text-[1.15vw] text-text/70 max-w-[34vw] leading-snug pb-[1vh]">
          AForce is the only hydration brand combining clean ingredients, functional superfoods, a digital performance platform, AI hydration coaching, and wearable integration — a combination no competitor currently offers.
        </p>
      </div>

      <div className="absolute bottom-[6vh] left-[6vw] right-[6vw] bg-bg-elev rounded-lg border border-text/10 overflow-hidden">
        <div className="grid grid-cols-[1.6fr_repeat(6,1fr)] px-[1.4vw] py-[1.4vh] border-b border-text/10 font-body uppercase tracking-[0.22em] text-[0.95vw]">
          <div className="text-muted">Feature</div>
          <div className="text-center text-primary font-semibold">AForce</div>
          <div className="text-center text-muted">Liquid IV</div>
          <div className="text-center text-muted">LMNT</div>
          <div className="text-center text-muted">BodyArmor</div>
          <div className="text-center text-muted">Gatorade</div>
          <div className="text-center text-muted">Prime</div>
        </div>
        {features.map(([label, ...vals], i) => (
          <div key={i} className={`grid grid-cols-[1.6fr_repeat(6,1fr)] items-center px-[1.4vw] py-[1.2vh] ${i < features.length - 1 ? "border-b border-text/5" : ""}`}>
            <div className="font-body text-[1.15vw] text-text/85">{label}</div>
            {vals.map((v, j) => (
              <div key={j} className="flex justify-center">{cell(v as boolean | "warn")}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
