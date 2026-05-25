import { useEffect, useRef } from 'react';
import { EarlyAccessCapture } from '@/components/EarlyAccessCapture';
import { WaveformBackground } from '@/components/WaveformBackground';
import { AmbientAudio } from '@/components/AmbientAudio';

// Product imagery — sticks and drinks are the star of this page.
import stickWatermelon from '@/assets/products/stick-watermelon.png';
import stickBerry from '@/assets/products/stick-berry.png';
import stickSoursop from '@/assets/products/stick-soursop.png';
import canWatermelon from '@/assets/products/can-watermelon.png';
import canBerry from '@/assets/products/can-berry.png';
import canSoursop from '@/assets/products/can-soursop.png';

const stickHero = stickWatermelon;
const drinkCanHero = canWatermelon;
const stickPour = stickBerry;

const STICKS = [
  { src: stickWatermelon, name: 'Watermelon Surge', sub: '+ Chlorella' },
  { src: stickBerry, name: 'Berry Blast', sub: '+ Dulse' },
  { src: stickSoursop, name: 'Soursop Edge', sub: '+ Seamoss' },
];

const CANS = [
  { src: canWatermelon, name: 'Watermelon Surge', sub: '+ Chlorella' },
  { src: canBerry, name: 'Berry Blast', sub: '+ Dulse' },
  { src: canSoursop, name: 'Soursop Edge', sub: '+ Seamoss' },
];

// Editorial / context imagery (supporting, not the star).
import osRecoveryGreen from '@/assets/images/os-recovery-green.png';
import osRecoveryRed from '@/assets/images/os-recovery-red.png';
import osTimeline from '@/assets/images/os-timeline.png';
import scene1 from '@/assets/images/scene-1.png';
import scene2 from '@/assets/images/scene-2.png';
import scene3 from '@/assets/images/scene-3.png';

// Cross-artifact link target for the AForce OS mobile app, wired by
// vite.config.ts from REPLIT_EXPO_DEV_DOMAIN in development.
const AFORCE_OS_URL =
  (import.meta.env.VITE_AFORCE_OS_URL as string | undefined) ?? '/';

