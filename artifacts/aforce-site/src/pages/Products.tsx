import { useState } from 'react';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';
import osRecoveryGreen from '@/assets/images/os-recovery-green.png';
import osTimeline from '@/assets/images/os-timeline.png';

const AFORCE_OS_URL = '/aforce-os/';

type Silhouette = 'stick' | 'can' | 'kit' | 'bundle' | 'stack';

function ProductSilhouette({ shape }: { shape: Silhouette }) {
  if (shape === 'can') {
    return (
      <div className="relative w-24 h-72 mx-auto">
        <div className="absolute inset-0 rounded-[10px] bg-gradient-to-b from-[#1a1a1a] via-[#0a0a0a] to-black border border-white/[0.08]" />
        <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-white/15 to-transparent rounded-t-[10px]" />
        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-white/10 to-transparent rounded-b-[10px]" />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-primary pulse-dot" />
          <span className="text-white/70 text-[8px] tracking-[0.35em] font-bold">AFORCE</span>
        </div>
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.25)_0%,transparent_70%)] -z-10 breathe" />
      </div>
    );
  }
  if (shape === 'stick') {
    return (
      <div className="relative w-10 h-72 mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#1a1a1a] via-[#0a0a0a] to-black border border-white/[0.08]" />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 rotate-90">
          <span className="text-white/70 text-[7px] tracking-[0.4em] font-bold whitespace-nowrap">AFORCE — STICK</span>
        </div>
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.25)_0%,transparent_70%)] -z-10 breathe" />
      </div>
    );
  }
  if (shape === 'kit' || shape === 'bundle' || shape === 'stack') {
    const count = shape === 'kit' ? 3 : shape === 'bundle' ? 4 : 5;
    return (
      <div className="relative w-full h-72 flex items-end justify-center gap-2 px-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="relative bg-gradient-to-b from-[#1a1a1a] via-[#0a0a0a] to-black border border-white/[0.08] rounded-[6px]"
            style={{
              width: i % 2 === 0 ? 36 : 22,
              height: i % 2 === 0 ? '92%' : '72%',
            }}
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
              <div className="w-1 h-1 mx-auto rounded-full bg-primary/80" />
            </div>
          </div>
        ))}
        <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.22)_0%,transparent_70%)] -z-10 breathe" />
      </div>
    );
  }
  return null;
}

const PRODUCTS: {
  k: string;
  shape: Silhouette;
  tagline: string;
  price: string;
  attrs: string[];
}[] = [
  { k: 'Hydration Sticks', shape: 'stick', tagline: 'The portable ritual.', price: '$36', attrs: ['Hydration', 'Ritual', 'Focus'] },
  { k: 'Performance Cans', shape: 'can', tagline: 'Daily readiness, formalized.', price: '$48', attrs: ['Hydration', 'Readiness', 'Recovery'] },
  { k: 'Starter Kit', shape: 'kit', tagline: 'Begin the loop.', price: '$84', attrs: ['Onboarding', 'Sticks', 'Can'] },
  { k: 'Ritual Bundle', shape: 'bundle', tagline: 'A month of preparation.', price: '$128', attrs: ['Daily ritual', '30-day cycle', 'OS sync'] },
  { k: 'Performance Stack', shape: 'stack', tagline: 'The full operator system.', price: '$196', attrs: ['Full stack', 'Subscription-ready', 'Identity'] },
];

const RITUAL_STAGES = [
  { n: '01', k: 'Open' },
  { n: '02', k: 'Hydrate' },
  { n: '03', k: 'Check In' },
  { n: '04', k: 'Lock In' },
  { n: '05', k: 'Perform' },
  { n: '06', k: 'Recover' },
  { n: '07', k: 'Repeat' },
];

const STATES = [
  { k: 'Focus', d: 'Attention, locked.' },
  { k: 'Hydration', d: 'The substrate of every system.' },
  { k: 'Recovery', d: 'The system returns to baseline.' },
  { k: 'Readiness', d: 'Prepared before the moment.' },
  { k: 'Consistency', d: 'Identity, expressed daily.' },
  { k: 'Discipline', d: 'The standard, held.' },
];

