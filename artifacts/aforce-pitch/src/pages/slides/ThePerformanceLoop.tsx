import SlideChrome from "@/components/SlideChrome";

const LOOP = [
  { tag: "01", word: "Drink", caption: "The product enters.", color: "text-red" },
  { tag: "02", word: "Ritual", caption: "Behavior takes hold.", color: "text-text" },
  { tag: "03", word: "Reinforcement", caption: "The OS returns the moment.", color: "text-blue" },
  { tag: "04", word: "Retention", caption: "Habit compounds.", color: "text-text" },
];

export default function ThePerformanceLoop() {
  return (
    <SlideChrome slide={8}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            The Performance Loop
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-black tracking-[-0.035em] text-[5.6vw] leading-[0.92] text-text max-w-[78vw]">
          Every cycle <span className="text-red">earns the next.</span>
        </h2>

        <div className="my-auto py-[5vh]">
          <div className="grid grid-cols-4 gap-x-[2vw]">
            {LOOP.map((step, i) => (
              <div key={step.word} className="relative pt-[2.5vh] border-t-2 border-text/85">
                <div className="font-display tabular-nums text-[0.7vw] text-text/45 tracking-[0.32em] mb-[2vh] font-semibold">
                  {step.tag}
                </div>
                <div className={`font-display font-black text-[3.2vw] leading-[0.95] tracking-[-0.035em] ${step.color}`}>
                  {step.word}
                </div>
                <div className="mt-[2.2vh] font-display text-[1vw] text-text/70 font-medium leading-[1.4]">
                  {step.caption}
                </div>
                {i < LOOP.length - 1 && (
                  <div className="absolute top-[2.5vh] right-[-1.2vw] text-text/30 font-display text-[1.4vw] font-bold">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="border-t border-divider pt-[2.5vh] font-display font-semibold text-[1.3vw] text-text max-w-[58vw]">
          The loop is the moat. The product enters once. The ritual <span className="text-red">returns daily.</span>
        </p>
      </div>
    </SlideChrome>
  );
}
