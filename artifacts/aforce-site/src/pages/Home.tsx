import { useEffect, useRef } from 'react';
import { EarlyAccessCapture } from '@/components/EarlyAccessCapture';
import { WaveformBackground } from '@/components/WaveformBackground';

// Product imagery — sticks and drinks are the star of this page.
import stickHero from '@/assets/products/stick-hero.png';
import drinkCanHero from '@/assets/products/drink-can-hero.png';
import sticksRow from '@/assets/products/sticks-row.png';
import stickPour from '@/assets/products/stick-pour.png';

// Editorial / context imagery (supporting, not the star).
import appMockup1 from '@/assets/images/app-mockup-1.png';
import appMockup2 from '@/assets/images/app-mockup-2.png';
import portraitFounder from '@/assets/images/portrait-founder.png';
import portraitSurgeon from '@/assets/images/portrait-surgeon.png';
import portraitAthlete from '@/assets/images/portrait-athlete.png';
import eventPaddock from '@/assets/images/event-paddock.png';
import eventHydration from '@/assets/images/event-hydration.png';

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
    <div className="bg-black min-h-screen text-white overflow-hidden relative">
      <WaveformBackground />

      {/* ─── Hero — Product Forward ───────────────────────────────── */}
      <section className="relative w-full min-h-[100dvh] flex items-center pt-20 pb-24 px-6 sm:px-12 lg:px-24 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(180,20,30,0.22)_0%,transparent_60%)]" />

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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(180,20,30,0.32)_0%,transparent_55%)] blur-2xl" />
            <img
              ref={addToParallax}
              data-speed="0.05"
              src={stickHero}
              alt="AForce hydration stick — matte black sachet on black"
              className="absolute left-1/2 top-1/2 -translate-x-[70%] -translate-y-1/2 w-[70%] max-w-[420px] drop-shadow-[0_30px_80px_rgba(180,20,30,0.35)] z-20"
            />
            <img
              ref={addToParallax}
              data-speed="-0.04"
              src={drinkCanHero}
              alt="AForce performance drink can — matte black aluminum"
              className="absolute left-1/2 top-1/2 translate-x-[-10%] -translate-y-[45%] w-[55%] max-w-[340px] drop-shadow-[0_30px_80px_rgba(0,0,0,0.9)] z-10 opacity-95"
            />
          </div>
        </div>
      </section>

      {/* ─── Product Showcase — Sticks & Drinks ──────────────────── */}
      <section className="relative w-full py-32 px-6 lg:px-24 z-10 border-t border-white/5 bg-[#020202]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 max-w-3xl">
            <span className="text-primary uppercase tracking-[0.25em] text-xs font-bold block mb-4">
              The Product
            </span>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Two formats.<br />One performance system.
            </h2>
          </div>

          <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-white/5 mb-12">
            <img
              src={sticksRow}
              alt="Three AForce hydration sticks lined up on an obsidian surface with a deep red horizon glow"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
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
      <section className="relative w-full py-32 px-6 lg:px-24 z-10 border-t border-white/5 bg-gradient-to-b from-black to-black/90">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              The Behavioral Loop
            </h2>
            <p className="text-white/50 text-lg">Systems that compound over time.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -translate-y-1/2 z-0" />

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
                className="relative z-10 group bg-black border border-white/5 p-8 rounded-2xl hover:border-primary/40 transition-colors duration-500 hover:bg-primary/5"
              >
                <div className="text-primary font-mono text-sm mb-4">
                  0{i + 1}
                </div>
                <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
                <p className="text-white/50 text-sm">{stage.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AForce OS — supporting, the proof layer ─────────────── */}
      <section className="relative w-full py-40 px-6 lg:px-24 z-10 overflow-hidden bg-[#020202] border-t border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative h-[600px] w-full">
            <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full" />
            <img
              ref={addToParallax}
              data-speed="0.05"
              src={appMockup1}
              alt="AForce OS interface — readiness and streaks"
              className="absolute left-0 w-[80%] max-w-[400px] z-20 shadow-2xl drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              loading="lazy"
            />
            <img
              ref={addToParallax}
              data-speed="-0.05"
              src={appMockup2}
              alt="AForce OS metrics dashboard"
              className="absolute right-0 top-20 w-[70%] max-w-[350px] z-10 opacity-60"
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2 flex flex-col gap-8">
            <span className="text-primary uppercase tracking-[0.25em] text-xs font-bold">
              AForce OS
            </span>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
              The proof layer for the product.
            </h2>
            <p className="text-white/60 text-xl leading-relaxed font-light">
              Every stick poured, every can opened, every ritual closed — fed back
              into a behavioral telemetry stream you actually use. The OS exists
              so the product compounds.
            </p>
            <ul className="space-y-4 mt-2">
              {[
                'Real-time hydration telemetry',
                'Actionable behavioral triggers',
                'Compound visual streaks',
                'Frictionless ritual tracking',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 text-white/80"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={AFORCE_OS_URL}
              className="inline-flex items-center gap-2 mt-4 text-sm uppercase tracking-wider font-semibold text-primary hover:text-white transition-colors"
            >
              Open AForce OS →
            </a>
          </div>
        </div>
      </section>

      {/* ─── Who It's For ────────────────────────────────────────── */}
      <section className="relative w-full py-40 px-6 lg:px-24 z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24 max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-serif italic text-white/80 leading-snug">
              "There is a certain kind of person who does not get to be off."
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { src: portraitFounder, alt: 'Tech founder portrait', label: 'Founders' },
              { src: portraitSurgeon, alt: 'Surgeon portrait', label: 'Surgeons' },
              { src: portraitAthlete, alt: 'Athlete portrait', label: 'Performers' },
            ].map((p, i) => (
              <div
                key={p.label}
                className={`group relative aspect-[3/4] overflow-hidden rounded-lg ${
                  i === 1 ? 'mt-0 md:mt-12' : ''
                }`}
              >
                <img
                  src={p.src}
                  alt={p.alt}
                  className="w-full h-full object-cover filter grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <p className="uppercase tracking-widest text-xs font-bold text-primary">
                    {p.label}
                  </p>
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
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <span className="text-primary uppercase tracking-[0.25em] text-xs font-bold block mb-4">
              The Performance Economy
            </span>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Every behavior is a node.<br />Every node compounds.
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
      <section className="relative w-full py-40 z-10 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-24">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              The Ecosystem
            </h2>
            <p className="text-white/50 max-w-md md:text-right">
              Physical spaces that mirror the digital rigor. Soho House meets a
              performance lab.
            </p>
          </div>
        </div>

        <div className="w-full flex gap-4 overflow-x-auto pb-8 snap-x snap-mandatory hide-scrollbar">
          <div className="min-w-[80vw] md:min-w-[60vw] lg:min-w-[50vw] aspect-video relative snap-center first:ml-6 lg:first:ml-24">
            <img
              src={eventPaddock}
              alt="Premium event space"
              className="w-full h-full object-cover rounded-xl"
              loading="lazy"
            />
            <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none" />
          </div>
          <div className="min-w-[80vw] md:min-w-[60vw] lg:min-w-[50vw] aspect-video relative snap-center pr-6 lg:pr-24">
            <img
              src={eventHydration}
              alt="Hydration station at an AForce event"
              className="w-full h-full object-cover rounded-xl"
              loading="lazy"
            />
            <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none" />
          </div>
        </div>
      </section>

      {/* ─── Future ──────────────────────────────────────────────── */}
      <section className="relative w-full py-60 px-6 lg:px-24 z-10 flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.15)_0%,rgba(0,0,0,1)_70%)]" />

        <div className="relative z-10">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white/90">
            Once proof is established{' '}
            <span className="text-primary">— scale.</span>
          </h2>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="relative w-full py-24 px-6 lg:px-24 z-10 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16">
          <div className="max-w-sm">
            <h3 className="text-2xl font-bold tracking-tight mb-6">AForce</h3>
            <p className="text-white/40 text-sm mb-8">
              Hydration sticks, performance drinks, and the behavioral OS that
              makes them compound.
            </p>
            <EarlyAccessCapture source="footer_cta" buttonText="Join" />
          </div>

          <div className="flex gap-16 text-sm">
            <div className="flex flex-col gap-4">
              <a href="#" className="text-white/50 hover:text-white transition-colors">Manifesto</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors">Science</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors">Team</a>
            </div>
            <div className="flex flex-col gap-4">
              <a href={AFORCE_OS_URL} className="text-white/50 hover:text-white transition-colors">AForce OS</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors">Investors</a>
              <a href="#" className="text-white/50 hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
