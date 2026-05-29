import SlideFrame from "@/components/SlideFrame";

const STOPS = [
  { date: "Jun 2026", t: "Soft Launch", m: "First concierge cohort" },
  { date: "Jul 2026", t: "Proof of Concept", m: "Habit + retention validated" },
  { date: "Oct 2026", t: "Community Scale", m: "Brickell density compounding" },
  { date: "Jan 2027", t: "National Television", m: "America's Real Deal, on air" },
];

export default function RoadToRealDeal() {
  return (
    <SlideFrame slide={12}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        <div className="mb-[4vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Road
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[4.4vw] leading-[1.02] text-text">
          Road to{" "}
          <span className="text-blue font-normal">America's Real Deal.</span>
        </h1>

        {/* timeline */}
        <div className="mt-[8vh] relative">
          <div className="absolute left-0 right-0 top-[0.6vh] h-px bg-text/20" />
          <div className="grid grid-cols-4 gap-[2vw]">
            {STOPS.map((s, i) => (
              <div
                key={s.date}
                className="relative pt-[3vh]"
              >
                <div
                  className={`absolute -top-[0.4vh] left-0 w-[1.2vw] h-[1.2vw] rounded-full ${i === STOPS.length - 1 ? "bg-red" : "bg-text/30"}`}
                />
                <div className="font-display uppercase tracking-[0.22em] text-[0.7vw] text-text/50 font-medium">
                  {s.date}
                </div>
                <div className="mt-[1.4vh] font-display text-[1.7vw] text-text font-normal leading-tight">
                  {s.t}
                </div>
                <div className="mt-[1.2vh] font-display text-[0.95vw] leading-[1.45] text-text/60">
                  {s.m}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
