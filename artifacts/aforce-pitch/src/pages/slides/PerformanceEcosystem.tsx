import SlideChrome from "@/components/SlideChrome";

const TIERS = [
  {
    name: "AForce OS Core",
    price: "Free",
    features: ["Onboarding", "Hydration score", "Reminders", "Streaks", "Behavioral engagement"],
    purpose: "Low-friction ecosystem adoption.",
    accent: "border-text/15",
    priceColor: "text-text/85",
  },
  {
    name: "Professionals Mode",
    price: "$14.99",
    cadence: "/mo",
    features: ["Advanced coaching", "Recovery scoring", "Wearable integrations", "Optimization tools"],
    purpose: "Deeper accountability and performance reinforcement.",
    accent: "border-primary/40",
    priceColor: "text-primary",
  },
  {
    name: "Professionals Membership",
    price: "$64.99",
    cadence: "/mo",
    features: ["RTDs", "Hydration sticks", "Athlete Mode access", "Premium recovery", "Ecosystem access"],
    purpose: "Turn ritual into recurring lifestyle behavior.",
    accent: "border-accent/40",
    priceColor: "text-accent",
  },
];

export default function PerformanceEcosystem() {
  return (
    <SlideChrome slide={12}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[2vh]">
          The Performance Ecosystem
        </div>
        <h2 className="font-display text-[3.4vw] leading-[0.95] tracking-tighter max-w-[60vw] mb-[5vh]">
          Three tiers. <span className="text-text/45">One ritual.</span>
        </h2>

        <div className="grid grid-cols-3 gap-[1.8vw]">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`border ${t.accent} rounded-sm p-[1.8vw] flex flex-col`}
            >
              <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/45 font-semibold mb-[1vh]">
                {t.name}
              </div>
              <div className="flex items-baseline gap-[0.3vw] mb-[2vh]">
                <div className={`font-display text-[3vw] leading-none tracking-tight ${t.priceColor}`}>
                  {t.price}
                </div>
                {t.cadence && (
                  <div className="font-body text-[0.95vw] text-text/45">{t.cadence}</div>
                )}
              </div>
              <div className="flex-1">
                {t.features.map((f) => (
                  <div
                    key={f}
                    className="font-body text-[0.85vw] text-text/75 py-[0.5vh] border-b border-text/8"
                  >
                    {f}
                  </div>
                ))}
              </div>
              <div className="font-body text-[0.8vw] text-text/55 italic mt-[2vh] leading-[1.4]">
                {t.purpose}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[5vh] font-display text-[1.5vw] leading-[1.25] tracking-tight max-w-[55vw]">
          <span className="text-text/55">"The goal is not to sell hydration.</span>
          <br />
          <span className="text-text">The goal is to build recurring performance behavior."</span>
        </div>
      </div>
    </SlideChrome>
  );
}
