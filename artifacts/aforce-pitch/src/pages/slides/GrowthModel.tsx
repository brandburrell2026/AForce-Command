import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/scale_econ_scaleA_flow.png";

const FLOW = ["Acquisition", "Ritual", "Retention", "Subscription", "Expansion"];

export default function GrowthModel() {
  return (
    <SlideChrome slide={27}>
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
          Growth Model
        </div>

        <h2 className="font-display text-[4.6vw] leading-[1] tracking-tighter max-w-[80vw]">
          Performance creates retention.
          <br />
          <span className="text-primary">Retention drives revenue.</span>
        </h2>

        <div className="mt-[7vh] flex items-center gap-[1vw] max-w-[88vw]">
          {FLOW.map((f, i) => (
            <div key={f} className="flex items-center gap-[1vw]">
              <div className="border-l-2 border-primary pl-[1vw]">
                <div className="font-body text-[0.65vw] tracking-[0.4em] uppercase text-text/35 font-semibold mb-[0.4vh] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="font-display text-[1.7vw] leading-none tracking-tight text-text">
                  {f}
                </div>
              </div>
              {i < FLOW.length - 1 && (
                <span className="font-display text-[1.4vw] text-primary leading-none">→</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-[8vh] max-w-[55vw] flex flex-col gap-[0.6vh]">
          <div className="font-body text-[1.05vw] text-text/55 leading-[1.55]">
            The product creates <span className="text-text">entry.</span>
          </div>
          <div className="font-body text-[1.05vw] text-text/55 leading-[1.55]">
            The ritual creates <span className="text-text">behavior.</span>
          </div>
          <div className="font-body text-[1.05vw] text-text/55 leading-[1.55]">
            The OS creates <span className="text-text">compounding value.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
