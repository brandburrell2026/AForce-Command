import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/generated_images/slide18_athlete_darkness.png";

const STANDARDS = [
  { k: "01", t: "Pressure as ritual" },
  { k: "02", t: "Discipline over motivation" },
  { k: "03", t: "Quiet accountability" },
  { k: "04", t: "Focus without performance theater" },
  { k: "05", t: "Standards held in private" },
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
          filter: "contrast(1.14) brightness(1.0)",
          opacity: 0.82,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.62) 42%, rgba(0,0,0,0.2) 76%, rgba(0,0,0,0.02) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/55 font-semibold mb-[3vh]">
          The Athlete's Standard
        </div>

        <h2 className="font-display text-[5vw] leading-[0.96] tracking-tighter max-w-[58vw] text-text/95">
          Performance begins
          <br />
          <span className="text-primary">before the world sees it.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-5 gap-x-[1.6vw] max-w-[62vw]">
          {STANDARDS.map((r) => (
            <div key={r.k}>
              <div className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/50 font-semibold mb-[1vh] tabular-nums">
                {r.k}
              </div>
              <div className="font-display text-[1.3vw] leading-[1.18] tracking-tight text-text/90">
                {r.t}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[8vh] font-body text-[1.1vw] text-text/75 leading-[1.6] max-w-[48vw]">
          <span className="text-text/45">We are not building for the crowd.</span>
          <br />
          We are building for the person who shows up before anyone is watching.
        </div>
      </div>
    </SlideChrome>
  );
}
