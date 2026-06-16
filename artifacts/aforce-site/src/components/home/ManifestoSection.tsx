import { FadeIn } from './primitives';

const LINES = [
  'Performance is non-negotiable.',
  'The minute before is everything.',
  'Control is the only advantage.',
  'Pause. Hydrate. Lock in. Perform.',
];

export function ManifestoSection() {
  return (
    <section
      id="manifesto"
      className="relative w-full min-h-[100svh] flex flex-col justify-center overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(228,30,43,0.10)_0%,transparent_60%)]" />
      <div className="relative max-w-[1500px] mx-auto w-full">
        <FadeIn>
          <div className="flex items-center gap-4 mb-14">
            <span className="h-px w-12 bg-signal" />
            <span className="font-label text-[10px] uppercase tracking-[0.4em] text-white/50">
              10 — The Manifesto
            </span>
          </div>
        </FadeIn>

        <div className="space-y-3 lg:space-y-5">
          {LINES.map((line, i) => (
            <FadeIn key={line} delay={i * 0.12}>
              <p
                className={`font-display font-extrabold tracking-[-0.02em] leading-[1.02] text-[clamp(1.8rem,6vw,5rem)] ${
                  i === LINES.length - 1 ? 'text-white' : 'text-white/35'
                }`}
              >
                {line}
              </p>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.6}>
          <p className="mt-16 font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
            This is <span className="text-signal-glow">AForce.</span>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
