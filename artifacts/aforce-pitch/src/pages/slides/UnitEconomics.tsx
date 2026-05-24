import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/unit_econ_recurC_mesh.png";

const TARGETS = [
  { k: "CAC", v: "Under target", note: "Cost-efficient acquisition" },
  { k: "Subscription conversion", v: "20%+", note: "Free → paid ecosystem" },
  { k: "Repeat purchase", v: "28–32%", note: "Behavioral retention" },
  { k: "Contribution margin", v: "Strong", note: "Premium positioning" },
  { k: "Recurring revenue", v: "Compounding", note: "Subscription base" },
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
          filter: "contrast(1.05) brightness(0.95)",
          opacity: 0.88,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.72) 38%, rgba(0,0,0,0.32) 72%, rgba(0,0,0,0.05) 100%)",
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

        <div className="mt-[6vh] grid grid-cols-5 gap-x-[1.5vw] max-w-[85vw]">
          {TARGETS.map((t) => (
            <div key={t.k} className="border-l-2 border-text/15 pl-[1.1vw]">
              <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/40 font-semibold mb-[0.6vh] leading-[1.3]">
                {t.k}
              </div>
              <div className="font-display text-[1.6vw] leading-[1.05] tracking-tight text-text">
                {t.v}
              </div>
              <div className="font-body text-[0.75vw] text-text/45 leading-[1.4] mt-[0.6vh]">
                {t.note}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-body text-[1vw] text-text/55 leading-[1.6] max-w-[55vw]">
          Proof targets — not historical claims. The model becomes investable when the loop repeats predictably.
        </div>
      </div>
    </SlideChrome>
  );
}
