import SlideChrome from "@/components/SlideChrome";
import transitImg from "@assets/generated_images/system_every_moment_B.png";

const RTD_USES = ["Office", "Gym", "Recovery", "Performance days"];
const STICK_USES = ["Travel", "Portability", "Immediate correction", "Convenience"];

export default function OneSystem() {
  return (
    <SlideChrome slide={10}>
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${transitImg})`,
          filter: "grayscale(1) contrast(1.08)",
          opacity: 0.92,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.93) 0%, rgba(0,0,0,0.82) 38%, rgba(0,0,0,0.55) 64%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center pl-[8vw] pr-[42vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          One System. Multiple Formats.
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.98] tracking-tighter">
          One system.
          <br />
          <span className="text-primary">Every moment.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-1 gap-[3vh] max-w-[44vw]">
          <div className="border-l-2 border-primary pl-[1.5vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              The RTD
            </div>
            <div className="font-display text-[1.8vw] leading-none tracking-tight text-text mb-[1vh]">
              Sustained daily readiness
            </div>
            <div className="flex flex-wrap gap-[0.4vw] mt-[1vh]">
              {RTD_USES.map((u) => (
                <span
                  key={u}
                  className="px-[0.8vw] py-[0.4vh] border border-text/15 rounded-full font-body text-[0.78vw] text-text/70"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-accent pl-[1.5vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
              The Sticks
            </div>
            <div className="font-display text-[1.8vw] leading-none tracking-tight text-text mb-[1vh]">
              Portable correction
            </div>
            <div className="flex flex-wrap gap-[0.4vw] mt-[1vh]">
              {STICK_USES.map((u) => (
                <span
                  key={u}
                  className="px-[0.8vw] py-[0.4vh] border border-text/15 rounded-full font-body text-[0.78vw] text-text/70"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[5vh] font-body text-[0.95vw] text-text/45 leading-[1.6] max-w-[36vw]">
          Built to support every moment of the day.
        </div>
      </div>
    </SlideChrome>
  );
}
