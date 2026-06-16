import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eyebrow, FadeIn, EASE, CtaLink } from './primitives';

import canBerry from '@/assets/products/real-can-berry.png';
import canWatermelon from '@/assets/products/real-can-watermelon.png';
import canSoursop from '@/assets/products/real-can-soursop.png';

const PRODUCTS = [
  {
    code: 'AF.001',
    name: 'Berry Blast',
    fn: '+ Dulse',
    src: canBerry,
    note: 'Iron-rich sea vegetable. Deep, dark, composed.',
  },
  {
    code: 'AF.002',
    name: 'Watermelon Surge',
    fn: '+ Chlorella',
    src: canWatermelon,
    note: 'Cellular detox algae. Clean, bright, exact.',
  },
  {
    code: 'AF.003',
    name: 'Soursop Edge',
    fn: '+ Sea Moss',
    src: canSoursop,
    note: 'Ninety-two minerals. Quiet, total, ready.',
  },
];

const SPECS = [
  ['Volume', '355 ml'],
  ['Alkalinity', 'pH 8.8'],
  ['Vessel', 'Aluminum'],
  ['Sugar', 'Zero'],
  ['System', 'Sea-mineral electrolytes'],
];

export function ProductSection() {
  const [active, setActive] = useState(0);
  const product = PRODUCTS[active];

  return (
    <section
      id="product"
      className="relative w-full overflow-hidden bg-ink text-white px-6 sm:px-10 lg:px-20 py-28 lg:py-40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(228,30,43,0.10)_0%,transparent_60%)]" />
      <div className="relative max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div>
            <FadeIn>
              <Eyebrow index="04" tone="dark">
                The Product
              </Eyebrow>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h2 className="mt-10 font-display font-extrabold leading-[0.95] tracking-[-0.02em] text-[clamp(2.2rem,7vw,6rem)]">
                Discipline,<br />
                <span className="text-white/40">bottled.</span>
              </h2>
            </FadeIn>
          </div>
          <FadeIn delay={0.2} className="max-w-sm">
            <p className="text-white/55 leading-relaxed">
              Three formulations. One philosophy. Composition engineered for the
              minute before — built into matte aluminum, not candy chemistry.
            </p>
          </FadeIn>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Stage */}
          <div className="lg:col-span-6 relative h-[380px] sm:h-[520px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(47,91,255,0.14)_0%,transparent_60%)] blur-2xl" />
            <AnimatePresence mode="wait">
              <motion.img
                key={product.code}
                src={product.src}
                alt={`AForce ${product.name} — performance drink`}
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.8, ease: EASE }}
                className="relative z-10 h-full w-auto object-contain slow-float drop-shadow-[0_50px_90px_rgba(0,0,0,0.7)]"
              />
            </AnimatePresence>
            <span className="absolute top-2 left-0 font-label text-[10px] tracking-[0.4em] text-white/40">
              {product.code}
            </span>
          </div>

          {/* Detail */}
          <div className="lg:col-span-6">
            <FadeIn>
              <div className="font-label text-[11px] uppercase tracking-[0.35em] text-signal mb-4">
                {product.code} — {product.fn}
              </div>
              <h3 className="font-display text-4xl lg:text-6xl font-extrabold tracking-tight mb-4">
                {product.name}
              </h3>
              <p className="text-white/55 text-lg leading-relaxed max-w-md mb-10">
                {product.note}
              </p>
            </FadeIn>

            <div className="border-t border-white/10">
              {SPECS.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between py-3.5 border-b border-white/10"
                >
                  <span className="font-label text-[10px] uppercase tracking-[0.3em] text-white/40">
                    {k}
                  </span>
                  <span className="text-sm text-white/85 tnum">{v}</span>
                </div>
              ))}
            </div>

            {/* Selector */}
            <div className="mt-10 flex flex-wrap gap-3">
              {PRODUCTS.map((p, i) => (
                <button
                  key={p.code}
                  type="button"
                  aria-pressed={active === i}
                  aria-label={`Show ${p.name}`}
                  onClick={() => setActive(i)}
                  className={`px-4 py-2.5 rounded-full font-label text-[10px] uppercase tracking-[0.25em] transition-all duration-500 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
                    active === i
                      ? 'border-signal text-white bg-signal/10'
                      : 'border-white/15 text-white/50 hover:border-white/40 hover:text-white/80'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="mt-10">
              <CtaLink to="#commerce" variant="solid" tone="dark">
                Acquire AForce
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
