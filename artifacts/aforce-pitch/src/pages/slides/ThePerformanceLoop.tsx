import SlideChrome from "@/components/SlideChrome";

const LOOP = [
  { tag: "01", word: "Drink", caption: "The product enters." },
  { tag: "02", word: "Ritual", caption: "Behavior takes hold." },
  { tag: "03", word: "Reinforcement", caption: "The OS returns the moment." },
  { tag: "04", word: "Retention", caption: "Habit compounds." },
];

export default function ThePerformanceLoop() {
  return (
    <SlideChrome slide={8}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[14vh]">
        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            The Performance Loop
          </div>
          <h2 className="font-display font-light text-[4.4vw] leading-[1.05] tracking-tight max-w-[68vw]">
            Every cycle <span className="italic text-text/75">earns the next.</span>
          </h2>
        </div>

        <div className="my-auto py-[6vh]">
          <div className="grid grid-cols-4 gap-x-[2vw]">
            {LOOP.map((step, i) => (
              <div key={step.word} className="relative pt-[3vh] border-t border-text/25">
                <div className="font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.32em] mb-[2vh]">
                  {step.tag}
                </div>
                <div className="font-display font-light text-[3vw] leading-[1] tracking-tight text-text">
                  {step.word}
                </div>
                <div className="mt-[2.5vh] font-display text-[1.05vw] text-text/55 italic leading-[1.4]">
                  {step.caption}
                </div>
                {i < LOOP.length - 1 && (
                  <div className="hidden md:block absolute top-[3vh] right-[-1.2vw] text-text/30 font-display text-[1.4vw]">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-divider pt-[3vh] flex items-baseline justify-between">
          <p className="font-display font-light text-[1.5vw] italic text-text/75 max-w-[55vw]">
            The loop is the moat. The product enters once. The ritual returns daily.
          </p>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium">
            One loop · Many users · Compounding behavior
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
