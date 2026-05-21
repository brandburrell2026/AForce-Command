import SlideChrome from "@/components/SlideChrome";

const TIERS = [
  {
    name: "AForce OS Core",
    price: "Free",
    purpose: "Low-friction ecosystem adoption",
    features: ["Onboarding", "Hydration score", "Reminders", "Streaks", "Behavioral engagement"],
    accent: "border-text/15",
    priceColor: "text-text/55",
  },
  {
    name: "Professionals Mode",
    price: "$14.99 / mo",
    purpose: "Deeper accountability and reinforcement",
    features: ["Advanced coaching", "Recovery scoring", "Wearable integrations", "Optimization tools"],
    accent: "border-accent",
    priceColor: "text-accent",
  },
  {
    name: "Professionals Membership",
    price: "$64.99 / mo",
    purpose: "Recurring lifestyle behavior",
    features: ["RTDs", "Hydration sticks", "Athlete Mode access", "Premium recovery", "Ecosystem access"],
    accent: "border-primary",
    priceColor: "text-primary",
  },
];

export default function PerformanceEcosystem() {
  return (
    <SlideChrome slide={12}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Performance Ecosystem
        </div>

        <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter max-w-[75vw] mb-[5vh]">
          The goal is not to sell hydration.
          <br />
          <span className="text-primary">The goal is recurring performance behavior.</span>
        </h2>

        <div className="grid grid-cols-3 gap-[1.8vw]">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`border-l-2 ${t.accent} pl-[1.4vw] py-[1vh] flex flex-col gap-[1.2vh]`}
            >
              <div>
                <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
                  Tier
                </div>
                <div className="font-display text-[1.8vw] leading-[1.05] tracking-tight text-text">
                  {t.name}
                </div>
                <div className={`font-display text-[1.3vw] tracking-tight mt-[0.5vh] ${t.priceColor}`}>
                  {t.price}
                </div>
              </div>
              <div className="font-body text-[0.85vw] uppercase tracking-[0.2em] text-text/40 font-semibold leading-[1.5]">
                {t.purpose}
              </div>
              <div className="flex flex-col gap-[0.5vh] mt-[0.5vh]">
                {t.features.map((f) => (
                  <div key={f} className="font-body text-[0.85vw] text-text/70 leading-[1.4]">
                    — {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[5vh] font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/35 font-semibold">
          Performance is non-negotiable.
        </div>
      </div>
    </SlideChrome>
  );
}
