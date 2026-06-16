import { Eyebrow, FadeIn } from './primitives';

const STACKS = [
  {
    k: 'Hydration',
    sub: 'Sea-mineral electrolytes',
    body: 'Magnesium, potassium and sodium from ocean sources restore the body’s baseline — the foundation everything else is built on.',
  },
  {
    k: 'Function',
    sub: 'Marine botanicals',
    body: 'Dulse, chlorella and sea moss deliver ninety-two trace minerals doing quiet, structural work beneath the surface.',
  },
  {
    k: 'Focus',
    sub: 'Clean cognition',
    body: 'Steady, controlled attention with no stimulant spike and no crash to repay. Composure you can summon on command.',
  },
];

export function ScienceSection() {
  return (
    <section
      id="science"
      className="relative w-full overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-28 lg:py-40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(47,91,255,0.10)_0%,transparent_50%)]" />
      <div className="relative max-w-[1500px] mx-auto">
        <FadeIn>
          <Eyebrow index="06" tone="dark">
            The Science
          </Eyebrow>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)] max-w-4xl">
            Composition over <span className="text-white/40">stimulation.</span>
          </h2>
        </FadeIn>

        <div className="mt-20 grid md:grid-cols-3 gap-px bg-white/10 border-y border-white/10">
          {STACKS.map((s, i) => (
            <FadeIn
              key={s.k}
              delay={0.1 * i}
              className="bg-ink px-8 py-12 lg:px-10 lg:py-16 group"
            >
              <div className="font-label text-[10px] uppercase tracking-[0.35em] text-signal mb-8 tnum">
                {`0${i + 1}`}
              </div>
              <h3 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                {s.k}
              </h3>
              <div className="font-label text-[10px] uppercase tracking-[0.3em] text-white/40 mt-2 mb-6">
                {s.sub}
              </div>
              <p className="text-white/55 text-sm leading-relaxed">{s.body}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
