import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';
import osRecoveryGreen from '@/assets/images/os-recovery-green.png';
import osRecoveryRed from '@/assets/images/os-recovery-red.png';
import osTimeline from '@/assets/images/os-timeline.png';

const AFORCE_OS_URL = '/aforce-os/';

const LOOP = [
  { n: '01', k: 'Hydrate' },
  { n: '02', k: 'Check In' },
  { n: '03', k: 'Reinforce' },
  { n: '04', k: 'Lock In' },
  { n: '05', k: 'Perform' },
  { n: '06', k: 'Recover' },
  { n: '07', k: 'Repeat' },
];

const STATES = [
  { k: 'Focus', d: 'Locked attention. The world goes quiet.' },
  { k: 'Recovery', d: 'The body returns. The system resets.' },
  { k: 'Readiness', d: 'Prepared before the moment.' },
  { k: 'Consistency', d: 'Identity expressed daily.' },
  { k: 'Discipline', d: 'The standard, held.' },
  { k: 'Accountability', d: 'Seen by yourself, first.' },
];

const RITUAL_LAYERS = [
  'Repetition',
  'Accountability',
  'Streak psychology',
  'Identity formation',
  'Protocol adherence',
  'Behavioral momentum',
];

const AI_FEATURES = [
  { k: 'Readiness insights', d: 'State, not score.' },
  { k: 'Hydration recommendations', d: 'Calibrated to your day.' },
  { k: 'Streak reinforcement', d: 'Momentum, made visible.' },
  { k: 'Accountability prompts', d: 'Quiet. Timely. Respectful.' },
  { k: 'Protocol optimization', d: 'The system learns the operator.' },
  { k: 'Pattern recognition', d: 'Behavior, surfaced.' },
];

