import { useState, type FormEvent } from 'react';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';
import osRecoveryGreen from '@/assets/images/os-recovery-green.png';
import osTimeline from '@/assets/images/os-timeline.png';

const LOOP = [
  { n: '01', k: 'Product' },
  { n: '02', k: 'Ritual' },
  { n: '03', k: 'Reinforcement' },
  { n: '04', k: 'Accountability' },
  { n: '05', k: 'Subscription' },
  { n: '06', k: 'Retention' },
  { n: '07', k: 'Community' },
];

const MARKET = [
  'Hydration',
  'Behavioral coaching',
  'Performance optimization',
  'Accountability systems',
  'Wearable integrations',
  'Subscription ecosystems',
];

const METRICS = [
  { k: 'Repeat purchase', d: 'Ritual as the demand engine.' },
  { k: 'Retention', d: 'Compounding with each loop cycle.' },
  { k: 'Subscription conversion', d: 'Identity over inventory.' },
  { k: 'Recurring revenue potential', d: 'Behavior priced monthly.' },
  { k: 'Ecosystem engagement', d: 'Many touchpoints, one identity.' },
  { k: 'Premium margin structure', d: 'Built into the positioning.' },
];

const RAISE_MILESTONES = [
  { k: 'Repeat purchase validation', d: 'Prove ritual economics at cohort scale.' },
  { k: 'Onboarding scalability', d: 'Time-to-first-ritual under target.' },
  { k: 'Retention curves', d: 'Demonstrate compounding loop adherence.' },
  { k: 'CAC efficiency', d: 'Identity-driven acquisition vs. paid spend.' },
  { k: 'Subscription behavior', d: 'Conversion + LTV proof points.' },
  { k: 'Ecosystem engagement', d: 'Cross-loop participation, measured.' },
];

const FUTURE = [
  'Ecosystem expansion',
  'Wearable integrations',
  'Community systems',
  'Retail growth',
  'Enterprise programs',
  'Behavioral intelligence',
];

