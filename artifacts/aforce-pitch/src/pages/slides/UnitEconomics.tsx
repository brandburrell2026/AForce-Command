import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/unit_econ_recurC_mesh.png";

const TARGETS = [
  { v: "Efficient CAC", note: "Disciplined acquisition model" },
  { v: "20%+ attach target", note: "Subscription conversion" },
  { v: "62–65%", note: "Projected gross margin" },
  { v: "28–32%", note: "Repeat purchase rate" },
  { v: "Compounding", note: "Recurring revenue model" },
];

export default function UnitEconomics() {
  return (
    <SlideChrome slide={26}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          filter: "contrast(1.02) brightness(0.82)",
          opacity: 0.74,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0.42) 72%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Unit Economics
        </div>

        <h2 className="font-display text-[4.6vw] leading-[1] tracking-tighter max-w-[78vw]">
          The economics become compelling
          <br />
          <span className="text-primary">once the behavior repeats.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-5 gap-x-[2.6vw] max-w-[88vw]">
          {TARGETS.map((t) => (
            <div key={t.v} className="border-l border-text/15 pl-[1.3vw]">
              <div className="font-display text-[1.7vw] leading-[1.05] tracking-tight text-text">
                {t.v}
              </div>
              <div className="font-body uppercase tracking-[0.24em] text-[0.7vw] text-text/55 font-semibold mt-[1.4vh] leading-[1.4]">
                {t.note}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-body text-[1vw] text-text/55 leading-[1.6] max-w-[55vw]">
          Proof targets — not historical claims. The model becomes investable when the loop repeats predictably.
        </div>
      </div>

      {/* Forward-looking statements — legal disclaimer */}
      <div className="absolute left-[8vw] right-[8vw] bottom-[10vh] pointer-events-none">
        <div className="border-t border-text/10 pt-[1.4vh]">
          <div className="font-body text-[0.62vw] leading-[1.55] text-text/35 tracking-wide">
            <span className="uppercase tracking-[0.32em] text-text/55 font-semibold mr-[0.6vw]">
              Forward-looking statements
            </span>
            Figures shown are management projections based on current assumptions about market conditions, execution, and capital deployment. They are not guarantees of future performance. Actual results may differ materially. Provided for informational purposes only; do not constitute an offer to sell or a solicitation to buy any securities.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
