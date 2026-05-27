import SlideChrome from "@/components/SlideChrome";

const TIERS = [
  {
    tag: "Tier 01",
    name: "Core",
    price: "Free",
    cadence: "Entry point",
    desc: "The ritual. Daily readiness. Hydration tracking. Performance score.",
  },
  {
    tag: "Tier 02",
    name: "Professionals Mode",
    price: "$14.99",
    cadence: "per month",
    desc: "Coaching layer. Recovery intelligence. Event-aware protocols.",
  },
  {
    tag: "Tier 03",
    name: "Professionals Membership",
    price: "$64.99",
    cadence: "per month",
    desc: "Product allotment. Concierge ritual. Performance circle. Founder access.",
    italic: true,
  },
];

export default function Subscription() {
  return (
    <SlideChrome slide={9}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[13vh]">
        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            The Subscription Ecosystem
          </div>
          <h2 className="font-display font-light text-[4vw] leading-[1.05] tracking-tight max-w-[62vw]">
            Recurring behavior. <span className="italic text-text/75">Recurring revenue.</span>
          </h2>
        </div>

        <div className="my-auto py-[5vh] grid grid-cols-3 gap-x-[3vw]">
          {TIERS.map((t) => (
            <div key={t.name} className="pt-[3vh] border-t border-text/25">
              <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40 font-medium mb-[2.5vh]">
                {t.tag}
              </div>
              <div
                className={`font-display font-light text-[2.4vw] leading-[1.05] tracking-tight ${
                  t.italic ? "italic text-text/85" : "text-text"
                }`}
              >
                {t.name}
              </div>
              <div className="mt-[3vh] flex items-baseline gap-[0.6vw]">
                <span className="font-display font-light text-[2.8vw] tabular-nums leading-none">
                  {t.price}
                </span>
                <span className="font-body text-[0.8vw] text-text/45 uppercase tracking-[0.24em]">
                  {t.cadence}
                </span>
              </div>
              <p className="mt-[4vh] font-display text-[1.05vw] text-text/60 leading-[1.5] italic">
                {t.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-divider pt-[3vh] font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium flex justify-between">
          <span>Three tiers · One ecosystem</span>
          <span>Behavior precedes pricing</span>
        </div>
      </div>
    </SlideChrome>
  );
}
