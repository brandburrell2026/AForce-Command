import SlideChrome from "@/components/SlideChrome";

const REINFORCES = ["Ritual", "Accountability", "Readiness", "Consistency", "Habit formation"];
const SYSTEM = [
  "Hydration scoring",
  "Onboarding",
  "AI coaching",
  "Reminders",
  "Streaks",
  "Recovery insights",
  "Behavioral reinforcement",
  "Subscription ecosystem",
];

export default function TheOS() {
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The OS
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter">
          <span className="text-text">Human first.</span>
          <br />
          <span className="text-text/45">System second.</span>
        </h2>

        <div className="mt-[5vh] font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/85 max-w-[55vw]">
          The OS proves the promise.
          <br />
          <span className="text-primary">It does not become the story.</span>
        </div>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-5">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Quietly reinforces
            </div>
            <div className="flex flex-wrap gap-[0.5vw]">
              {REINFORCES.map((r) => (
                <span
                  key={r}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/75"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-7 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              The system includes
            </div>
            <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[0.8vh]">
              {SYSTEM.map((s, i) => (
                <div key={s} className="flex items-baseline gap-[0.8vw]">
                  <span className="font-body text-[0.65vw] tracking-[0.3em] text-text/30 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-body text-[1vw] text-text/80">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[6vh] font-body text-[1vw] text-text/45 leading-[1.6]">
          The goal: make the ritual <span className="text-text/80">repeatable.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
