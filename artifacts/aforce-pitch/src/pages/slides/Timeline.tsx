import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/roadmap_rmA_voidwarm.png";

const PHASES = [
  { when: "May–June 2026", what: "Infrastructure + seeding", color: "text-text" },
  { when: "July 2026", what: "Controlled soft launch", color: "text-text" },
  { when: "Aug–Oct 2026", what: "Retention + proof building", color: "text-accent" },
  { when: "January 2027", what: "America's Real Deal filming", color: "text-primary" },
  { when: "February 2027", what: "Full scale rollout begins", color: "text-primary" },
];

export default function Timeline() {
  return (
    <SlideChrome slide={28}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          opacity: 0.78,
          filter: "contrast(1.08) brightness(1.02)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.68) 40%, rgba(0,0,0,0.32) 75%, rgba(0,0,0,0.08) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/60 font-semibold mb-[3vh]">
          Timeline
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[80vw]">
          Build proof.
          <br />
          <span className="text-primary">Then scale.</span>
        </h2>

        <div className="mt-[7vh] flex flex-col gap-[2vh] max-w-[80vw]">
          {PHASES.map((p) => (
            <div key={p.when} className="grid grid-cols-12 gap-[2vw] items-baseline border-b border-text/15 pb-[1.6vh]">
              <div className="col-span-4 font-body uppercase tracking-[0.32em] text-[0.85vw] text-text/70 font-semibold tabular-nums">
                {p.when}
              </div>
              <div className={`col-span-8 font-display text-[2vw] leading-[1.1] tracking-tight ${p.color}`}>
                {p.what}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
