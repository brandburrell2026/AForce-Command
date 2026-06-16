import { Section, Eyebrow, FadeIn, CtaLink } from './primitives';

import canBerry from '@/assets/products/real-can-berry.png';
import canWatermelon from '@/assets/products/real-can-watermelon.png';
import canSoursop from '@/assets/products/real-can-soursop.png';

const SKUS = [
  {
    code: 'AF.001',
    name: 'Berry Blast',
    fn: '+ Dulse',
    price: '$48',
    src: canBerry,
  },
  {
    code: 'AF.002',
    name: 'Watermelon Surge',
    fn: '+ Chlorella',
    price: '$48',
    src: canWatermelon,
  },
  {
    code: 'AF.003',
    name: 'Soursop Edge',
    fn: '+ Sea Moss',
    price: '$48',
    src: canSoursop,
  },
];

export function CommerceSection() {
  return (
    <Section id="commerce" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-end mb-16">
          <div className="lg:col-span-7">
            <FadeIn>
              <Eyebrow index="11" tone="light">
                Acquire
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6vw,5.5rem)]">
                Begin the<br />
                <span className="text-ink/40">protocol.</span>
              </h2>
            </FadeIn>
          </div>
          <FadeIn delay={0.2} className="lg:col-span-5">
            <p className="text-ink/60 leading-relaxed">
              Three formulations, one case at a time — or set the ritual on repeat.
              Subscription delivery keeps the minute before always stocked.
            </p>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SKUS.map((s, i) => (
            <FadeIn key={s.code} delay={0.08 * i}>
              <div className="group h-full rounded-sm bg-ink text-white p-8 flex flex-col">
                <div className="relative h-56 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(47,91,255,0.16)_0%,transparent_60%)] blur-xl" />
                  <img
                    src={s.src}
                    alt={`AForce ${s.name}`}
                    className="relative z-10 h-full w-auto object-contain transition-transform duration-700 group-hover:scale-105 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
                  />
                </div>
                <div className="font-label text-[10px] uppercase tracking-[0.3em] text-signal mb-2">
                  {s.code} — {s.fn}
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-2xl font-bold tracking-tight">
                    {s.name}
                  </h3>
                  <span className="font-label text-sm text-white/70 tnum">
                    {s.price}
                  </span>
                </div>
                <div className="mt-8 flex flex-col gap-3">
                  <CtaLink to="/products" variant="solid" tone="dark" className="w-full">
                    Subscribe
                  </CtaLink>
                  <CtaLink to="/products" variant="outline" tone="dark" className="w-full">
                    Buy once
                  </CtaLink>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Subscription strip */}
        <FadeIn delay={0.1}>
          <div className="mt-8 rounded-sm border border-ink/15 px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="font-label text-[10px] uppercase tracking-[0.3em] text-signal mb-2">
                Ritual Subscription
              </div>
              <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Monthly delivery —{' '}
                <span className="tnum">$128</span>
                <span className="text-ink/45 text-lg font-normal"> / month</span>
              </p>
              <p className="text-ink/55 text-sm mt-2">
                Cancel any time. Syncs with AForce OS.
              </p>
            </div>
            <CtaLink to="/products" variant="solid" tone="light">
              Set the ritual
            </CtaLink>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}
