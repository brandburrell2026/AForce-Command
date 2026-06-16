import { motion, useReducedMotion } from 'framer-motion';
import { EASE, CtaLink } from './primitives';

export function FinalHeroSection() {
  const reduce = useReducedMotion();
  const rise = (delay = 0, y = 30) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true },
          transition: { duration: 1.1, ease: EASE, delay },
        };
  return (
    <section
      id="final"
      className="relative w-full min-h-[90svh] flex flex-col justify-center items-center text-center overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(228,30,43,0.18)_0%,transparent_55%)] breathe" />
      <div className="absolute inset-0 grain" />

      <div className="relative z-10 max-w-[1400px] mx-auto">
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={reduce ? undefined : { duration: 1, ease: EASE }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className="h-px w-12 bg-signal" />
          <span className="font-label text-[10px] uppercase tracking-[0.45em] text-white/55">
            Performance Is Non-Negotiable
          </span>
          <span className="h-px w-12 bg-signal" />
        </motion.div>

        <h2 className="font-display font-extrabold leading-[0.92] tracking-[-0.02em] text-[clamp(2.6rem,10vw,9rem)]">
          <motion.span className="block text-white/40" {...rise(0)}>
            THE CATEGORY SCREAMS.
          </motion.span>
          <motion.span className="block" {...rise(0.18)}>
            AFORCE <span className="text-signal-glow">CONTROLS.</span>
          </motion.span>
        </h2>

        <motion.div
          {...rise(0.35, 24)}
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-5"
        >
          <CtaLink to="#commerce" variant="solid" tone="dark">
            Start Your Protocol
          </CtaLink>
          <CtaLink to="#os" variant="outline" tone="dark">
            Join AForce+
          </CtaLink>
        </motion.div>
      </div>
    </section>
  );
}
