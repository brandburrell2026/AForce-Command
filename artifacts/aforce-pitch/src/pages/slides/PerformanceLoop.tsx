import SlideChrome from "@/components/SlideChrome";

const STAGES = [
  { tag: "01", label: "Drink", role: "the product creates entry" },
  { tag: "02", label: "Ritual", role: "the ritual creates behavior" },
  { tag: "03", label: "Reinforcement", role: "the OS reinforces the ritual" },
  { tag: "04", label: "Retention", role: "the loop compounds" },
];

export default function TheLoop() {
  return (
    <SlideChrome slide={8}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[4vh]">
          The Loop
        </div>

        <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter max-w-[68vw]">
          The product creates <span className="text-primary">entry.</span>
          <br />
          The ritual creates <span className="text-primary">behavior.</span>
          <br />
          The OS creates <span className="text-primary">retention.</span>
        </h2>

        <div className="mt-[8vh] flex items-stretch gap-[1.5vw] max-w-[80vw]">
          {STAGES.map((s, i) => (
            <div key={s.tag} className="flex-1 flex items-stretch">
              <div className="flex-1 flex flex-col">
                <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/35 font-semibold tabular-nums">
                  {s.tag}
                </div>
                <div className="font-display text-[2.4vw] leading-[1] tracking-tight text-text mt-[1.5vh]">
                  {s.label}
                </div>
                <div className="font-body text-[0.85vw] text-text/55 mt-[1.5vh] leading-[1.5] max-w-[15vw]">
                  {s.role}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex items-start pt-[2.5vh] px-[0.5vw]">
                  <span className="font-display text-[1.8vw] text-primary/60 leading-none">→</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-[10vh] max-w-[60vw] font-display text-[1.5vw] leading-[1.2] tracking-tight">
          <span className="text-text/55">Not a product cycle.</span>{" "}
          <span className="text-text">A recurring behavioral system.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
