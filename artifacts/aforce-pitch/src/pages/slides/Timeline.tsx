import SlideChrome from "@/components/SlideChrome";

const PHASES = [
  { when: "May–June 2026", what: "Infrastructure + seeding" },
  { when: "July 2026", what: "Controlled soft launch" },
  { when: "Aug–Oct 2026", what: "Retention + proof building" },
  { when: "January 2027", what: "America's Real Deal filming", highlight: true },
  { when: "February 2027", what: "Full scale rollout begins", highlight: true },
];

export default function Timeline() {
  return (
    <SlideChrome slide={28}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Timeline
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter mb-[6vh] max-w-[70vw]">
          Build proof.
          <br />
          <span className="text-primary">Then build scale.</span>
        </h2>

        <div className="space-y-[2vh] max-w-[75vw]">
          {PHASES.map((p, i) => (
            <div
              key={p.when}
              className="grid grid-cols-12 gap-[2vw] items-baseline border-t border-text/15 pt-[1.5vh]"
            >
              <div className="col-span-1 font-body text-[0.85vw] text-text/35 tabular-nums uppercase tracking-[0.25em]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-4 font-body uppercase tracking-[0.32em] text-[0.95vw] text-text/65 font-semibold">
                {p.when}
              </div>
              <div className={`col-span-7 font-display text-[2vw] leading-[1.15] tracking-tight ${p.highlight ? "text-primary" : "text-text"}`}>
                {p.what}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
