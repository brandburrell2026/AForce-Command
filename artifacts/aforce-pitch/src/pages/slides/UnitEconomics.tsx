import SlideChrome from "@/components/SlideChrome";

const TARGETS = [
  { metric: "CAC", value: "Under target", note: "Threshold-bound" },
  { metric: "Subscription conversion", value: "20%+", note: "Free → Paid" },
  { metric: "Repeat purchase", value: "28–32%", note: "Order-over-order" },
  { metric: "Contribution margin", value: "Strong", note: "Product + sub blend" },
  { metric: "Subscription revenue", value: "Recurring", note: "Monthly compounding" },
  { metric: "Free → Paid", value: "Ecosystem", note: "OS-driven conversion" },
];

export default function UnitEconomics() {
  return (
    <SlideChrome slide={21}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Unit Economics
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter mb-[6vh] max-w-[70vw]">
          Proof targets.
        </h2>

        <div className="grid grid-cols-3 gap-[1.8vw] max-w-[80vw]">
          {TARGETS.map((t) => (
            <div
              key={t.metric}
              className="border-t border-text/20 pt-[1.5vh]"
            >
              <div className="font-body uppercase tracking-[0.3em] text-[0.7vw] text-text/45 font-semibold mb-[1vh]">
                {t.metric}
              </div>
              <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">
                {t.value}
              </div>
              <div className="font-body text-[0.8vw] text-text/55 mt-[1vh]">
                {t.note}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[6vh] font-display text-[1.8vw] leading-[1.2] tracking-tight max-w-[55vw]">
          The economics become compelling{" "}
          <span className="text-primary">once the behavior repeats.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