export default function Home() {
  const parallaxRefs = useRef<(HTMLImageElement | HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql.matches) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      parallaxRefs.current.forEach((el) => {
        if (!el) return;
        const speed = el.getAttribute('data-speed') || '0.1';
        const yPos = -(scrollY * parseFloat(speed));
        el.style.transform = `translateY(${yPos}px)`;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const addToParallax = (el: HTMLImageElement | HTMLDivElement | null) => {
    if (el && !parallaxRefs.current.includes(el)) {
      parallaxRefs.current.push(el);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white overflow-hidden relative font-sans">
      <WaveformBackground />
      <AmbientAudio />

      {/* ─── Fixed Top Nav ───────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
            <span className="text-sm font-bold tracking-[0.3em] uppercase">AForce</span>
          </a>
          <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.25em] text-white/55">
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#loop" className="hover:text-white transition-colors">The Loop</a>
            <a href="#os" className="hover:text-white transition-colors">OS</a>
            <a href="#ecosystem" className="hover:text-white transition-colors">Ecosystem</a>
          </div>
          <a
            href={AFORCE_OS_URL}
            className="text-[11px] uppercase tracking-[0.25em] text-white/80 hover:text-white transition-colors border border-white/15 hover:border-primary/60 px-4 py-2 rounded-full"
          >
            Early Access
          </a>
        </div>
      </nav>

      {/* ─── Hero — Product Forward ───────────────────────────────── */}
      <section className="relative w-full min-h-[100dvh] flex items-center pt-32 pb-24 px-6 sm:px-12 lg:px-24 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(180,20,30,0.22)_0%,transparent_60%)] breathe" />

        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-12 gap-12 items-center">
          {/* Copy column */}
          <div className="lg:col-span-6 flex flex-col gap-8 order-2 lg:order-1">
            <div className="fade-up" style={{ animationDelay: '0.05s' }}>
              <span className="text-white/50 uppercase tracking-[0.25em] text-xs font-bold block mb-6">
                AForce — Hydration Sticks &amp; Performance Drinks
              </span>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.02]">
                The hydration<br />
                <span className="text-glow-primary">built for the relentless.</span>
              </h1>
            </div>

            <p
              className="text-lg sm:text-xl text-white/65 max-w-xl font-light fade-up"
              style={{ animationDelay: '0.2s' }}
            >
              Precision-dosed electrolyte sticks and performance drinks engineered
              for people who do not get to be off. The product is the ritual.
              The OS is the proof.
            </p>

            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 mt-2 fade-up w-full max-w-lg"
              style={{ animationDelay: '0.35s' }}
            >
              <EarlyAccessCapture source="hero_cta" className="flex-1" />
              <a
                href={AFORCE_OS_URL}
                className="text-white/65 hover:text-white transition-colors text-sm uppercase tracking-wider font-semibold whitespace-nowrap text-center sm:text-left"
              >
                Explore AForce OS →
              </a>
            </div>
          </div>

          {/* Product hero column — STICK + CAN, the star */}
          <div className="lg:col-span-6 order-1 lg:order-2 relative h-[60vh] lg:h-[80vh] w-full">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_55%,rgba(180,20,30,0.32)_0%,transparent_55%)] blur-2xl" />
            <img
              ref={addToParallax}
              data-speed="0.03"
              src={stickHero}
              alt="AForce hydration stick — Watermelon Surge"
              className="absolute left-1/2 top-1/2 -translate-x-[120%] -translate-y-[48%] w-[40%] max-w-[220px] h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] z-10 opacity-60 saturate-50 blur-[0.5px]"
              style={{ imageRendering: 'auto' }}
            />
            <img
              ref={addToParallax}
              data-speed="-0.05"
              src={drinkCanHero}
              alt="AForce performance drink can — Watermelon Surge"
              className="absolute left-1/2 top-1/2 -translate-x-[40%] -translate-y-1/2 w-[95%] max-w-[560px] h-auto z-20"
              style={{
                imageRendering: 'auto',
                filter:
                  'drop-shadow(0 30px 60px rgba(180,20,30,0.35)) drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── Product Showcase — Sticks & Drinks ──────────────────── */}
      <section id="product" className="relative w-full py-40 px-6 lg:px-24 z-10 border-t border-white/5 bg-[#020202] grain">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                01 / The Product
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Two formats.<br />
              <span className="text-white/55">One performance system.</span>
            </h2>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden border border-primary/15 mb-8 bg-gradient-to-b from-black to-[#0a0303] p-10 lg:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,rgba(180,20,30,0.32)_0%,transparent_65%)]" />
            <div className="relative grid grid-cols-3 gap-8 lg:gap-16 items-end">
              {CANS.map((c) => (
                <div key={c.name} className="flex flex-col items-center text-center">
                  <img
                    src={c.src}
                    alt={`AForce ${c.name} performance drink can`}
                    className="w-full max-w-[320px] h-auto drop-shadow-[0_40px_90px_rgba(180,20,30,0.4)]"
                    loading="lazy"
                  />
                  <div className="mt-8 text-base font-bold tracking-wide">{c.name}</div>
                  <div className="text-xs text-white/55 mt-1">{c.sub}</div>
                </div>
              ))}
            </div>
            <div className="absolute top-6 left-6 text-primary font-mono text-[10px] tracking-[0.3em] uppercase">
              The Drink
            </div>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden border border-white/5 mb-12 bg-[#020202] p-10 lg:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(180,20,30,0.12)_0%,transparent_60%)]" />
            <div className="relative grid grid-cols-3 gap-6 lg:gap-14 items-end">
              {STICKS.map((s) => (
                <div key={s.name} className="flex flex-col items-center text-center">
                  <img
                    src={s.src}
                    alt={`AForce ${s.name} hydration stick`}
                    className="w-full max-w-[280px] h-auto drop-shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
                    loading="lazy"
                  />
                  <div className="mt-8 text-base font-bold tracking-wide">{s.name}</div>
                  <div className="text-xs text-white/55 mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="absolute top-6 left-6 text-white/40 font-mono text-[10px] tracking-[0.3em] uppercase">
              The Stick
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-black hover:border-primary/30 transition-colors duration-500">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img
                  src={stickPour}
                  alt="AForce stick mid-pour into water"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              </div>
              <div className="p-8 lg:p-10">
                <div className="text-primary font-mono text-xs mb-3 tracking-widest">
                  AFORCE STICKS
                </div>
                <h3 className="text-2xl font-bold mb-3">Hydration, single-serve.</h3>
                <p className="text-white/55 text-sm leading-relaxed">
                  Precision-dosed electrolyte sticks. Tear, pour, hydrate. Built
                  to be carried, ritualized, and replenished — the smallest unit
                  of the system.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-black hover:border-primary/30 transition-colors duration-500">
              <div className="aspect-[4/3] relative overflow-hidden bg-black">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(180,20,30,0.25)_0%,transparent_60%)]" />
                <img
                  src={drinkCanHero}
                  alt="AForce performance drink can"
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[95%] object-contain transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-8 lg:p-10">
                <div className="text-primary font-mono text-xs mb-3 tracking-widest">
                  AFORCE DRINK
                </div>
                <h3 className="text-2xl font-bold mb-3">The performance can.</h3>
                <p className="text-white/55 text-sm leading-relaxed">
                  Ready-to-drink. Matte aluminum. Engineered for the moment
                  before — the meeting, the surgery, the start line. No sugar
                  theatre. No wellness mood lighting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Loop ────────────────────────────────────────────── */}
      <section id="loop" className="relative w-full py-40 px-6 lg:px-24 z-10 border-t border-white/5 bg-black overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
        <div className="relative max-w-6xl mx-auto">
          <div className="mb-24 max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                02 / The Loop
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Systems<br />
              <span className="text-white/55">that compound.</span>
            </h2>
          </div>

          <div className="border-t border-white/[0.06]">
            {[
              { title: 'Product', desc: 'Precision sticks and drinks — the ritual unit.' },
              { title: 'Ritual', desc: 'Daily routines cemented through friction-free action.' },
              { title: 'Reinforcement', desc: 'Telemetry-driven behavioral feedback.' },
              { title: 'Accountability', desc: 'High-stakes peer alignment.' },
              { title: 'Subscription', desc: 'Seamless replenishment.' },
              { title: 'Retention', desc: 'Irreplaceable personal data.' },
              { title: 'Community', desc: 'The highest density of performers.' },
            ].map((stage, i) => (
              <div
                key={stage.title}
                className="group grid grid-cols-12 items-baseline gap-6 py-8 lg:py-10 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-500"
              >
                <div className="col-span-2 lg:col-span-1 text-primary/70 group-hover:text-primary font-mono text-xs tracking-[0.3em] transition-colors duration-500">
                  0{i + 1}
                </div>
                <h3 className="col-span-10 lg:col-span-4 text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight group-hover:translate-x-2 transition-transform duration-500">
                  {stage.title}
                </h3>
                <p className="col-start-3 lg:col-start-6 col-span-10 lg:col-span-7 text-white/50 group-hover:text-white/75 text-base lg:text-lg leading-relaxed transition-colors duration-500">
                  {stage.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AForce OS — supporting, the proof layer ─────────────── */}
      <section id="os" className="relative w-full py-40 px-6 lg:px-24 z-10 overflow-hidden bg-[#020202] border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(180,20,30,0.12)_0%,transparent_60%)] breathe" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative h-[640px] w-full">
            <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full breathe" />
            <img
              ref={addToParallax}
              data-speed="0.04"
              src={osRecoveryRed}
              alt="AForce OS — Recovery Load Critical protocol screen"
              className="absolute left-0 top-10 w-[60%] max-w-[280px] z-10 -rotate-[6deg] drop-shadow-[0_30px_60px_rgba(180,20,30,0.35)] opacity-90"
              loading="lazy"
            />
            <img
              ref={addToParallax}
              data-speed="-0.06"
              src={osRecoveryGreen}
              alt="AForce OS — Performance Sync Active protocol screen"
              className="absolute left-1/2 -translate-x-1/2 top-0 w-[65%] max-w-[320px] z-30 drop-shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
              loading="lazy"
            />
            <img
              ref={addToParallax}
              data-speed="0.05"
              src={osTimeline}
              alt="AForce OS — Performance Timeline dashboard"
              className="absolute right-0 top-16 w-[60%] max-w-[280px] z-20 rotate-[6deg] drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)] opacity-95"
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2 flex flex-col gap-10">
            <div className="flex items-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                03 / AForce OS
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              The proof layer<br />
              <span className="text-white/55">for the product.</span>
            </h2>
            <p className="text-white/65 text-lg lg:text-xl leading-relaxed font-light max-w-lg">
              Every stick poured, every can opened, every ritual closed — fed back
              into a behavioral telemetry stream you actually use. The OS exists
              so the product compounds.
            </p>
            <ul className="space-y-5 mt-2">
              {[
                'Real-time hydration telemetry',
                'Actionable behavioral triggers',
                'Compound visual streaks',
                'Frictionless ritual tracking',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 text-white/80 text-sm uppercase tracking-[0.15em]"
                >
                  <div className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={AFORCE_OS_URL}
              className="inline-flex items-center gap-3 mt-4 text-xs uppercase tracking-[0.3em] font-bold text-white hover:text-primary transition-colors group"
            >
              <span>Open AForce OS</span>
              <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Who It's For ────────────────────────────────────────── */}
      <section className="relative w-full py-40 px-6 lg:px-24 z-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                04 / Identity
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif italic text-white/85 leading-[1.15] tracking-tight">
              "There is a certain kind of person<br />
              who does not get to be off."
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { src: scene1, label: 'Non-Negotiable', sub: 'Performance is the standard.' },
              { src: scene2, label: 'The Floor', sub: 'Where preparation lives.' },
              { src: scene3, label: 'The Room', sub: 'Members who do not slip.' },
            ].map((p, i) => (
              <div
                key={p.label}
                className={`group relative aspect-[3/4] overflow-hidden rounded-lg ${
                  i === 1 ? 'mt-0 md:mt-12' : ''
                }`}
              >
                <img
                  src={p.src}
                  alt={p.label}
                  className="w-full h-full object-cover filter grayscale contrast-110 transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <p className="uppercase tracking-[0.25em] text-xs font-bold text-primary mb-1">
                    {p.label}
                  </p>
                  <p className="text-white/70 text-sm">{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Performance Economy ─────────────────────────────────── */}
      <section className="relative w-full py-40 px-6 lg:px-24 z-10 border-t border-white/5 bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.10)_0%,transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                05 / The Economy
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Every behavior is a node.<br />
              <span className="text-white/55">Every node compounds.</span>
            </h2>
          </div>

          <div className="relative mx-auto max-w-5xl aspect-[16/9]">
            {/* Telemetry waveform / grid backdrop */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 800 450"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="econGrid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(180,20,30,0.15)" />
                  <stop offset="100%" stopColor="rgba(180,20,30,0)" />
                </linearGradient>
                <radialGradient id="econNode">
                  <stop offset="0%" stopColor="rgba(220,40,60,0.9)" />
                  <stop offset="100%" stopColor="rgba(180,20,30,0)" />
                </radialGradient>
              </defs>

              {/* horizontal grid lines */}
              {[0.2, 0.4, 0.6, 0.8].map((p) => (
                <line
                  key={p}
                  x1="0"
                  y1={450 * p}
                  x2="800"
                  y2={450 * p}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
              ))}

              {/* low-frequency waveform */}
              <path
                d="M 0 270 C 100 220, 200 320, 300 250 S 500 200, 600 260 S 750 230, 800 250"
                stroke="url(#econGrid)"
                strokeWidth="2"
                fill="none"
                opacity="0.7"
              />

              {/* connecting lines between nodes */}
              <path
                d="M 80 320 L 240 180 L 400 280 L 560 160 L 720 300"
                stroke="rgba(180,20,30,0.35)"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 6"
              />
            </svg>

            {/* Five labeled nodes */}
            {[
              { x: 8, y: 70, label: 'Ritual', sub: 'Daily action' },
              { x: 28, y: 35, label: 'Retention', sub: 'Data depth' },
              { x: 50, y: 60, label: 'Compounding', sub: 'Behavior layer' },
              { x: 70, y: 33, label: 'Ecosystem', sub: 'Network density' },
              { x: 88, y: 66, label: 'Accountability', sub: 'Peer alignment' },
            ].map((n) => (
              <div
                key={n.label}
                className="absolute flex flex-col items-center text-center"
                style={{
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="relative w-3 h-3 rounded-full bg-primary shadow-[0_0_20px_rgba(220,40,60,0.8)]">
                  <div className="absolute inset-[-8px] rounded-full border border-primary/30" />
                </div>
                <div className="mt-4 text-xs font-bold uppercase tracking-widest text-white/85">
                  {n.label}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
                  {n.sub}
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/50 text-center max-w-2xl mx-auto mt-20 leading-relaxed">
            Ritual feeds retention. Retention feeds the ecosystem. The ecosystem
            holds people accountable. AForce is the substrate underneath all of it.
          </p>
        </div>
      </section>

      {/* ─── Community / Events ──────────────────────────────────── */}
      <section id="ecosystem" className="relative w-full py-48 px-6 lg:px-24 z-10 bg-black border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-8 h-px bg-primary" />
            <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
              06 / The Ecosystem
            </span>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-10">
            Physical spaces that mirror<br />
            <span className="text-white/55">the digital rigor.</span>
          </h2>
          <p className="text-white/55 max-w-2xl mx-auto text-lg lg:text-xl font-light leading-relaxed">
            Soho House meets a performance lab. Members-only rooms built around
            recovery, hydration, and the people who refuse to slip.
          </p>
        </div>
      </section>

      {/* ─── Future ──────────────────────────────────────────────── */}
      <section className="relative w-full py-72 px-6 lg:px-24 z-10 flex flex-col items-center justify-center text-center overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.22)_0%,rgba(0,0,0,1)_70%)] breathe" />

        <div className="relative z-10 flex flex-col items-center gap-12">
          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-primary" />
            <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
              07 / The Future
            </span>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] text-white/95 max-w-5xl">
            Once proof is established<br />
            <span className="text-glow-primary">— scale.</span>
          </h2>
          <div className="w-px h-16 bg-gradient-to-b from-primary/60 to-transparent mt-4" />
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="relative w-full pt-24 pb-12 px-6 lg:px-24 z-10 border-t border-white/[0.06] bg-black">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start gap-16 mb-20">
          <div className="max-w-sm flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
              <h3 className="text-sm font-bold tracking-[0.3em] uppercase">AForce</h3>
            </div>
            <p className="text-white/45 text-sm leading-relaxed">
              Hydration sticks, performance drinks, and the behavioral OS that
              makes them compound.
            </p>
            <EarlyAccessCapture source="footer_cta" buttonText="Join" />
          </div>

          <div className="grid grid-cols-2 gap-x-20 gap-y-6 text-[11px] uppercase tracking-[0.25em]">
            <a href="#" className="text-white/55 hover:text-white transition-colors">Manifesto</a>
            <a href={AFORCE_OS_URL} className="text-white/55 hover:text-white transition-colors">AForce OS</a>
            <a href="#" className="text-white/55 hover:text-white transition-colors">Science</a>
            <a href="#" className="text-white/55 hover:text-white transition-colors">Investors</a>
            <a href="#" className="text-white/55 hover:text-white transition-colors">Team</a>
            <a href="#" className="text-white/55 hover:text-white transition-colors">Contact</a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[10px] uppercase tracking-[0.3em] text-white/30">
          <span>© AForce — Performance is non-negotiable.</span>
          <span>Built for the relentless.</span>
        </div>
      </footer>
    </div>
  );
}
