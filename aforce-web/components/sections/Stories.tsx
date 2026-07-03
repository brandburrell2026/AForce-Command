import Reveal from "../Reveal";

const STORIES = [
  {
    kicker: "The Founder",
    title: "5:14 AM, before the city wakes.",
    span: "lg:col-span-7",
    ratio: "aspect-[16/10]",
  },
  {
    kicker: "The Surgeon",
    title: "Composure is a clinical skill.",
    span: "lg:col-span-5",
    ratio: "aspect-[16/10]",
  },
  {
    kicker: "The Athlete",
    title: "The work no one applauds.",
    span: "lg:col-span-5",
    ratio: "aspect-[16/10]",
  },
  {
    kicker: "The Operator",
    title: "Readiness is a decision.",
    span: "lg:col-span-7",
    ratio: "aspect-[16/10]",
  },
];

export default function Stories() {
  return (
    <section
      id="stories"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow text-signal">Performance Stories</p>
              <h2 className="mt-6 max-w-2xl font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl">
                Built before
                <br />
                the moment.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-bone/50 sm:text-right">
              A publication of people who treat preparation as a discipline.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-12">
          {STORIES.map((s, i) => (
            <Reveal
              key={s.title}
              delay={(i % 2) * 0.1}
              variant="fade"
              className={s.span}
            >
              <article className="group relative overflow-hidden rounded-2xl border border-white/[0.06]">
                <div
                  className={`relative ${s.ratio} w-full bg-gradient-to-br from-elevated to-canvas-2`}
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-50 transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
                    style={{
                      background:
                        "radial-gradient(70% 90% at 60% 10%, rgba(245,240,232,0.06), transparent 60%)",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/10 to-transparent" />
                  <div className="absolute inset-x-6 bottom-6">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-signal/90">
                      {s.kicker}
                    </span>
                    <h3 className="mt-3 max-w-md font-display text-2xl leading-tight text-bone sm:text-3xl">
                      {s.title}
                    </h3>
                  </div>
                  <span className="absolute right-6 top-6 font-mono text-[10px] uppercase tracking-[0.2em] text-bone/30">
                    Photography
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
