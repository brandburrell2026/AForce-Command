import SlideChrome from "@/components/SlideChrome";

const LIVE = [
  { tag: "TestFlight", detail: "iOS build distributed to closed beta cohort." },
  { tag: "Patent Pending", detail: "Closed-loop behavioral hydration system." },
  { tag: "Functional App", detail: "Score, Command, Improve — running today." },
  { tag: "Closed-Loop Engine", detail: "Drink → Ritual → Reinforcement → Retention." },
];

const ROADMAP = [
  "AI Coach voice engine",
  "Recovery / Social mode expansion",
  "Wearable integrations",
  "Team / enterprise dashboards",
];

export default function SystemRunning() {
  return (
    <SlideChrome slide={12}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Not a Vision
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.92] tracking-tighter max-w-[80vw]">
          A <span className="text-primary">system running.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-[4vw] max-w-[76vw]">
          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold mb-[2vh]">
              Live now
            </div>
            <div className="space-y-[1.5vh]">
              {LIVE.map((l) => (
                <div
                  key={l.tag}
                  className="border-t border-text/15 pt-[1.2vh]"
                >
                  <div className="font-display text-[1.4vw] leading-[1.15] tracking-tight text-text">
                    {l.tag}
                  </div>
                  <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh] leading-[1.5]">
                    {l.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[2vh]">
              Roadmap — later
            </div>
            <div className="space-y-[1.2vh]">
              {ROADMAP.map((r) => (
                <div
                  key={r}
                  className="border-t border-text/8 pt-[1vh] font-display text-[1.2vw] leading-[1.2] tracking-tight text-text/65"
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[6vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw] text-text/65">
          The OS is <span className="text-text">already shipping.</span> The story is what it becomes.
        </div>
      </div>
    </SlideChrome>
  );
}
