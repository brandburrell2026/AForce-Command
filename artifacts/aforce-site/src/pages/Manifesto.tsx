import { Link } from 'wouter';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';

const AFORCE_OS_URL = '/aforce-os/';

const LOOP_STAGES = [
  'Product',
  'Ritual',
  'Reinforcement',
  'Accountability',
  'Subscription',
  'Retention',
  'Community',
];

export default function Manifesto() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />

      {/* ─── Minimal top nav ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
            <span className="text-sm font-bold tracking-[0.3em] uppercase">AForce</span>
          </Link>
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.3em] text-white/55 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        </div>
      </nav>

      {/* ─── HERO — Performance is non-negotiable ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center justify-center px-6 lg:px-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.22)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />

        {/* biometric pulse */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none">
          <div className="absolute inset-0 rounded-full border border-primary/10 breathe" />
          <div
            className="absolute inset-12 rounded-full border border-primary/15 breathe"
            style={{ animationDelay: '1.5s' }}
          />
          <div
            className="absolute inset-24 rounded-full border border-primary/20 breathe"
            style={{ animationDelay: '3s' }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center flex flex-col items-center gap-12">
          <Reveal delay={200}>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">
                The Manifesto
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
          </Reveal>

          <Reveal delay={500}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] font-bold tracking-[-0.02em] leading-[0.95]">
              Performance is<br />
              <span className="text-glow-primary">non-negotiable.</span>
            </h1>
          </Reveal>

          <Reveal delay={1100}>
            <div className="w-px h-20 bg-gradient-to-b from-primary/60 to-transparent mt-8" />
          </Reveal>
        </div>
      </section>

      {/* ─── SECTION 1 — THE PERSON ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                01 / The Person
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-24 max-w-4xl">
              There is a certain kind<br />
              of person who does not<br />
              <span className="text-white/55">get to be off.</span>
            </h2>
          </Reveal>

          <div className="space-y-10 max-w-2xl">
            {[
              'The founder before the raise.',
              'The athlete before warm-up.',
              'The performer backstage.',
              'The surgeon before rounds.',
            ].map((line, i) => (
              <Reveal key={line} delay={i * 200}>
                <div className="group flex items-center gap-6 py-4 border-b border-white/[0.06]">
                  <div className="w-1 h-1 rounded-full bg-primary group-hover:scale-150 transition-transform duration-500" />
                  <p className="text-xl md:text-2xl font-light text-white/75 tracking-tight">
                    {line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 — THE TRUTH ─── */}
      <section className="relative w-full py-48 lg:py-72 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                02 / The Truth
              </span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-32">
              Performance is not built<br />
              <span className="text-white/55">in the moment.</span>
            </h2>
          </Reveal>

          <Reveal delay={500}>
            <p className="text-3xl md:text-5xl lg:text-6xl font-serif italic text-white/85 leading-[1.15] tracking-tight max-w-4xl">
              It is built in the ritual<br />
              <span className="text-glow-primary not-italic font-bold">before it.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── SECTION 3 — THE LOOP ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                03 / The Loop
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-24 max-w-3xl">
              Behavior<br />
              <span className="text-white/55">compounds.</span>
            </h2>
          </Reveal>

          <div className="border-t border-white/[0.06]">
            {LOOP_STAGES.map((stage, i) => (
              <Reveal key={stage} delay={i * 120}>
                <div className="group grid grid-cols-12 items-baseline gap-6 py-10 lg:py-12 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-700">
                  <div className="col-span-2 lg:col-span-1 text-primary/70 group-hover:text-primary font-mono text-xs tracking-[0.3em] transition-colors duration-700">
                    0{i + 1}
                  </div>
                  <h3 className="col-span-10 lg:col-span-11 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight group-hover:translate-x-3 transition-transform duration-700">
                    {stage}
                  </h3>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 — THE STANDARD ─── */}
      <section className="relative w-full py-64 lg:py-80 px-6 lg:px-24 z-10 border-t border-white/[0.04] flex items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.18)_0%,transparent_55%)] breathe" />

        <div className="relative max-w-5xl mx-auto flex flex-col items-center gap-16">
          <Reveal>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                04 / The Standard
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
          </Reveal>

          <div className="flex flex-col gap-6 md:gap-10">
            {['Pause.', 'Hydrate.', 'Lock in.', 'Perform.'].map((word, i) => (
              <Reveal key={word} delay={i * 400}>
                <h2
                  className={`text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-bold tracking-[-0.03em] leading-[0.9] ${
                    i === 3 ? 'text-glow-primary' : 'text-white/95'
                  }`}
                >
                  {word}
                </h2>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 5 — THE FUTURE ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(180,20,30,0.20)_0%,transparent_70%)] breathe" />

        {/* neural horizon */}
        <div className="absolute inset-x-0 bottom-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-[15%] h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                05 / The Future
              </span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02]">
              Once proof is<br />
              established —<br />
              <span className="text-glow-primary">scale.</span>
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ─── FINAL — THE LOOP IS THE MOAT ─── */}
      <section className="relative w-full py-64 lg:py-80 px-6 lg:px-24 z-10 border-t border-white/[0.04] flex flex-col items-center justify-center text-center overflow-hidden bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.15)_0%,rgba(0,0,0,1)_75%)] breathe" />

        <div className="relative max-w-5xl mx-auto flex flex-col items-center gap-24">
          <Reveal>
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-[8rem] font-bold tracking-[-0.02em] leading-[0.95]">
              The loop is<br />
              <span className="text-glow-primary">the moat.</span>
            </h2>
          </Reveal>

          <Reveal delay={800}>
            <div className="flex flex-col items-center gap-8">
              <div className="w-px h-24 bg-gradient-to-b from-transparent via-primary/40 to-primary/80" />
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary pulse-dot" />
                <span className="text-2xl md:text-3xl font-bold tracking-[0.4em] uppercase">
                  AForce
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={1400}>
            <a
              href={AFORCE_OS_URL}
              className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500"
            >
              <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">
                Enter the Loop
              </span>
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">
                →
              </span>
            </a>
          </Reveal>

          <Reveal delay={2000}>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-12">
              Performance is non-negotiable.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
