import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { Eyebrow, FadeIn } from './primitives';

const STAGES = [
  {
    t: 'T-90',
    title: 'Pause',
    body: 'Stop the noise. Drop the heart rate. Reclaim the room before it starts. The first move is stillness.',
  },
  {
    t: 'T-60',
    title: 'Hydrate',
    body: 'Sea minerals and electrolytes — composition, not stimulation. The body quietly comes online.',
  },
  {
    t: 'T-30',
    title: 'Lock In',
    body: 'Narrow the aperture to a single target. The protocol takes over the nerves so you don’t have to.',
  },
  {
    t: 'T-00',
    title: 'Perform',
    body: 'Execute. Controlled focus, on demand. The minute you rehearsed is now the minute you own.',
  },
];

export function ProtocolSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 65%', 'end 60%'],
  });
  const fillHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section
      id="protocol"
      className="relative w-full overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-28 lg:py-40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(47,91,255,0.10)_0%,transparent_50%)]" />
      <div className="relative max-w-[1500px] mx-auto">
        <FadeIn>
          <Eyebrow index="02" tone="dark">
            The Protocol
          </Eyebrow>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)]">
            Four stages.<br />
            <span className="text-white/40">One minute that decides.</span>
          </h2>
        </FadeIn>

        <div
          ref={ref}
          style={{ position: 'relative' }}
          className="mt-20 lg:mt-28 pl-10 lg:pl-16"
        >
          {/* Spine */}
          <div className="absolute left-[5px] lg:left-[7px] top-2 bottom-2 w-px bg-white/12" />
          <motion.div
            style={{ height: reduce ? '100%' : fillHeight }}
            className="absolute left-[5px] lg:left-[7px] top-2 bottom-2 w-px bg-signal origin-top"
          />

          <div className="flex flex-col gap-16 lg:gap-24">
            {STAGES.map((s, i) => (
              <FadeIn key={s.t} delay={0.05 * i} className="relative">
                {/* Node */}
                <span className="absolute -left-10 lg:-left-16 top-2 flex items-center justify-center">
                  <span className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-ink border-2 border-signal" />
                </span>
                <div className="grid lg:grid-cols-12 gap-4 lg:gap-10 items-baseline">
                  <div className="lg:col-span-3 font-label text-sm tracking-[0.3em] text-signal tnum">
                    {s.t}
                  </div>
                  <h3 className="lg:col-span-3 font-display text-4xl lg:text-6xl font-extrabold tracking-tight">
                    {s.title}
                  </h3>
                  <p className="lg:col-span-6 text-white/55 text-base lg:text-lg leading-relaxed max-w-xl">
                    {s.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
