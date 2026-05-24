import SlideChrome from "@/components/SlideChrome";
import ritualImg from "@assets/generated_images/prep_athlete_taping_wrists.png";

const STEPS = [
  { word: "Pause.", color: "text-primary" },
  { word: "Hydrate.", color: "text-text" },
  { word: "Lock in.", color: "text-accent" },
  { word: "Perform.", color: "text-text/70" },
];

const BUILT_AROUND = [
  "Onboarding",
  "Retention",
  "OS",
  "Packaging",
  "Content",
  "Community",
  "Reminders",
  "Accountability",
  "Subscription",
];

export default function TheRitual() {
  return (
    <SlideChrome slide={7}>
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${ritualImg})`,
          filter: "grayscale(0.2) contrast(1.05)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.8) 38%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.25) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.7) 100%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Ritual
        </div>

        <div className="flex flex-col gap-[1vh] mb-[6vh]">
          {STEPS.map((s) => (
            <div
              key={s.word}
              className={`font-display text-[7vw] leading-[0.92] tracking-tighter ${s.color}`}
            >
              {s.word}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-[3vw] items-end">
          <div className="col-span-6">
            <div className="font-body text-[1.1vw] text-text/65 leading-[1.6] max-w-[36vw]">
              This is not a tagline. It is the behavioral operating system. The ritual creates accountability. Accountability creates retention.
            </div>
          </div>
          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Everything is built around it
            </div>
            <div className="flex flex-wrap gap-[0.5vw]">
              {BUILT_AROUND.map((b) => (
                <span
                  key={b}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.85vw] text-text/75"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
