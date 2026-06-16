import { Section, Eyebrow, FadeIn } from './primitives';

const PLACES = [
  { name: 'Erewhon', kind: 'Grocer' },
  { name: 'Equinox', kind: 'Performance Club' },
  { name: 'Airport Lounges', kind: 'Transit' },
  { name: 'Luxury Hotels', kind: 'Hospitality' },
  { name: 'Performance Clinics', kind: 'Recovery' },
  { name: 'Members’ Clubs', kind: 'Private' },
];

export function RetailSection() {
  return (
    <Section id="retail" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-end mb-14">
          <div className="lg:col-span-7">
            <FadeIn>
              <Eyebrow index="09" tone="light">
                The Retail World
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6vw,5.5rem)]">
                Where the operator<br />
                <span className="text-ink/40">already is.</span>
              </h2>
            </FadeIn>
          </div>
          <FadeIn delay={0.2} className="lg:col-span-5">
            <p className="text-ink/60 leading-relaxed">
              AForce lives in the rooms where high performers already move — not
              the gas-station cooler. Placement is positioning.
            </p>
          </FadeIn>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
          {PLACES.map((p, i) => (
            <FadeIn
              key={p.name}
              delay={0.05 * i}
              className="bg-paper group px-8 py-12 lg:py-16 transition-colors duration-500 hover:bg-ink hover:text-white"
            >
              <div className="font-label text-[10px] uppercase tracking-[0.35em] text-signal mb-6 tnum">
                {`0${i + 1}`}
              </div>
              <h3 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">
                {p.name}
              </h3>
              <div className="font-label text-[10px] uppercase tracking-[0.3em] text-ink/40 group-hover:text-white/50 mt-3 transition-colors duration-500">
                {p.kind}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}
