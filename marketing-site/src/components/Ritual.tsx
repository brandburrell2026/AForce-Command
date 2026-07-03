import { useReveal } from "../hooks/useReveal";

const BEATS = [
  {
    step: "01",
    title: "Pause.",
    line: "Before the meeting, the race, the incision. Stillness is the first move.",
  },
  {
    step: "02",
    title: "Hydrate.",
    line: "Alkaline pH 8.8. Electrolytes and minerals, engineered for the moment before.",
  },
  {
    step: "03",
    title: "Lock-In.",
    line: "Attention narrows. The noise falls away. You arrive fully present.",
  },
  {
    step: "04",
    title: "Perform.",
    line: "Composure becomes output. You were ready before it began.",
  },
];

export default function Ritual() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="ritual"
      className="border-t border-white/[0.06] px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
    >
      <div ref={ref} className="mx-auto max-w-6xl">
        <p className="eyebrow reveal text-signal">The Ritual</p>
        <h2 className="reveal mt-4 max-w-2xl font-display text-3xl leading-tight tracking-[-0.01em] text-bone sm:text-4xl">
          Four beats before you perform.
        </h2>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
          {BEATS.map((beat, i) => (
            <li
              key={beat.step}
              className="reveal flex flex-col bg-canvas p-8 lg:p-10"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span className="font-mono text-xs tracking-[0.2em] text-bone/30">
                {beat.step}
              </span>
              <h3 className="mt-8 font-display text-2xl text-bone">
                {beat.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-bone/55">
                {beat.line}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
