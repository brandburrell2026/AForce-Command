import SlideChrome from "@/components/SlideChrome";

const NOT = ["Not the ingredients.", "Not the can.", "Not the app."];

const METRICS = [
  "Repeat purchase",
  "Subscription conversion",
  "OS engagement",
  "Ritual adoption",
  "Ecosystem retention",
];

export default function RetentionIsProduct() {
  return (
    <SlideChrome slide={25}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-primary font-semibold mb-[3vh]">
          Retention Is The Product
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          The ritual is the
          <br />
          <span className="text-primary">retention engine.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-6">
            {NOT.map((n) => (
              <div
                key={n}
                className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/45 py-[0.4vh]"
              >
                {n}
              </div>
            ))}
            <div className="font-display text-[2.4vw] leading-[1.15] tracking-tight text-text mt-[1vh]">
              The behavior.
            </div>
            <div className="mt-[3vh] font-body text-[1.05vw] text-text/65 leading-[1.6] max-w-[36vw]">
              The OS transforms hydration from <span className="text-text/50">consumption</span> into <span className="text-text">accountability</span>.
            </div>
          </div>
          <div className="col-span-6 border-l border-text/15 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Key metrics
            </div>
            {METRICS.map((m) => (
              <div
                key={m}
                className="font-display text-[1.4vw] leading-[1.15] tracking-tight text-text/85 py-[1vh] border-b border-text/8"
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
