import SlideChrome from "@/components/SlideChrome";

const PILLARS = [
  {
    tag: "Score",
    role: "Quantifies readiness in real time.",
    detail: "Hydration. Recovery. Performance signal.",
  },
  {
    tag: "Command",
    role: "Tells you exactly what to do next.",
    detail: "Intake. Pacing. Recovery action.",
  },
  {
    tag: "Improve",
    role: "Closes the loop over time.",
    detail: "Habit. Streaks. Compounding behavior.",
  },
];

export default function IntelligenceLayer() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-y-0 right-[2vw] w-[36vw] flex items-center justify-center">
        <div
          className="absolute w-[30vw] h-[30vw] rounded-full opacity-40 blur-[6vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(229,51,65,0.25) 0%, rgba(182,255,0,0.15) 45%, transparent 72%)",
          }}
        />
        <img
          src={`${base}ai-coach-phone-mockup.png`}
          alt=""
          className="relative h-[74vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(229,51,65,0.18))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[60vw] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--slide-bg) 70%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Intelligence Layer
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter max-w-[50vw] mb-[2vh]">
          From beverage
          <br />
          to <span className="text-primary">infrastructure.</span>
        </h2>

        <div className="mt-[5vh] max-w-[44vw] space-y-[2vh]">
          {PILLARS.map((p) => (
            <div
              key={p.tag}
              className="border-t border-text/15 pt-[1.5vh]"
            >
              <div className="flex items-baseline gap-[1.5vw]">
                <div className="font-display text-[2.4vw] leading-none tracking-tight text-text w-[8vw]">
                  {p.tag}
                </div>
                <div className="flex-1">
                  <div className="font-display text-[1.2vw] leading-[1.15] tracking-tight text-text/90">
                    {p.role}
                  </div>
                  <div className="font-body text-[0.8vw] text-text/45 mt-[0.4vh]">
                    {p.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
