import { motion, useReducedMotion } from 'framer-motion';
import { EASE, CtaLink } from './primitives';

const RITUAL = ['Pause', 'Hydrate', 'Lock In', 'Perform'];

export function HeroSection() {
  const reduce = useReducedMotion();
  const rise = (delay: number, y = 40) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.2, ease: EASE, delay },
        };
  const fade = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 1.4, ease: EASE, delay },
        };
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] w-full flex flex-col justify-center overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 pt-28 pb-20"
    >
      {/* Cinematic depth — deep red signal pooling at the base, fading to ink */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(228,30,43,0.16)_0%,transparent_55%)] breathe" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(47,91,255,0.10)_0%,transparent_45%)]" />
      <div className="absolute inset-0 grain" />

      <div className="relative z-10 max-w-[1500px] mx-auto w-full">
        <motion.div {...rise(0.1, 16)} className="flex items-center gap-4 mb-10">
          <span className="h-px w-12 bg-signal signal-sweep" />
          <span className="font-label text-[10px] uppercase tracking-[0.45em] text-white/55">
            Performance Is Non-Negotiable
          </span>
        </motion.div>

        <h1 className="font-display font-extrabold leading-[0.92] tracking-[-0.02em] text-[clamp(2.9rem,11vw,10rem)]">
          <motion.span className="block" {...rise(0.2)}>
            CONTROLLED FOCUS
          </motion.span>
          <motion.span className="block text-white/40" {...rise(0.36)}>
            BEFORE EXECUTION
          </motion.span>
        </h1>

        <motion.p
          {...rise(0.55, 24)}
          className="mt-10 max-w-xl text-lg sm:text-xl text-white/60 font-light leading-relaxed"
        >
          AForce owns the minute before execution. Not a hydration brand — a
          performance system for people who do not get to be off.
        </motion.p>

        <motion.div
          {...rise(0.7, 24)}
          className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5"
        >
          <CtaLink to="#commerce" variant="solid" tone="dark">
            Start Your Protocol
          </CtaLink>
          <CtaLink to="#os" variant="outline" tone="dark">
            Join AForce+
          </CtaLink>
        </motion.div>

        {/* Ritual ledger */}
        <motion.div
          {...fade(1)}
          className="mt-20 lg:mt-28 flex flex-wrap items-center gap-x-8 gap-y-3 font-label text-[10px] uppercase tracking-[0.35em] text-white/45"
        >
          {RITUAL.map((r, i) => (
            <span key={r} className="flex items-center gap-8">
              <span>
                <span className="text-signal mr-2">{`T-${90 - i * 30}`.padEnd(4)}</span>
                {r}
              </span>
              {i < RITUAL.length - 1 && (
                <span className="hidden sm:inline h-px w-6 bg-white/15" />
              )}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        {...fade(1.3)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <span className="font-label text-[9px] uppercase tracking-[0.4em] text-white/35">
          Scroll
        </span>
        <span className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
      </motion.div>
    </section>
  );
}
