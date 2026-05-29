import SlideFrame from "@/components/SlideFrame";

const BEATS: Array<{ word: string; tone: string }> = [
  { word: "Pause", tone: "text-red" },
  { word: "Hydrate", tone: "text-text" },
  { word: "Lock in", tone: "text-blue" },
  { word: "Perform", tone: "text-text" },
];

export default function TheRitual() {
  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5vw]">
        <div className="mb-[6vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Ritual
          </span>
        </div>

        <div className="flex items-baseline justify-center gap-[3vw] flex-wrap">
          {BEATS.map((beat, i) => (
            <div
              key={beat.word}
              className="flex items-baseline"
            >
              <span
                className={`font-display font-light tracking-[-0.03em] text-[4.6vw] leading-none ${beat.tone}`}
              >
                {beat.word}
              </span>
              {i < BEATS.length - 1 && (
                <span className="font-display font-light text-[4.6vw] leading-none text-text/20 ml-[3vw]">
                  /
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-[7vh] font-body text-[1.15vw] leading-[1.55] text-text/60 text-center max-w-[44vw]">
          One behavior, four beats. The system that turns hydration into
          readiness.
        </p>
      </div>
    </SlideFrame>
  );
}
