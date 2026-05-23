import SlideChrome from "@/components/SlideChrome";

const WORDS = [
  "RED BULL", "MONSTER", "CELSIUS", "PRIME", "GATORADE", "POWERADE",
  "LIQUID I.V.", "BODYARMOR", "BANG", "C4", "GHOST", "REIGN",
  "ROCKSTAR", "ALANI NU", "ZOA", "NOCCO", "ELECTROLIT", "PEDIALYTE",
  "LMNT", "NUUN", "AG1", "ATHLETIC GREENS", "RECESS", "OLIPOP",
  "POPPI", "LIQUID DEATH", "ESSENTIA", "FIJI", "SMART WATER", "VOSS",
  "VITA COCO", "5-HOUR ENERGY", "RED BULL", "MONSTER", "CELSIUS", "PRIME",
  "GATORADE", "POWERADE", "LIQUID I.V.", "BODYARMOR", "BANG", "C4",
  "GHOST", "REIGN", "ROCKSTAR", "ALANI NU", "ZOA", "NOCCO",
  "ELECTROLIT", "LMNT", "NUUN", "AG1", "RECESS", "OLIPOP",
  "POPPI", "LIQUID DEATH", "ESSENTIA", "FIJI", "SMART WATER", "VOSS",
  "VITA COCO", "PRIME", "CELSIUS", "RED BULL",
];

export default function TheNoise() {
  return (
    <SlideChrome slide={2}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 flex flex-wrap items-start justify-start gap-x-[1.6vw] gap-y-[1.2vh] p-[4vw] opacity-[0.42]">
          {WORDS.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="font-display tracking-tighter text-text leading-none"
              style={{
                fontSize: `${1.8 + ((i * 7) % 6) * 0.8}vw`,
                opacity: 0.55 + ((i * 11) % 7) / 14,
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
              "radial-gradient(ellipse 55% 45% at 30% 55%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)",
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
