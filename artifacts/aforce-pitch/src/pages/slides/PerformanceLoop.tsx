import SlideChrome from "@/components/SlideChrome";

const STAGES = [
  { n: "01", t: "Drink", s: "the product creates entry", color: "text-primary" },
  { n: "02", t: "Ritual", s: "the ritual creates behavior", color: "text-text" },
  { n: "03", t: "Reinforcement", s: "the OS reinforces the ritual", color: "text-accent" },
  { n: "04", t: "Retention", s: "the loop compounds", color: "text-text/70" },
];

export default function PerformanceLoop() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Performance Loop
        </div>

        <h2 className="font-display text-[4.6vw] leading-[1] tracking-tighter max-w-[80vw] mb-[6vh]">
          A recurring
          <br />
          <span className="text-primary">behavioral system.</span>
        </h2>

        <div className="grid grid-cols-9 gap-[1vw] items-end">
          {STAGES.map((s, i) => (
            <div key={s.n} className="contents">
              <div className="col-span-2">
                <div className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/35 font-semibold mb-[0.5vh] tabular-nums">
                  {s.n}
                </div>
                <div className={`font-display text-[2.4vw] leading-none tracking-tight ${s.color}`}>
                  {s.t}
                </div>
                <div className="font-body text-[0.85vw] text-text/45 leading-[1.5] mt-[0.5vh]">
                  {s.s}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="col-span-1 flex items-center justify-center pb-[2vh]">
                  <span className="font-display text-[2vw] text-primary leading-none">→</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-[8vh] font-body text-[1.1vw] text-text/65 leading-[1.6] max-w-[55vw]">
          <span className="text-text/35">Not a product cycle.</span>{" "}
          <span className="text-text">The loop improves with every cycle.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
