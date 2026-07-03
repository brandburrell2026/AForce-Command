import Reveal from "../Reveal";

const LINES = [
  "Performance is not the moment.",
  "It is everything before it.",
  "The preparation no one applauds.",
  "Composure is a discipline.",
  "We made it a ritual.",
];

export default function Manifesto() {
  return (
    <section
      id="manifesto"
      className="relative bg-bone px-6 py-32 text-black sm:px-10 lg:px-16 lg:py-52"
    >
      <div className="mx-auto max-w-4xl">
        <Reveal variant="fade">
          <p className="eyebrow text-signal">Manifesto</p>
        </Reveal>

        <div className="mt-14 space-y-6 sm:space-y-8">
          {LINES.map((line, i) => (
            <Reveal key={line} delay={i * 0.04} amount={0.6}>
              <p className="font-display text-3xl leading-[1.15] tracking-[-0.01em] sm:text-5xl lg:text-[3.4rem]">
                {line}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal variant="fade" className="mt-16">
          <p className="font-display text-3xl leading-[1.15] tracking-[-0.01em] text-signal sm:text-5xl lg:text-[3.4rem]">
            Performance is non-negotiable.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
