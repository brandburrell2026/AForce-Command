import { useState } from 'react';
import { Section, Eyebrow, FadeIn } from './primitives';

const OPERATORS = [
  { name: 'The Athlete', moment: 'The second before the start gun.' },
  { name: 'The Founder', moment: 'The minute before the room decides.' },
  { name: 'The Surgeon', moment: 'The breath before the first incision.' },
  { name: 'The Pilot', moment: 'The checklist before rotation.' },
  { name: 'The Chef', moment: 'The silence before service.' },
  { name: 'The Creator', moment: 'The pause before record.' },
  { name: 'The Trader', moment: 'The hold before the open.' },
];

export function OperatorsSection() {
  const [active, setActive] = useState(0);

  return (
    <Section id="operators" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <FadeIn>
              <Eyebrow index="03" tone="light">
                The Operators
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6vw,5rem)]">
                Built for the<br />
                people who<br />
                <span className="text-ink/40">cannot be off.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-8 text-ink/60 leading-relaxed max-w-sm">
                Different arenas. Same minute. AForce is engineered for the
                operators whose next sixty seconds are non-negotiable.
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <p className="mt-12 font-display text-2xl lg:text-3xl font-bold tracking-tight min-h-[3.5rem]">
                <span className="text-signal mr-2">→</span>
                {OPERATORS[active].moment}
              </p>
            </FadeIn>
          </div>

          <div className="lg:col-span-8 lg:border-l lg:border-ink/10 lg:pl-12">
            <div className="border-t border-ink/10">
              {OPERATORS.map((op, i) => (
                <FadeIn key={op.name} delay={0.04 * i}>
                  <button
                    type="button"
                    aria-pressed={active === i}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => setActive(i)}
                    className="group w-full text-left grid grid-cols-12 items-baseline gap-4 py-6 lg:py-8 border-b border-ink/10 transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                  >
                    <span className="col-span-2 lg:col-span-1 font-label text-[11px] tracking-[0.3em] text-ink/40 group-hover:text-signal transition-colors duration-500 tnum">
                      {`0${i + 1}`}
                    </span>
                    <span
                      className={`col-span-10 lg:col-span-7 font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight transition-all duration-500 ${
                        active === i
                          ? 'text-ink translate-x-2'
                          : 'text-ink/35 group-hover:text-ink/70'
                      }`}
                    >
                      {op.name}
                    </span>
                    <span className="hidden lg:block col-span-4 text-ink/45 text-sm leading-relaxed text-right">
                      {op.moment}
                    </span>
                  </button>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
