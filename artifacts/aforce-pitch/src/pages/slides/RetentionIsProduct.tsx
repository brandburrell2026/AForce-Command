import SlideChrome from "@/components/SlideChrome";

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
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Retention Is the Product
        </div>

        <div className="flex flex-col gap-[0.5vh]">
          <div className="font-display text-[3.2vw] leading-[1.05] tracking-tight text-text/35">
            Not the ingredients.
          </div>
          <div className="font-display text-[3.2vw] leading-[1.05] tracking-tight text-text/35">
            Not the can.
          </div>
          <div className="font-display text-[3.2vw] leading-[1.05] tracking-tight text-text/35">
            Not the app.
          </div>
          <div className="font-display text-[5.6vw] leading-[1.02] tracking-tighter text-primary mt-[1vh]">
            The behavior.
          </div>
        </div>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-6">
            <div className="font-display text-[1.6vw] leading-[1.25] tracking-tight text-text/85 max-w-[36vw]">
              The OS transforms hydration from consumption into{" "}
              <span className="text-text">accountability.</span>
            </div>
          </div>
          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Key metrics
            </div>
            <div className="flex flex-wrap gap-[0.5vw]">
              {METRICS.map((m) => (
                <span
                  key={m}
                  className="px-[0.9vw] py-[0.5vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/75"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
