import { Section, Eyebrow, FadeIn } from './primitives';

import scene1 from '@/assets/images/scene-1.png';
import scene2 from '@/assets/images/scene-2.png';
import scene3 from '@/assets/images/scene-3.png';

const TILES = [
  { label: 'Before the Game', img: scene1 },
  { label: 'Before the Stage', img: scene2 },
  { label: 'Before the Market', img: scene3 },
];

const WORDS = ['Before the Meeting', 'Before the Flight'];

export function RitualsSection() {
  return (
    <Section id="rituals" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <FadeIn>
          <Eyebrow index="07" tone="light">
            The Ritual
          </Eyebrow>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)] max-w-4xl">
            The ritual repeats.<br />
            <span className="text-ink/40">The result compounds.</span>
          </h2>
        </FadeIn>

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {TILES.map((t, i) => (
            <FadeIn key={t.label} delay={0.08 * i}>
              <div className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-ink">
                <img
                  src={t.img}
                  alt={t.label}
                  className="absolute inset-0 w-full h-full object-cover grayscale opacity-70 transition-all duration-700 group-hover:grayscale-0 group-hover:opacity-90 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="font-label text-[10px] uppercase tracking-[0.3em] text-signal">
                    {`0${i + 1}`}
                  </span>
                  <h3 className="mt-2 font-display text-2xl font-bold text-white tracking-tight">
                    {t.label}
                  </h3>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-5">
          {WORDS.map((w, i) => (
            <FadeIn key={w} delay={0.08 * i}>
              <div className="flex items-center justify-between rounded-sm border border-ink/15 px-8 py-10">
                <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  {w}
                </h3>
                <span className="font-label text-[10px] uppercase tracking-[0.3em] text-ink/40">
                  {`0${i + 4}`}
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}
