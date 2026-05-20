import SlideChrome from "@/components/SlideChrome";

const FEATURES = [
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
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The OS
        </div>

        <h2 className="font-display text-[6vw] leading-[0.92] tracking-tighter max-w-[70vw]">
          Human first.
          <br />
          <span className="text-text/45">System second.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-6">
            <div className="font-body text-[1.1vw] text-text/65 leading-[1.6] max-w-[36vw]">
              The OS exists to quietly reinforce ritual, accountability, readiness, consistency, and habit formation.
            </div>
            <div className="mt-[3vh] font-display text-[1.6vw] leading-[1.2] tracking-tight text-text">
              The OS <span className="text-primary">proves</span> the promise.
              <br />
              <span className="text-text/55">It does not become the story.</span>
            </div>
          </div>
          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              The system includes
            </div>
            <div className="grid grid-cols-2 gap-y-[0.8vh] gap-x-[1.5vw]">
              {FEATURES.map((f) => (
                <div key={f} className="font-body text-[1vw] text-text/80">
                  — {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[7vh] font-display text-[2.2vw] tracking-tight text-text">
          The goal: <span className="text-primary">make the ritual repeatable</span>.
        </div>
      </div>
    </SlideChrome>
  );
}
