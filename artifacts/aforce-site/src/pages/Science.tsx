import { Link } from 'wouter';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';
import osRecoveryGreen from '@/assets/images/os-recovery-green.png';
import osRecoveryRed from '@/assets/images/os-recovery-red.png';
import osTimeline from '@/assets/images/os-timeline.png';

const AFORCE_OS_URL = '/aforce-os/';

const HYDRATION_METRICS = [
  { label: 'Cognitive performance', detail: 'Sustained attention degrades measurably with mild dehydration.' },
  { label: 'Reaction time', detail: 'Hydration status shifts millisecond-level response under load.' },
  { label: 'Recovery', detail: 'Fluid balance modulates the body’s return to baseline.' },
  { label: 'Focus', detail: 'Working-memory tasks are sensitive to hydration deltas.' },
  { label: 'Endurance', detail: 'Cardiovascular strain compounds when fluid intake lags.' },
  { label: 'Consistency', detail: 'Day-over-day performance variance narrows with stable hydration.' },
];

const BEHAVIORAL_LOOP = [
  'Product',
  'Ritual',
  'Reinforcement',
  'Accountability',
  'Retention',
  'Community',
];

const PHYSIOLOGY_PILLARS = [
  { k: 'Preparation', d: 'Readiness is engineered, not summoned.' },
  { k: 'Recovery', d: 'The body adapts in the spaces between effort.' },
  { k: 'Hydration', d: 'Fluid balance is the substrate of every system.' },
  { k: 'Consistency', d: 'The compounding variable in long-horizon performance.' },
  { k: 'Sleep', d: 'The most underrated performance input.' },
  { k: 'Stress management', d: 'Allostatic load is a performance tax.' },
  { k: 'Routine', d: 'Identity expressed daily.' },
];

function ScienceNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
          <span className="text-sm font-bold tracking-[0.3em] uppercase">AForce</span>
        </Link>
        <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.25em] text-white/55">
          <Link href="/manifesto" className="hover:text-white transition-colors">Manifesto</Link>
          <span className="text-white">Science</span>
          <Link href="/founders" className="hover:text-white transition-colors">Founders</Link>
        </div>
        <Link href="/" className="text-[11px] uppercase tracking-[0.3em] text-white/55 hover:text-white transition-colors">
          ← Back
        </Link>
      </div>
    </nav>
  );
}

