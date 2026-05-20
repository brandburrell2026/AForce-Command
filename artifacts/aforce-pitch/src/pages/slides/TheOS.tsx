import SlideChrome from "@/components/SlideChrome";

const FEATURES = [
  "Hydration scoring",
  "Onboarding",
  "AI coaching",
  "Reminders",
  "Streaks",
  "Recovery insights",
  "Behavioral reinforcement",
  "Subscription ecosystem",
];

export default function TheOS() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-y-0 right-[2vw] w-[42vw] flex items-center justify-center">
        <div
          className="absolute w-[34vw] h-[34vw] rounded-full opacity-40 blur-[6vw]"
          style={{
            background:
              "radial-gradient(circle, rgba(182,255,0,0.30) 0%, rgba(229,51,65,0.18) 45%, transparent 72%)",
          }}
        />
        <img
          src={`${base}ai-coach-phone-mockup.png`}
          alt=""
          className="relative h-[78vh] object-contain"
          style={{
            filter:
              "drop-shadow(0 30px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(229,51,65,0.20))",
          }}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 w-[55vw] pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--slide-bg) 65%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The OS
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.92] tracking-tighter max-w-[52vw]">
          Human first.
          <br />
          <span className="text-text/45">System second.</span>
        </h2>

        <div className="mt-[4vh] max-w-[42vw]">
          <div className="font-body text-[1.05vw] text-text/65 leading-[1.6]">
            The OS quietly reinforces ritual, accountability, readiness, consistency, habit formation.
          </div>
          <div className="mt-[2vh] font-display text-[1.5vw] leading-[1.2] tracking-tight text-text">
            The OS <span className="text-primary">proves</span> the promise.
            <br />
            <span className="text-text/55">It does not become the story.</span>
          </div>
        </div>

        <div className="mt-[4vh] max-w-[42vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
            The system includes
          </div>
          <div className="grid grid-cols-2 gap-y-[0.6vh] gap-x-[1.5vw]">
            {FEATURES.map((f) => (
              <div key={f} className="font-body text-[0.9vw] text-text/80">
                — {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