export default function OS() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <SiteNav current="/os" />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />

        {/* ambient waveform */}
        <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-40 opacity-25 pointer-events-none" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d="M0,50 Q200,20 400,50 T800,50 T1200,50" fill="none" stroke="#ff3548" strokeWidth="0.6" />
          <path d="M0,50 Q200,80 400,50 T800,50 T1200,50" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.4" />
        </svg>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex items-center gap-4 mb-10">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">AForce OS</span>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-[-0.02em] leading-[0.98] mb-12">
                The operating system<br />
                for <span className="text-white/55">sustained</span> <span className="text-glow-primary">performance.</span>
              </h1>
            </Reveal>
            <Reveal delay={600}>
              <p className="text-lg md:text-2xl text-white/65 font-light max-w-2xl leading-relaxed mb-12">
                Hydration, ritual, accountability, behavioral reinforcement,
                and readiness — converged into a single compounding loop.
              </p>
            </Reveal>
            <Reveal delay={900}>
              <div className="flex flex-wrap gap-4">
                <a href={AFORCE_OS_URL} className="group inline-flex items-center gap-4 px-6 py-3.5 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all duration-500">
                  <span className="text-[11px] uppercase tracking-[0.35em] font-bold">Explore the OS</span>
                  <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
                </a>
                <a href="/contact" className="group inline-flex items-center gap-4 px-6 py-3.5 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
                  <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">Join Early Access</span>
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={500} className="lg:col-span-5 relative h-[560px] hidden lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.30)_0%,transparent_60%)] breathe" />
            <img src={osRecoveryGreen} alt="AForce OS readiness" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] drop-shadow-[0_40px_80px_rgba(0,0,0,0.9)]" />
          </Reveal>
        </div>
      </section>

      {/* ─── 01 PROBLEM ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-16">
          <Reveal className="lg:col-span-5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">01 / The Problem</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Performance breaks<br />
              <span className="text-white/55">when consistency breaks.</span>
            </h2>
          </Reveal>
          <Reveal delay={250} className="lg:col-span-7 lg:pt-16 space-y-6 text-lg text-white/65 font-light leading-relaxed">
            <p>Routines collapse. Accountability disappears. Behavior fragments. Systems drift.</p>
            <p>AForce OS is the infrastructure layer between intention and execution — the connective tissue that turns daily action into compounding identity.</p>
          </Reveal>
        </div>
      </section>

      {/* ─── 02 THE LOOP ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">02 / The Loop</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Behavior compounds<br /><span className="text-white/55">in real time.</span>
            </h2>
          </Reveal>

          <Reveal delay={300}>
            <div className="relative mx-auto aspect-square max-w-2xl">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-12 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-24 rounded-full border border-primary/15 breathe" />
              <div className="absolute inset-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary pulse-dot" />
              {LOOP.map((stage, i) => {
                const angle = (i / LOOP.length) * Math.PI * 2 - Math.PI / 2;
                const x = 50 + 47 * Math.cos(angle);
                const y = 50 + 47 * Math.sin(angle);
                return (
                  <div key={stage.k} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2" style={{ left: `${x}%`, top: `${y}%` }}>
                    <span className="text-primary/70 font-mono text-[9px] tracking-[0.3em]">{stage.n}</span>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-white/80 whitespace-nowrap font-bold">{stage.k}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 03 READINESS SYSTEM ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(180,20,30,0.12)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">03 / Readiness</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-10">
                Readiness, at a glance.
              </h2>
              <p className="text-lg text-white/65 font-light leading-relaxed mb-10">
                A single instrument surface — hydration, recovery, ritual,
                consistency — read in seconds, acted on in stride.
              </p>
              <ul className="space-y-3">
                {['Readiness score', 'Hydration status', 'Recovery indicator', 'Ritual completion', 'Consistency metric', 'Accountability loop'].map((f) => (
                  <li key={f} className="flex items-center gap-4 text-[11px] uppercase tracking-[0.22em] text-white/80 py-3 border-b border-white/[0.05]">
                    <div className="w-1 h-1 rounded-full bg-primary" />{f}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div className="lg:col-span-7 relative h-[640px]">
            <Reveal delay={200} className="absolute left-0 top-0 w-[55%]">
              <img src={osRecoveryRed} alt="OS readiness — alert" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" />
            </Reveal>
            <Reveal delay={400} className="absolute right-0 top-24 w-[55%]">
              <img src={osRecoveryGreen} alt="OS readiness — primed" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" />
            </Reveal>
            <Reveal delay={600} className="absolute left-[12%] bottom-0 w-[55%]">
              <img src={osTimeline} alt="OS daily timeline" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 04 RITUAL ENGINE ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">04 / Ritual Engine</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-16">
              Behavior <span className="text-glow-primary">compounds.</span>
            </h2>
          </Reveal>

          {/* signal network */}
          <Reveal delay={300}>
            <svg className="w-full h-40 opacity-60 mb-16" viewBox="0 0 1200 160" preserveAspectRatio="none">
              <path d="M0,80 Q200,40 400,80 T800,80 T1200,80" fill="none" stroke="#ff3548" strokeWidth="0.8" />
              <path d="M0,80 Q300,140 600,80 T1200,80" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.5" />
              <path d="M0,80 Q150,100 300,80 T600,80 T900,80 T1200,80" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="0.4" />
            </svg>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {RITUAL_LAYERS.map((layer, i) => (
              <Reveal key={layer} delay={i * 80}>
                <div className="py-6 border-b border-white/[0.05] flex items-baseline gap-6 group">
                  <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:translate-x-1 transition-transform duration-500">{layer}</h3>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 05 PERFORMANCE STATES ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">05 / Performance States</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Six states.<br /><span className="text-white/55">One operator.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] border border-white/[0.05]">
            {STATES.map((s, i) => (
              <Reveal key={s.k} delay={i * 90}>
                <div className="relative bg-black p-10 group overflow-hidden h-full">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,20,30,0.10)_0%,transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative">
                    <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em] block mb-6">S/{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 group-hover:text-primary transition-colors duration-500">{s.k}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 06 AFORCE AI ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(180,20,30,0.12)_0%,transparent_60%)] breathe" />
        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">06 / AForce AI</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-8">
              A behavioral<br /><span className="text-white/55">performance coach.</span>
            </h2>
            <p className="text-lg text-white/65 font-light max-w-2xl mb-20 leading-relaxed">
              Not a chatbot. An ambient intelligence layer that learns the
              operator and quietly adjusts the system around them.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {AI_FEATURES.map((f, i) => (
              <Reveal key={f.k} delay={i * 100}>
                <div className="border-t border-white/[0.06] pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                    <h3 className="text-base font-bold tracking-tight">{f.k}</h3>
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 07 COMMUNITY ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto text-center flex flex-col items-center gap-12">
          <Reveal>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">07 / Community</span>
              <div className="w-8 h-px bg-primary" />
            </div>
          </Reveal>
          <Reveal delay={250}>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.02]">
              Performance becomes<br /><span className="text-glow-primary">culture.</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <p className="text-lg md:text-xl text-white/65 font-light max-w-2xl leading-relaxed">
              Shared rituals. Accountability. Streaks. Events. The OS
              becomes the soil. Identity, the harvest.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 08 THE FUTURE ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(180,20,30,0.22)_0%,transparent_70%)] breathe" />
        <div className="absolute inset-x-0 bottom-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center flex flex-col items-center gap-16">
          <Reveal>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02]">
              The future of performance<br /><span className="text-glow-primary">is behavioral.</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <a href={AFORCE_OS_URL} className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
              <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">Enter the Loop</span>
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