export default function Science() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <ScienceNav />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(180,20,30,0.15)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />

        {/* telemetry grid backdrop */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" preserveAspectRatio="none">
          <defs>
            <pattern id="sci-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sci-grid)" />
        </svg>

        {/* biometric waveform */}
        <svg className="absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full h-32 opacity-30 pointer-events-none" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path
            d="M0,50 L200,50 L220,30 L240,70 L260,20 L280,80 L300,50 L500,50 L520,40 L540,60 L560,30 L580,70 L600,50 L800,50 L820,25 L840,75 L860,50 L1200,50"
            fill="none"
            stroke="#ff3548"
            strokeWidth="1"
            className="breathe"
          />
        </svg>

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">
                Science
              </span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-[-0.02em] leading-[0.98] mb-12 max-w-5xl">
              The science of<br />
              <span className="text-white/55">sustained</span> <span className="text-glow-primary">performance.</span>
            </h1>
          </Reveal>

          <Reveal delay={600}>
            <p className="text-lg md:text-2xl text-white/65 font-light max-w-3xl leading-relaxed">
              AForce combines hydration, behavioral reinforcement,
              accountability systems, and ritual psychology into a
              compounding performance loop.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 01 HYDRATION ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 z-10 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 lg:gap-24 mb-24">
            <Reveal className="lg:col-span-5">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                  01 / Hydration
                </span>
              </div>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                Hydration<br />
                <span className="text-white/55">influences performance.</span>
              </h2>
            </Reveal>
            <Reveal delay={250} className="lg:col-span-7 lg:pt-20">
              <p className="text-lg md:text-xl text-white/65 font-light leading-relaxed">
                The relationship between fluid balance and human performance is
                one of the most consistently measured in physiology. AForce is
                designed around it — not as a miracle input, but as the
                foundation that lets every other system perform.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] border border-white/[0.05]">
            {HYDRATION_METRICS.map((m, i) => (
              <Reveal key={m.label} delay={i * 90} className="bg-black p-10 group">
                <div className="text-primary/70 font-mono text-[10px] tracking-[0.3em] mb-6">
                  H/{String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-4 group-hover:text-primary transition-colors duration-500">
                  {m.label}
                </h3>
                <p className="text-sm text-white/55 leading-relaxed">{m.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 02 BEHAVIORAL SCIENCE ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden bg-[#020202]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16 mb-24">
            <Reveal className="lg:col-span-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                  02 / Behavioral Science
                </span>
              </div>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                Behavior<br />
                <span className="text-white/55">compounds.</span>
              </h2>
            </Reveal>
            <Reveal delay={250} className="lg:col-span-6 lg:pt-20">
              <p className="text-lg md:text-xl text-white/65 font-light leading-relaxed">
                Repetition. Reinforcement. Habit formation. Accountability.
                Streak psychology. Contextual nudges. AForce frames every
                interaction as a node in a loop that strengthens over time.
              </p>
            </Reveal>
          </div>

          {/* Orbital loop diagram */}
          <Reveal delay={400}>
            <div className="relative mx-auto aspect-square max-w-2xl">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-12 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-24 rounded-full border border-primary/15 breathe" />
              <div className="absolute inset-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary pulse-dot" />

              {BEHAVIORAL_LOOP.map((node, i) => {
                const angle = (i / BEHAVIORAL_LOOP.length) * Math.PI * 2 - Math.PI / 2;
                const x = 50 + 47 * Math.cos(angle);
                const y = 50 + 47 * Math.sin(angle);
                return (
                  <div
                    key={node}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/75 whitespace-nowrap font-bold">
                      {node}
                    </span>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={700}>
            <p className="text-center text-xs uppercase tracking-[0.4em] text-white/40 mt-16">
              Product → Ritual → Reinforcement → Accountability → Retention → Community
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 03 THE AFORCE OS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(180,20,30,0.12)_0%,transparent_55%)] breathe" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                  03 / AForce OS
                </span>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-10">
                An operating system<br />
                <span className="text-white/55">for human performance.</span>
              </h2>
            </Reveal>
            <Reveal delay={350}>
              <p className="text-lg text-white/65 font-light leading-relaxed mb-10">
                Readiness. Check-ins. Streaks. Reinforcement. Protocol adherence.
                Performance awareness. The app is not a tracker — it is the
                instrument through which the loop closes.
              </p>
            </Reveal>
            <Reveal delay={500}>
              <ul className="space-y-4">
                {[
                  'Readiness scoring at-a-glance',
                  'Frictionless protocol check-ins',
                  'Streak + reinforcement system',
                  'Behavioral telemetry, surfaced clearly',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-4 text-sm uppercase tracking-[0.15em] text-white/80">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="lg:col-span-7 relative h-[640px]">
            <Reveal delay={300} className="absolute left-0 top-0 w-[55%]">
              <img
                src={osRecoveryGreen}
                alt="AForce OS recovery — green state"
                className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
                loading="lazy"
              />
            </Reveal>
            <Reveal delay={500} className="absolute right-0 top-20 w-[55%]">
              <img
                src={osRecoveryRed}
                alt="AForce OS recovery — red state"
                className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
                loading="lazy"
              />
            </Reveal>
            <Reveal delay={700} className="absolute left-[10%] bottom-0 w-[55%]">
              <img
                src={osTimeline}
                alt="AForce OS daily timeline"
                className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
                loading="lazy"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 04 PHYSIOLOGY + PERFORMANCE ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                04 / Physiology
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-24 max-w-4xl">
              Performance starts<br />
              <span className="text-white/55">before the moment.</span>
            </h2>
          </Reveal>

          {/* Low-frequency waveform */}
          <Reveal delay={300}>
            <svg className="w-full h-20 mb-16 opacity-50" viewBox="0 0 1200 80" preserveAspectRatio="none">
              <path
                d="M0,40 Q150,10 300,40 T600,40 T900,40 T1200,40"
                fill="none"
                stroke="#ff3548"
                strokeWidth="0.8"
              />
              <path
                d="M0,40 Q150,70 300,40 T600,40 T900,40 T1200,40"
                fill="none"
                stroke="white"
                strokeOpacity="0.15"
                strokeWidth="0.5"
              />
            </svg>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-2 border-t border-white/[0.06]">
            {PHYSIOLOGY_PILLARS.map((p, i) => (
              <Reveal key={p.k} delay={i * 100}>
                <div className="group flex items-baseline justify-between gap-8 py-8 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-500">
                  <div className="flex items-baseline gap-6">
                    <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:translate-x-1 transition-transform duration-500">
                      {p.k}
                    </h3>
                  </div>
                  <p className="text-sm text-white/50 text-right max-w-xs">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 05 PHILOSOPHY ─── */}
      <section className="relative w-full py-48 lg:py-72 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.14)_0%,transparent_55%)] breathe" />

        <div className="relative max-w-5xl mx-auto text-center flex flex-col items-center gap-16">
          <Reveal>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                05 / Philosophy
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
          </Reveal>

          <Reveal delay={300}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              AForce does not<br />
              chase hacks.<br />
              <span className="text-glow-primary">It builds systems.</span>
            </h2>
          </Reveal>

          <Reveal delay={700}>
            <p className="text-lg md:text-xl text-white/65 font-light max-w-2xl leading-relaxed">
              Sustainable performance is the product of measurable routines,
              compounding behavior, and consistency held over intensity. The
              system is the standard.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 06 DISCLAIMERS + INTEGRITY ─── */}
      <section className="relative w-full py-32 lg:py-48 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-white/30" />
              <span className="text-white/55 uppercase tracking-[0.3em] text-[10px] font-bold">
                06 / Integrity
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-16 max-w-3xl">
              What AForce is,<br />
              <span className="text-white/55">and what it is not.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            {[
              { label: 'AForce is', items: ['A behavioral system supporting consistency', 'A hydration ritual built around real fluid balance', 'A telemetry layer for self-awareness', 'A performance environment, not a prescription'] },
              { label: 'AForce is not', items: ['Medical treatment or diagnosis', 'A guarantee of outcomes — results vary', 'A replacement for a clinician’s guidance', 'A claim of clinical efficacy beyond hydration'] },
            ].map((col, i) => (
              <Reveal key={col.label} delay={i * 200}>
                <h3 className="text-xs uppercase tracking-[0.3em] text-primary mb-8 font-bold">{col.label}</h3>
                <ul className="space-y-6">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-start gap-4 text-base text-white/70 leading-relaxed">
                      <div className="w-1 h-1 rounded-full bg-primary mt-2.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mt-20 pt-12 border-t border-white/[0.04]">
              Data + habits work together. Outcomes belong to the individual.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── Closing CTA ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-4xl mx-auto flex flex-col items-center gap-12">
          <Reveal>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Performance is<br />
              <span className="text-glow-primary">engineered.</span>
            </h2>
          </Reveal>

          <Reveal delay={400}>
            <a
              href={AFORCE_OS_URL}
              className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500"
            >
              <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">
                Enter the Loop
              </span>
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