const INGREDIENTS = [
  { k: 'Electrolyte matrix', d: 'Sodium · potassium · magnesium · calcium balanced for sustained fluid retention.' },
  { k: 'Trace minerals', d: 'A measured floor of microminerals supporting cellular function.' },
  { k: 'Adaptogenic support', d: 'Restrained inclusion of botanicals associated with stress modulation.' },
  { k: 'B-complex layer', d: 'Cofactors that support cellular energy metabolism.' },
  { k: 'Hydration carriers', d: 'Co-formulation optimized for fluid uptake.' },
  { k: 'Zero artificial color', d: 'Editorial integrity in the formulation, not just the packaging.' },
];

const TESTIMONIALS = [
  { q: 'It became part of my preparation ritual.', who: 'Founder · early-stage SaaS' },
  { q: 'The first thing in my hand before a long session.', who: 'Performing surgeon' },
  { q: 'I stopped negotiating with my morning.', who: 'Endurance athlete' },
  { q: 'Discipline made effortless.', who: 'Creative director' },
];

const EVENTS = [
  { k: 'Founder dinners', d: 'Curated rooms. Operators only.' },
  { k: 'Hydration labs', d: 'Tactile sessions inside the ritual.' },
  { k: 'Performance activations', d: 'Branded environments for the loop.' },
  { k: 'Launch experiences', d: 'Quiet rollouts for the inner ecosystem.' },
];

function ProductCard({ p, i }: { p: (typeof PRODUCTS)[number]; i: number }) {
  return (
    <Reveal delay={i * 100}>
      <div className="relative bg-black border border-white/[0.05] hover:border-primary/40 p-10 group overflow-hidden transition-colors duration-700 h-full flex flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,20,30,0.12)_0%,transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute inset-0 grain opacity-30" />
        <div className="relative flex-1 flex items-center justify-center mb-10 transition-transform duration-700 group-hover:-translate-y-2">
          <ProductSilhouette shape={p.shape} />
        </div>
        <div className="relative flex items-baseline justify-between mb-3">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight">{p.k}</h3>
          <span className="text-sm font-mono text-white/55">{p.price}</span>
        </div>
        <p className="relative text-sm text-white/55 mb-6">{p.tagline}</p>
        <div className="relative flex flex-wrap gap-2 mb-8">
          {p.attrs.map((a) => (
            <span key={a} className="text-[10px] uppercase tracking-[0.25em] text-white/55 border border-white/[0.08] px-2.5 py-1.5 rounded-full">
              {a}
            </span>
          ))}
        </div>
        <button className="relative w-full inline-flex items-center justify-center gap-3 py-3.5 border border-white/15 group-hover:border-primary/70 rounded-full transition-all duration-500">
          <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">Add to Ritual</span>
          <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </Reveal>
  );
}