function PrivateAccess() {
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim().toLowerCase() === 'aforce') {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (unlocked) {
    return (
      <div className="grid md:grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
        {[
          { k: 'Investor deck', d: 'Latest narrative + positioning.', href: '/aforce-pitch/', cta: 'Open →' },
          { k: 'Financial projections', d: 'Operating model + assumptions.', href: '/contact', cta: 'Request →' },
          { k: 'Roadmap', d: 'Quarterly milestones + dependencies.', href: '/contact', cta: 'Request →' },
          { k: 'Founder updates', d: 'Monthly investor letter archive.', href: '/contact', cta: 'Request →' },
          { k: 'Media assets', d: 'Brand kit + editorial library.', href: '/contact', cta: 'Request →' },
          { k: 'Diligence room', d: 'Cap table, contracts, references.', href: '/contact', cta: 'Request →' },
        ].map((doc) => (
          <div key={doc.k} className="bg-black p-8 group flex flex-col gap-3 hover:bg-[#050505] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-primary pulse-dot" />
              <h3 className="text-base font-bold tracking-tight">{doc.k}</h3>
            </div>
            <p className="text-sm text-white/55 leading-relaxed">{doc.d}</p>
            <a href={doc.href} className="mt-auto text-[10px] uppercase tracking-[0.3em] text-primary/80 group-hover:text-primary transition-colors">{doc.cta}</a>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto flex flex-col items-stretch gap-6">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-2">Private materials</div>
        <div className="text-sm text-white/55">Investor access code required.</div>
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        placeholder="Access code"
        className="bg-transparent border-b border-white/15 focus:border-primary outline-none py-4 px-2 text-center text-sm tracking-[0.3em] uppercase placeholder:text-white/25 transition-colors"
      />
      {error && <div className="text-[10px] uppercase tracking-[0.3em] text-primary text-center">Access denied. Request a code below.</div>}
      <button type="submit" className="group inline-flex items-center justify-center gap-4 px-6 py-3.5 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
        <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">Unlock</span>
      </button>
      <a href="/contact" className="text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-white text-center transition-colors">Request access →</a>
    </form>
  );
}

export default function Investors() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <SiteNav current="/investors" />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />
        <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-40 opacity-20" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d="M0,50 Q300,20 600,50 T1200,50" fill="none" stroke="#ff3548" strokeWidth="0.6" />
        </svg>

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">Investor Relations</span>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] font-bold tracking-[-0.02em] leading-[0.95] mb-12 max-w-5xl">
              The loop is<br /><span className="text-glow-primary">the moat.</span>
            </h1>
          </Reveal>
          <Reveal delay={600}>
            <p className="text-lg md:text-2xl text-white/65 font-light max-w-3xl leading-relaxed mb-12">
              AForce combines hydration, ritual, behavioral reinforcement,
              accountability, subscription systems, and community into a
              compounding performance ecosystem.
            </p>
          </Reveal>
          <Reveal delay={900}>
            <div className="flex flex-wrap gap-4">
              <a href="#private" className="group inline-flex items-center gap-4 px-6 py-3.5 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all duration-500">
                <span className="text-[11px] uppercase tracking-[0.35em] font-bold">Request Investor Access</span>
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
              </a>
              <a href="#private" className="group inline-flex items-center gap-4 px-6 py-3.5 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
                <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">View Investor Materials</span>
              </a>
              <a href="/aforce-os/" className="group inline-flex items-center gap-4 px-6 py-3.5 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
                <span className="text-[11px] uppercase tracking-[0.35em] font-bold text-white group-hover:text-primary transition-colors">Enter the Ecosystem</span>
              </a>
            </div>
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
              Modern performance<br /><span className="text-white/55">is fragmented.</span>
            </h2>
          </Reveal>
          <Reveal delay={250} className="lg:col-span-7 lg:pt-16 space-y-6 text-lg text-white/65 font-light leading-relaxed">
            <p>People under pressure lack consistency, accountability, ritual reinforcement, behavioral systems, and performance structure.</p>
            <p>Existing categories solve fragments — wearables, supplements, coaching, apps. None deliver the integrated behavioral substrate.</p>
            <p>AForce positions as the operating system for sustained performance — the connective layer the market has not yet seen.</p>
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
              Seven layers.<br /><span className="text-white/55">One compounding system.</span>
            </h2>
          </Reveal>

          <Reveal delay={300}>
            <div className="relative mx-auto aspect-square max-w-2xl">
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-10 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-20 rounded-full border border-primary/15 breathe" />
              <div className="absolute inset-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary pulse-dot" />
              {LOOP.map((s, i) => {
                const angle = (i / LOOP.length) * Math.PI * 2 - Math.PI / 2;
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

      {/* ─── 03 OS PREVIEW ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(180,20,30,0.12)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">03 / AForce OS</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-10">
                The instrument layer.
              </h2>
              <p className="text-lg text-white/65 font-light leading-relaxed mb-10">
                The OS is the daily surface where the loop closes — readiness,
                streaks, reinforcement, accountability, AI coaching, and
                retention systems converge in one operator-grade tool.
              </p>
              <a href="/os" className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] font-bold text-primary">
                Tour the OS
                <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
              </a>
            </Reveal>
          </div>
          <div className="lg:col-span-7 relative h-[560px]">
            <Reveal delay={200} className="absolute left-0 top-0 w-[55%]">
              <img src={osRecoveryGreen} alt="OS readiness" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" />
            </Reveal>
            <Reveal delay={400} className="absolute right-0 bottom-0 w-[55%]">
              <img src={osTimeline} alt="OS timeline" className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)]" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 04 MARKET ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">04 / The Market</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-16 max-w-3xl">
              The performance economy<br /><span className="text-white/55">is converging.</span>
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <p className="text-lg text-white/65 font-light max-w-3xl mb-16 leading-relaxed">
              Six adjacent categories — historically siloed — are collapsing
              into a single operator surface. AForce sits at the center of
              that convergence.
            </p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/[0.05] border border-white/[0.05]">
            {MARKET.map((m, i) => (
              <Reveal key={m} delay={i * 80}>
                <div className="bg-black p-8 flex items-center gap-4">
                  <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">M/{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm md:text-base font-bold tracking-tight">{m}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 05 UNIT ECONOMICS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">05 / Unit Economics</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-8 max-w-3xl">
              Operating assumptions.<br /><span className="text-white/55">Proof milestones.</span>
            </h2>
            <p className="text-sm text-white/40 uppercase tracking-[0.3em] mb-20">Targets, not claims.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-2 border-t border-white/[0.06]">
            {METRICS.map((m, i) => (
              <Reveal key={m.k} delay={i * 90}>
                <div className="group flex items-baseline justify-between gap-8 py-8 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-500">
                  <div className="flex items-baseline gap-6">
                    <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight group-hover:translate-x-1 transition-transform duration-500">{m.k}</h3>
                  </div>
                  <p className="text-sm text-white/50 text-right max-w-xs">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 06 THE RAISE ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">06 / The Raise</span>
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-8">
              Proof <span className="text-white/55">before</span> <span className="text-glow-primary">scale.</span>
            </h2>
            <p className="text-lg text-white/65 font-light max-w-3xl mb-20 leading-relaxed">
              This round is structured to validate the loop economics. Six
              proof milestones, sequenced and capital-disciplined.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
            {RAISE_MILESTONES.map((m, i) => (
              <Reveal key={m.k} delay={i * 100}>
                <div className="bg-black p-10">
                  <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em] block mb-6">M/{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-3">{m.k}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{m.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 07 FOUNDERS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <Reveal className="lg:col-span-5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">07 / Founders</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-10">
              Brandon + Julius<br /><span className="text-white/55">Burrell.</span>
            </h2>
            <p className="text-lg text-white/65 font-light leading-relaxed mb-10">
              Disciplined operators. Ecosystem thinkers. A finance-and-hospitality
              executive paired with an execution-led builder. Two brothers, one
              standard — credibility earned, not claimed.
            </p>
            <a href="/founders" className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] font-bold text-primary">
              Read the founder story
              <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
          <Reveal delay={300} className="lg:col-span-7">
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-sm border border-white/[0.06] bg-gradient-to-br from-[#0a0a0a] via-black to-[#0a0303]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,20,30,0.22)_0%,transparent_60%)] breathe" />
              <div className="absolute inset-0 grain" />
              <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-primary/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                <span className="text-white/30 text-[9px] uppercase tracking-[0.4em] font-bold">Founders — Brandon + Julius Burrell</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 08 THE FUTURE ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(180,20,30,0.22)_0%,transparent_70%)] breathe" />
        <div className="absolute inset-x-0 bottom-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">08 / The Future</span>
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-20">
              Once proof is established —<br /><span className="text-glow-primary">scale.</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 border-t border-white/[0.06] pt-10">
            {FUTURE.map((f, i) => (
              <Reveal key={f} delay={i * 100}>
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-white/75 font-bold py-2">
                  <div className="w-1 h-1 rounded-full bg-primary" />{f}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRIVATE ACCESS ─── */}
      <section id="private" className="relative w-full py-48 lg:py-64 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.12)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">Private Materials</span>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 text-center">
              The diligence room.
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <PrivateAccess />
          </Reveal>
        </div>
      </section>

      {/* ─── Closing ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 border-t border-white/[0.04] flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
        <div className="relative max-w-4xl mx-auto flex flex-col items-center gap-12">
          <Reveal>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02]">
              Early access.<br /><span className="text-glow-primary">Inevitable scale.</span>
            </h2>
          </Reveal>
          <Reveal delay={400}>
            <a href="/contact" className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
              <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">Enter the Ecosystem</span>
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
