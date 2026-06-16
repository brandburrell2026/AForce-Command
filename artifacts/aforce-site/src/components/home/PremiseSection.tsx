import { Section, Eyebrow, FadeIn } from './primitives';

const NEGATIONS = [
  {
    not: 'Not stimulation.',
    body: 'No jitter. No crash. No borrowed energy you pay back later.',
  },
  {
    not: 'Not sugar.',
    body: 'No candy chemistry dressed as performance. Composition over hype.',
  },
  {
    not: 'Not a trend.',
    body: 'No wellness mood-lighting. A protocol, repeated, that compounds.',
  },
];

export function PremiseSection() {
  return (
    <Section id="premise" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <FadeIn>
          <Eyebrow index="01" tone="light">
            The Premise
          </Eyebrow>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)] max-w-5xl">
            This is not a<br />
            hydration campaign.
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="mt-10 max-w-2xl text-lg sm:text-xl text-ink/65 font-light leading-relaxed">
            Every drink on the shelf screams louder. AForce does the opposite. It
            engineers the calm, controlled minute before the work that matters —
            and turns it into a system you can repeat.
          </p>
        </FadeIn>

        <div className="mt-20 grid md:grid-cols-3 gap-px bg-ink/10 border-y border-ink/10">
          {NEGATIONS.map((n, i) => (
            <FadeIn
              key={n.not}
              delay={0.1 * i}
              className="bg-paper px-8 py-12 lg:px-10 lg:py-14"
            >
              <div className="font-label text-[10px] uppercase tracking-[0.35em] text-signal mb-6">
                {`0${i + 1}`} / No
              </div>
              <h3 className="font-display text-2xl lg:text-3xl font-bold tracking-tight mb-4">
                {n.not}
              </h3>
              <p className="text-ink/55 text-sm leading-relaxed">{n.body}</p>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15}>
          <p className="mt-16 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-3xl leading-[1.15]">
            <span className="text-signal">But</span> a performance system for the
            minute before execution.
          </p>
        </FadeIn>
      </div>
    </Section>
  );
}
