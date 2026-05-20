import SlideChrome from "@/components/SlideChrome";

const FRAGMENTS = [
  "ENERGY",
  "HYPE",
  "SPIKE",
  "STIM",
  "CRASH",
  "BOOST",
  "FAST",
  "LOUD",
  "MORE",
  "PUSH",
  "RUSH",
  "POW",
  "ZAP",
  "GO",
  "AMP",
  "NOW",
  "JOLT",
  "BURN",
  "SURGE",
  "BLAST",
];

export default function TheNoise() {
  return (
    <SlideChrome slide={2}>
      <div className="absolute inset-0 overflow-hidden">
        {FRAGMENTS.map((word, i) => {
          const top = (i * 47) % 95;
          const left = (i * 73) % 92;
          const size = 1.6 + ((i * 13) % 50) / 12;
          const rot = ((i * 29) % 30) - 15;
          const opacity = 0.06 + ((i * 17) % 22) / 100;
          return (
            <div
              key={i}
              className="absolute font-display tracking-tighter text-text uppercase whitespace-nowrap"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                fontSize: `${size}vw`,
                opacity,
                transform: `rotate(${rot}deg)`,
                color: i % 5 === 0 ? "var(--slide-primary)" : undefined,
              }}
            >
              {word}
            </div>
          );
        })}
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 50%, transparent 0%, rgba(8,9,14,0.85) 70%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="font-body uppercase tracking-[0.5em] text-[0.9vw] text-text/40 font-semibold mb-[2vh]">
            The Noise
          </div>
          <div className="font-display text-[5vw] leading-[0.95] tracking-tighter text-text">
            Stimulation. <span className="text-primary">Hype.</span> Spike. Crash.
          </div>
          <div className="font-body text-[1.1vw] text-text/55 mt-[3vh] max-w-[40vw] mx-auto leading-[1.5]">
            The category is loud by design. Overstimulated. Interchangeable.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
