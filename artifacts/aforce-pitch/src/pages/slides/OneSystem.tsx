import SlideChrome from "@/components/SlideChrome";

const SCREENS = [
  {
    tag: "Hydration Score",
    detail: "Real-time readiness — orb climbs as you drink, decays as you don't.",
  },
  {
    tag: "Command Layer",
    detail: "Single next action — intake, pacing, or correction.",
  },
  {
    tag: "Recovery Mode",
    detail: "Behavioral protocol after stress, depletion, or social mode.",
  },
  {
    tag: "Streaks & Habit",
    detail: "Reinforcement loop that turns intake into identity.",
  },
];

export default function ProductTour() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[12vh] pb-[10vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Product Tour
        </div>

        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[6vh]">
          Real. <span className="text-text/45">Tangible.</span> Shipping.
        </h2>

        <div className="grid grid-cols-4 gap-[1.5vw] flex-1 min-h-0">
          {SCREENS.map((s, i) => (
            <div
              key={s.tag}
              className="relative flex flex-col rounded-md overflow-hidden border border-text/8"
              style={{
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 70%)",
              }}
            >
              <div
                className="relative aspect-[9/16] overflow-hidden"
                style={{
                  background: "linear-gradient(180deg, #0a0b13 0%, #050608 100%)",
                }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background:
                      i === 0
                        ? "radial-gradient(circle at 50% 38%, rgba(182,255,0,0.30) 0%, transparent 55%)"
                        : i === 1
                          ? "radial-gradient(circle at 50% 50%, rgba(229,51,65,0.22) 0%, transparent 60%)"
                          : i === 2
                            ? "radial-gradient(circle at 50% 45%, rgba(84,120,213,0.28) 0%, transparent 60%)"
                            : "radial-gradient(circle at 50% 40%, rgba(245,214,55,0.22) 0%, transparent 60%)",
                  }}
                />
                <div className="relative flex flex-col items-center justify-center text-center px-[1vw]">
                  <div className="font-body uppercase tracking-[0.3em] text-[0.55vw] text-text/40 font-semibold mb-[1vh]">
                    Screen {String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    className="w-[5vw] h-[5vw] rounded-full"
                    style={{
                      background:
                        i === 0
                          ? "radial-gradient(circle, #B6FF00 0%, transparent 70%)"
                          : i === 1
                            ? "radial-gradient(circle, #E53341 0%, transparent 70%)"
                            : i === 2
                              ? "radial-gradient(circle, #5478D5 0%, transparent 70%)"
                              : "radial-gradient(circle, #F5D637 0%, transparent 70%)",
                      filter: "blur(0.4vw)",
                    }}
                  />
                </div>
              </div>
              <div className="p-[1.2vw]">
                <div className="font-display text-[1.05vw] leading-[1.15] tracking-tight text-text">
                  {s.tag}
                </div>
                <div className="font-body text-[0.7vw] text-text/55 mt-[0.6vh] leading-[1.5]">
                  {s.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[4vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw] text-text/65">
          The OS is a system you use, <span className="text-text">not a deck you read.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
