import { motion } from 'framer-motion';
import { Eyebrow, FadeIn, EASE, CtaLink } from './primitives';
import osTimeline from '@/assets/images/os-timeline.png';

const TIERS = [
  {
    name: 'AForce',
    price: 'With every can',
    tag: 'Free',
    features: [
      'The daily ritual tracker',
      'Hydration & protocol log',
      'Readiness snapshot',
    ],
    cta: 'Start free',
    to: '#commerce',
    featured: false,
  },
  {
    name: 'AForce+',
    price: 'Membership',
    tag: 'The System',
    features: [
      'AI performance coach',
      'Live readiness score',
      'Recovery intelligence',
      'Adaptive protocols',
    ],
    cta: 'Join AForce+',
    to: '#commerce',
    featured: true,
  },
  {
    name: 'Elite',
    price: 'By invitation',
    tag: 'Concierge',
    features: [
      '1:1 protocol design',
      'Priority product drops',
      'Lab-grade insights',
    ],
    cta: 'Request access',
    to: '/founders',
    featured: false,
  },
];

export function OSTiersSection() {
  return (
    <section
      id="os"
      className="relative w-full overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-28 lg:py-40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(47,91,255,0.12)_0%,transparent_50%)]" />
      <div className="relative max-w-[1500px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-end mb-16">
          <div className="lg:col-span-7">
            <FadeIn>
              <Eyebrow index="08" tone="dark">
                The Operating System
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6vw,5.5rem)]">
                The can is the entry.<br />
                <span className="text-white/40">The system is the habit.</span>
              </h2>
            </FadeIn>
          </div>
          <FadeIn delay={0.2} className="lg:col-span-5">
            <p className="text-white/55 leading-relaxed">
              AForce OS turns a drink into a discipline. The product opens the
              door; the protocol, the score, and the coach are what keep you
              coming back to the minute before.
            </p>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t, i) => (
            <FadeIn key={t.name} delay={0.08 * i}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.5, ease: EASE }}
                className={`relative h-full rounded-sm p-8 lg:p-10 flex flex-col ${
                  t.featured
                    ? 'bg-white text-ink'
                    : 'bg-white/[0.03] border border-white/10 text-white'
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-8 px-3 py-1 bg-signal text-white font-label text-[9px] uppercase tracking-[0.3em] rounded-full">
                    Most chosen
                  </span>
                )}
                <div
                  className={`font-label text-[10px] uppercase tracking-[0.35em] mb-6 ${
                    t.featured ? 'text-signal' : 'text-white/40'
                  }`}
                >
                  {t.tag}
                </div>
                <h3 className="font-display text-3xl lg:text-4xl font-extrabold tracking-tight">
                  {t.name}
                </h3>
                <div
                  className={`mt-2 text-sm ${
                    t.featured ? 'text-ink/55' : 'text-white/50'
                  }`}
                >
                  {t.price}
                </div>

                <ul className="mt-8 space-y-3 flex-1">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-3 text-sm ${
                        t.featured ? 'text-ink/75' : 'text-white/65'
                      }`}
                    >
                      <span className="text-signal mt-0.5">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <CtaLink
                    to={t.to}
                    variant={t.featured ? 'solid' : 'outline'}
                    tone={t.featured ? 'light' : 'dark'}
                    className="w-full"
                  >
                    {t.cta}
                  </CtaLink>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.1}>
          <div className="mt-16 relative rounded-sm overflow-hidden border border-white/10">
            <img
              src={osTimeline}
              alt="AForce OS performance timeline"
              className="w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
