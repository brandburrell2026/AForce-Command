import { motion, useReducedMotion } from 'framer-motion';
import { Section, Eyebrow, FadeIn, EASE } from './primitives';

const COMPETITORS = [
  { label: 'Red Bull', x: 30, y: 78 },
  { label: 'Monster', x: 20, y: 86 },
  { label: 'Celsius', x: 44, y: 70 },
  { label: 'Prime', x: 37, y: 82 },
  { label: 'Gatorade', x: 26, y: 72 },
  { label: 'Liquid IV', x: 58, y: 54 },
];

export function WhitespaceSection() {
  const reduce = useReducedMotion();
  return (
    <Section id="whitespace" tone="light">
      <div className="max-w-[1500px] mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <FadeIn>
              <Eyebrow index="05" tone="light">
                Why AForce Wins
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,6vw,5.5rem)]">
                The whitespace<br />
                is <span className="text-signal">composure.</span>
              </h2>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-8 text-ink/60 leading-relaxed max-w-md">
                The entire category competes on volume — louder, faster, more
                stimulation. The premium ceiling is wide open, and only one brand
                is built to occupy it: control, not chaos.
              </p>
            </FadeIn>
          </div>

          {/* Quadrant map */}
          <FadeIn delay={0.15} className="lg:col-span-7">
            <div className="relative w-full aspect-square max-w-[560px] mx-auto border border-ink/15 rounded-sm">
              {/* axes */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-ink/10" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-ink/10" />

              {/* axis labels */}
              <span className="absolute top-3 left-1/2 -translate-x-1/2 font-label text-[9px] uppercase tracking-[0.3em] text-ink/45">
                Composure
              </span>
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 font-label text-[9px] uppercase tracking-[0.3em] text-ink/45">
                Stimulation
              </span>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 -rotate-90 origin-left font-label text-[9px] uppercase tracking-[0.3em] text-ink/45">
                Mass Market
              </span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 origin-right font-label text-[9px] uppercase tracking-[0.3em] text-ink/45">
                Premium
              </span>

              {/* competitors */}
              {COMPETITORS.map((c) => (
                <div
                  key={c.label}
                  className="absolute flex items-center gap-1.5"
                  style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%,-50%)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/30" />
                  <span className="font-label text-[9px] uppercase tracking-[0.15em] text-ink/45 whitespace-nowrap">
                    {c.label}
                  </span>
                </div>
              ))}

              {/* AForce — the open quadrant */}
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={reduce ? undefined : { duration: 1, ease: EASE, delay: 0.4 }}
                className="absolute flex flex-col items-center"
                style={{ left: '82%', top: '18%', transform: 'translate(-50%,-50%)' }}
              >
                <span className="relative w-3.5 h-3.5 rounded-full bg-signal">
                  <span className="absolute inset-[-7px] rounded-full border border-signal/40 pulse-dot" />
                </span>
                <span className="mt-2 font-display text-sm font-extrabold tracking-tight text-ink">
                  AFORCE
                </span>
              </motion.div>
            </div>
          </FadeIn>
        </div>
      </div>
    </Section>
  );
}
