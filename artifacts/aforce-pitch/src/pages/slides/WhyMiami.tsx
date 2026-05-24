import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/generated_images/slide18_athlete_darkness.png";

const REASONS = [
  { k: "01", t: "Audience density" },
  { k: "02", t: "Founder access" },
  { k: "03", t: "Finance + performance overlap" },
  { k: "04", t: "Lower category saturation" },
  { k: "05", t: "Strong founder credibility" },
];

export default function WhyMiami() {
  return (
    <SlideChrome slide={18}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          filter: "contrast(1.12) brightness(1.02)",
          opacity: 0.78,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.62) 38%, rgba(0,0,0,0.25) 72%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/60 font-semibold mb-[3vh]">
          Why Miami / Brickell
        </div>

        <h2 className="font-display text-[5.6vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          A concentrated
          <br />
          <span className="text-primary">proof engine.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-5 gap-x-[2vw] max-w-[80vw]">
          {REASONS.map((r) => (
            <div key={r.k}>
              <div className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/50 font-semibold mb-[1vh] tabular-nums">
                {r.k}
              </div>
              <div className="font-display text-[1.4vw] leading-[1.15] tracking-tight text-text">
                {r.t}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[8vh] font-body text-[1.1vw] text-text/70 leading-[1.6] max-w-[55vw]">
          <span className="text-text/45">This is not a national launch.</span>
          <br />
          This is a concentrated proof engine.
        </div>
      </div>
    </SlideChrome>
  );
}
