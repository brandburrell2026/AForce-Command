import SlideChrome from "@/components/SlideChrome";

const TIERS = [
  { tag: "Tier 01", name: "Core", price: "Free", cadence: "Entry point", desc: "The ritual. Daily readiness. Hydration tracking. Performance score.", color: "text-text" },
  { tag: "Tier 02", name: "Professionals Mode", price: "$14.99", cadence: "per month", desc: "Coaching layer. Recovery intelligence. Event-aware protocols.", color: "text-blue" },
  { tag: "Tier 03", name: "Professionals Membership", price: "$64.99", cadence: "per month", desc: "Product allotment. Concierge ritual. Performance circle. Founder access.", color: "text-red" },
];

export default function Subscription() {
  return (
    <SlideChrome slide={9}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            The Subscription Ecosystem
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-black tracking-[-0.035em] text-[5.6vw] leading-[0.92] text-text max-w-[72vw]">
          Recurring behavior. <span className="text-red">Recurring revenue.</span>
        </h2>

        <div className="my-auto py-[4vh] grid grid-cols-3 gap-x-[3vw]">
          {TIERS.map((t) => (
            <div key={t.name} className="pt-[2.5vh] border-t-2 border-text/85">
              <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] font-semibold text-text/45 mb-[2vh]">
                {t.tag}
              </div>
              <div className={`font-display font-black text-[2.4vw] leading-[1] tracking-[-0.03em] ${t.color}`}>
                {t.name}
              </div>
              <div className="mt-[2.5vh] flex items-baseline gap-[0.6vw]">
                <span className="font-display font-black text-[3.6vw] tabular-nums leading-none tracking-[-0.04em]">
                  {t.price}
                </span>
                <span className="font-display text-[0.75vw] text-text/50 uppercase tracking-[0.22em] font-semibold">
                  {t.cadence}
                </span>
              </div>
              <p className="mt-[3.5vh] font-display text-[1vw] text-text/70 leading-[1.5] font-medium">
                {t.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-divider pt-[2.5vh] font-display uppercase tracking-[0.28em] text-[0.65vw] text-text/50 font-semibold flex justify-between">
          <span>Three tiers · One ecosystem</span>
          <span>Behavior precedes pricing</span>
        </div>
      </div>
    </SlideChrome>
  );
}
