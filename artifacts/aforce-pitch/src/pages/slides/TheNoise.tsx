import SlideChrome from "@/components/SlideChrome";

const WORDS = [
  "ENERGY", "STIMULATION", "HYPE", "CHAOS", "CLUTTER", "OVERLOAD",
  "BUZZ", "SPIKE", "CRASH", "PUMP", "BOOST", "RUSH",
  "LOUD", "FAST", "MORE", "NOW", "HIT", "GO",
  "AMPED", "WIRED", "EDGE", "PEAK", "HYPER", "GRIND",
];

export default function TheNoise() {
  return (
    <SlideChrome slide={2}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 flex flex-wrap items-start justify-start gap-x-[2vw] gap-y-[1.5vh] p-[6vw] opacity-[0.18]">
          {WORDS.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="font-display tracking-tighter text-text leading-none"
              style={{
                fontSize: `${1.6 + ((i * 7) % 6) * 0.7}vw`,
                opacity: 0.3 + ((i * 11) % 7) / 10,
                transform: `rotate(${((i * 13) % 7) - 3}deg)`,
              }}
            >
              {w}
            </span>
          ))}
        </div>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.96) 100%)",
          }}
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-center items-start px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[4vh]">
          The Noise
        </div>
        <h2 className="font-display text-[6.6vw] leading-[0.92] tracking-tighter">
          The category is
          <br />
          <span className="text-primary">loud.</span>
        </h2>
        <div className="mt-[5vh] max-w-[45vw] font-body text-[1.1vw] text-text/55 leading-[1.6]">
          Energy. Stimulation. Hype. Chaos. Clutter. Overload.
          <br />
          Fast cuts. Loud. Overstimulated.
        </div>
      </div>
    </SlideChrome>
  );
}