function SubscriptionToggle() {
  const [mode, setMode] = useState<'monthly' | 'quarterly'>('monthly');
  const price = mode === 'monthly' ? '$128' : '$340';
  const note = mode === 'monthly' ? 'per month · cancel any time' : 'per quarter · saves 11%';

  return (
    <div className="relative bg-black border border-white/[0.08] p-10 lg:p-14 max-w-3xl mx-auto overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
      <div className="relative">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-white/55 font-bold">AForce Membership</span>
          </div>
          <div className="inline-flex border border-white/10 rounded-full p-1 text-[10px] uppercase tracking-[0.25em]">
            {(['monthly', 'quarterly'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full transition-colors ${mode === m ? 'bg-white text-black font-bold' : 'text-white/55 hover:text-white'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <h3 className="text-5xl md:text-7xl font-bold tracking-tight mb-3">
          {price}
        </h3>
        <p className="text-sm text-white/45 uppercase tracking-[0.3em] mb-10">{note}</p>

        <ul className="space-y-4 mb-12">
          {[
            'Monthly ritual delivery',
            'AForce OS sync + telemetry',
            'Accountability + streak engine',
            'Early access to drops',
            'Community + event invitations',
            'Premium member ecosystem',
          ].map((f) => (
            <li key={f} className="flex items-center gap-4 text-sm text-white/75">
              <div className="w-1 h-1 rounded-full bg-primary" />
              {f}
            </li>
          ))}
        </ul>

        <button className="w-full inline-flex items-center justify-center gap-4 py-4 bg-white text-black hover:bg-primary hover:text-white rounded-full transition-all duration-500 group">
          <span className="text-[11px] uppercase tracking-[0.35em] font-bold">Begin Membership</span>
          <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}

export default function Products() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <SiteNav current="/products" />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(180,20,30,0.20)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />
        <svg className="absolute inset-x-0 top-2/3 w-full h-32 opacity-20" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d="M0,50 Q300,30 600,50 T1200,50" fill="none" stroke="#ff3548" strokeWidth="0.6" />
        </svg>

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex items-center gap-4 mb-10">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">The System</span>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-[-0.02em] leading-[0.98] mb-12">
                Performance begins<br />
                <span className="text-white/55">before</span> <span className="text-glow-primary">the moment.</span>
              </h1>
            </Reveal>
            <Reveal delay={600}>
              <p className="text-lg md:text-2xl text-white/65 font-light max-w-2xl leading-relaxed mb-12">
                AForce transforms hydration into ritual, readiness, and
                behavioral reinforcement.
              </p>
            </Reveal>
            <Reveal delay={900}>
              <div className="flex flex-wrap gap-4">
                <a href="#shop" className="group inline-flex items-center gap-4 px-6 py-3.5 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all duration-500">
                  <span className="text-[11px] uppercase tracking-[0.35em] font-bold">Shop the System</span>
                  <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
                </a>
                <a href="#ritual" className="group inline-flex items-center gap-4 px-6 py-3.5 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
                  <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">Start the Ritual</span>
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={500} className="lg:col-span-5 relative h-[520px] hidden lg:flex items-center justify-center">
            <div className="relative flex items-end gap-8">
              <div className="translate-y-4 opacity-90">
                <ProductSilhouette shape="stick" />
              </div>
              <ProductSilhouette shape="can" />
              <div className="translate-y-6 opacity-90">
                <ProductSilhouette shape="stick" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 01 FEATURED PRODUCTS ─── */}
      <section id="shop" className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">01 / The Catalog</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Five formats.<br /><span className="text-white/55">One system.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] border border-white/[0.05]">
            {PRODUCTS.map((p, i) => (
              <ProductCard key={p.k} p={p} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── 02 THE RITUAL ─── */}
      <section id="ritual" className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">02 / The Ritual</span>
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-20">
              <span className="text-white/55">Pause.</span> Hydrate.<br />
              <span className="text-white/55">Lock in.</span> <span className="text-glow-primary">Perform.</span>
            </h2>
          </Reveal>

          <Reveal delay={300}>
            <div className="relative mx-auto aspect-square max-w-2xl">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-10 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-20 rounded-full border border-primary/15 breathe" />
              <div className="absolute inset-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary pulse-dot" />
              {RITUAL_STAGES.map((s, i) => {
                const angle = (i / RITUAL_STAGES.length) * Math.PI * 2 - Math.PI / 2;
                const x = 50 + 48 * Math.cos(angle);
                const y = 50 + 48 * Math.sin(angle);
                return (
                  <div key={s.k} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2" style={{ left: `${x}%`, top: `${y}%` }}>
                    <span className="text-primary/70 font-mono text-[9px] tracking-[0.3em]">{s.n}</span>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-white/80 whitespace-nowrap font-bold">{s.k}</span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 03 OS INTEGRATION ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(180,20,30,0.12)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">03 / OS Integration</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-10">
                Every product,<br /><span className="text-white/55">part of the loop.</span>
              </h2>
              <p className="text-lg text-white/65 font-light leading-relaxed mb-10">
                Scan a stick. Check in a can. Close the ritual. Each format is
                an input into the AForce OS — readiness, streaks,
                accountability, and telemetry, all updating in stride.
              </p>
              <a href="/os" className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] font-bold text-primary">
                Explore the OS
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
              </a>
            </Reveal>
          </div>
          <div className="lg:col-span-7 relative h-[520px]">
            <Reveal delay={200} className="absolute left-0 top-0 w-[55%]">
              <img src={osRecoveryGreen} alt="OS readiness" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" loading="lazy" />
            </Reveal>
            <Reveal delay={400} className="absolute right-0 bottom-0 w-[55%]">
              <img src={osTimeline} alt="OS timeline" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" loading="lazy" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 04 PERFORMANCE STATES ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">04 / Performance States</span>
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

      {/* ─── 05 INGREDIENT + SCIENCE ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">05 / Ingredients</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-8 max-w-3xl">
              Performance, formulated.
            </h2>
            <p className="text-sm text-white/40 uppercase tracking-[0.3em] mb-20">Measured. Declared. No overclaim.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-2 border-t border-white/[0.06]">
            {INGREDIENTS.map((m, i) => (
              <Reveal key={m.k} delay={i * 90}>
                <div className="group flex flex-col gap-3 py-8 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-500">
                  <div className="flex items-baseline gap-6">
                    <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:translate-x-1 transition-transform duration-500">{m.k}</h3>
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed pl-12">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 06 SOCIAL PROOF ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">06 / In Their Words</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Operators<br /><span className="text-white/55">under pressure.</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.q} delay={i * 120}>
                <div className="bg-black p-12 lg:p-16 h-full flex flex-col gap-8 group">
                  <span className="text-primary text-3xl font-bold leading-none">“</span>
                  <p className="text-2xl md:text-3xl font-light leading-tight tracking-tight text-white/85 group-hover:text-white transition-colors">
                    {t.q}
                  </p>
                  <div className="mt-auto flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/45 font-bold">
                    <div className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                    {t.who}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 07 MEMBERSHIP ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(180,20,30,0.16)_0%,transparent_60%)] breathe" />
        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">07 / Membership</span>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.02] mb-6 text-center">
              Consistency <span className="text-glow-primary">compounds.</span>
            </h2>
            <p className="text-lg text-white/65 font-light max-w-2xl mx-auto text-center mb-20">
              Membership is the system that holds the system — delivery, OS
              telemetry, accountability, and ecosystem access.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <SubscriptionToggle />
          </Reveal>
        </div>
      </section>

      {/* ─── 08 COMMUNITY + EVENTS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">08 / Community + Events</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              The ecosystem<br /><span className="text-white/55">in person.</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.05] border border-white/[0.05]">
            {EVENTS.map((e, i) => (
              <Reveal key={e.k} delay={i * 100}>
                <div className="relative bg-black p-10 group overflow-hidden h-full">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(180,20,30,0.14)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative flex flex-col gap-4">
                    <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">E/{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:text-primary transition-colors duration-500">{e.k}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{e.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL ─── */}
      <section className="relative w-full py-64 lg:py-80 px-6 lg:px-24 border-t border-white/[0.04] flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.18)_0%,rgba(0,0,0,1)_75%)] breathe" />
        <div className="relative max-w-5xl mx-auto flex flex-col items-center gap-24">
          <Reveal>
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-[8rem] font-bold tracking-[-0.02em] leading-[0.95]">
              The loop is<br /><span className="text-glow-primary">the moat.</span>
            </h2>
          </Reveal>
          <Reveal delay={600}>
            <div className="flex flex-col items-center gap-8">
              <div className="w-px h-24 bg-gradient-to-b from-transparent via-primary/40 to-primary/80" />
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary pulse-dot" />
                <span className="text-2xl md:text-3xl font-bold tracking-[0.4em] uppercase">AForce</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={1200}>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="#shop" className="group inline-flex items-center gap-4 px-8 py-4 bg-white text-black hover:bg-primary hover:text-white rounded-full transition-all duration-500">
                <span className="text-xs uppercase tracking-[0.4em] font-bold">Start the Ritual</span>
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
              </a>
              <a href={AFORCE_OS_URL} className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
                <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">Enter the Loop</span>
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
