import Reveal from "../Reveal";

const BEATS = [
  {
    n: "01",
    title: "Pause",
    line: "Before the meeting, the race, the incision. Stillness is the first move.",
  },
  {
    n: "02",
    title: "Hydrate",
    line: "Alkaline pH 8.8. Plant minerals and electrolytes for the moment before.",
  },
  {
    n: "03",
    title: "Lock In",
    line: "Attention narrows. The noise falls away. You arrive fully present.",
  },
  {
    n: "04",
    title: "Perform",
    line: "Composure becomes output. You were ready before it began.",
  },
];

export default function Ritual() {
  return (
    <section
      id="ritual"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <Reveal>
            <div>
              <p className="eyebrow text-signal">The Ritual</p>
              <h2 className="mt-6 max-w-2xl font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl">
                Four beats before
                <br />
                you perform.
              </h2>
            </div>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {BEATS.map((b, i) => (
            <Reveal key={b.n} delay={(i % 2) * 0.1}>
              <article className="group relative overflow-hidden rounded-2xl border border-white/[0.06]">
                {/* Cinematic imagery placeholder */}
                <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-elevated to-canvas-2">
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-60 transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                    style={{
                      background:
                        "radial-gradient(70% 90% at 30% 15%, rgba(245,240,232,0.07), transparent 60%)",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-transparent" />

                  {/* Beat mark */}
                  <span className="absolute left-6 top-6 font-mono text-xs tracking-[0.2em] text-bone/40">
                    {b.n}
                  </span>

                  {/* Title + line */}
                  <div className="absolute inset-x-6 bottom-6">
                    <h3 className="font-display text-3xl text-bone sm:text-4xl">
                      {b.title}.
                    </h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-bone/60">
                      {b.line}
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
