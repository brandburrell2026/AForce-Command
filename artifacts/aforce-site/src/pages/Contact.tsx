import { useState, type FormEvent } from 'react';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';
import { SiteNav } from '@/components/SiteNav';

const PATHWAYS = [
  { n: '01', k: 'Investor Relations', email: 'investors@aforce.co', items: ['Institutional investors', 'Strategic capital', 'Private access', 'Partnership inquiries'] },
  { n: '02', k: 'Brand + Media', email: 'press@aforce.co', items: ['Press', 'Editorial', 'Podcast appearances', 'Collaborations', 'Speaking'] },
  { n: '03', k: 'Performance Partnerships', email: 'partnerships@aforce.co', items: ['Athletes', 'Trainers', 'Wellness systems', 'Enterprise programs', 'Integrations'] },
  { n: '04', k: 'Community + Events', email: 'community@aforce.co', items: ['Activations', 'Founder dinners', 'Launch events', 'Ritual experiences', 'Private gatherings'] },
];

const INQUIRY_TYPES = ['Investor Relations', 'Brand + Media', 'Performance Partnerships', 'Community + Events', 'Other'];

function Field({
  label,
  name,
  type = 'text',
  required = false,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="group block">
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 group-focus-within:text-primary mb-3 transition-colors">
        {label} {required && <span className="text-primary/70">*</span>}
      </div>
      <input
        type={type}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-white/15 focus:border-primary outline-none py-3 text-base text-white placeholder:text-white/25 transition-colors"
      />
    </label>
  );
}

function ContactForm() {
  const [state, setState] = useState({
    name: '',
    email: '',
    organization: '',
    inquiry: INQUIRY_TYPES[0],
    message: '',
    instagram: '',
    linkedin: '',
    referral: '',
  });
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof typeof state>(k: K) {
    return (v: string) => setState((s) => ({ ...s, [k]: v }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-20 flex flex-col items-center gap-8">
        <div className="w-2 h-2 rounded-full bg-primary pulse-dot" />
        <h3 className="text-3xl md:text-5xl font-bold tracking-tight">
          Inquiry received.
        </h3>
        <p className="text-white/55 max-w-md">
          Thank you, {state.name || 'operator'}. The team will respond within
          two business days from <span className="text-white">{state.email}</span>.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setState({ name: '', email: '', organization: '', inquiry: INQUIRY_TYPES[0], message: '', instagram: '', linkedin: '', referral: '' });
          }}
          className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors"
        >
          Submit another →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-2 gap-x-12 gap-y-10">
      <Field label="Name" name="name" required value={state.name} onChange={update('name')} />
      <Field label="Email" name="email" type="email" required value={state.email} onChange={update('email')} />
      <Field label="Organization" name="organization" value={state.organization} onChange={update('organization')} />

      <label className="group block">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 group-focus-within:text-primary mb-3 transition-colors">Inquiry type</div>
        <select
          value={state.inquiry}
          onChange={(e) => update('inquiry')(e.target.value)}
          className="w-full bg-transparent border-b border-white/15 focus:border-primary outline-none py-3 text-base text-white appearance-none cursor-pointer"
        >
          {INQUIRY_TYPES.map((t) => (
            <option key={t} value={t} className="bg-black">{t}</option>
          ))}
        </select>
      </label>

      <label className="group block md:col-span-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 group-focus-within:text-primary mb-3 transition-colors">Message <span className="text-primary/70">*</span></div>
        <textarea
          required
          value={state.message}
          onChange={(e) => update('message')(e.target.value)}
          rows={5}
          className="w-full bg-transparent border-b border-white/15 focus:border-primary outline-none py-3 text-base text-white placeholder:text-white/25 transition-colors resize-none"
        />
      </label>

      <Field label="Instagram (optional)" name="instagram" value={state.instagram} onChange={update('instagram')} />
      <Field label="LinkedIn (optional)" name="linkedin" value={state.linkedin} onChange={update('linkedin')} />
      <Field label="Referral source (optional)" name="referral" value={state.referral} onChange={update('referral')} />

      <div className="md:col-span-2 pt-8 flex justify-end">
        <button type="submit" className="group inline-flex items-center gap-4 px-8 py-4 bg-white text-black hover:bg-primary hover:text-white rounded-full transition-all duration-500">
          <span className="text-[11px] uppercase tracking-[0.35em] font-bold">Request Access</span>
          <span className="inline-block transition-transform duration-500 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </form>
  );
}

export default function Contact() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <SiteNav current="/contact" />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-center px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-0 grain" />
        <svg className="absolute inset-x-0 top-2/3 w-full h-32 opacity-20" viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d="M0,50 Q300,30 600,50 T1200,50" fill="none" stroke="#ff3548" strokeWidth="0.6" />
          <path d="M0,50 Q300,70 600,50 T1200,50" fill="none" stroke="white" strokeOpacity="0.15" strokeWidth="0.4" />
        </svg>

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">Contact</span>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] font-bold tracking-[-0.02em] leading-[0.95] mb-12">
              Enter the<br /><span className="text-glow-primary">ecosystem.</span>
            </h1>
          </Reveal>
          <Reveal delay={600}>
            <p className="text-lg md:text-2xl text-white/65 font-light max-w-3xl leading-relaxed">
              For partnerships, investor access, media, performance
              collaborations, and institutional inquiries.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 01 PATHWAYS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">01 / Pathways</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Four channels.<br /><span className="text-white/55">One ecosystem.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
            {PATHWAYS.map((p, i) => (
              <Reveal key={p.k} delay={i * 120}>
                <a href={`mailto:${p.email}`} className="relative bg-black p-10 lg:p-14 group block overflow-hidden h-full">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,20,30,0.12)_0%,transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em]">{p.n}</span>
                      <span className="inline-block text-primary opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:translate-x-1">→</span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-6 group-hover:text-primary transition-colors duration-500">{p.k}</h3>
                    <ul className="space-y-2 mb-8">
                      {p.items.map((item) => (
                        <li key={item} className="text-sm text-white/55 flex items-center gap-3">
                          <div className="w-1 h-1 rounded-full bg-primary/60" />{item}
                        </li>
                      ))}
                    </ul>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 group-hover:text-white transition-colors">{p.email}</div>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 02 FORM ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(180,20,30,0.10)_0%,transparent_55%)] breathe" />
        <div className="relative max-w-4xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">02 / Inquiry</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20">
              Submit your<br /><span className="text-white/55">request.</span>
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <ContactForm />
          </Reveal>
        </div>
      </section>

      {/* ─── 03 DIRECT ACCESS ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">03 / Direct Access</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-20 max-w-3xl">
              Direct lines.
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-2 border-t border-white/[0.06]">
            {[
              { k: 'Investor relations', v: 'investors@aforce.co' },
              { k: 'Partnerships', v: 'partnerships@aforce.co' },
              { k: 'Media inquiries', v: 'press@aforce.co' },
              { k: 'Community + events', v: 'community@aforce.co' },
            ].map((d, i) => (
              <Reveal key={d.k} delay={i * 90}>
                <a href={`mailto:${d.v}`} className="group flex items-baseline justify-between gap-8 py-8 border-b border-white/[0.06] hover:border-primary/40 transition-colors duration-500">
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/55 group-hover:text-white transition-colors">{d.k}</span>
                  <span className="text-lg md:text-xl font-bold tracking-tight group-hover:text-primary transition-colors duration-500">{d.v}</span>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <div className="flex flex-wrap gap-8 mt-16 text-[10px] uppercase tracking-[0.3em] text-white/40">
              {['Instagram', 'LinkedIn', 'X / Twitter', 'YouTube'].map((s) => (
                <a key={s} href="#" className="hover:text-white transition-colors">{s} →</a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── 04 PRIVATE EXPERIENCE ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(180,20,30,0.14)_0%,transparent_60%)] breathe" />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/80 to-transparent" />

        <div className="relative max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">04 / Private Experience</span>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-12 max-w-4xl">
              Built for people<br />operating <span className="text-glow-primary">under pressure.</span>
            </h2>
          </Reveal>
          <Reveal delay={500}>
            <p className="text-lg md:text-xl text-white/65 font-light max-w-2xl leading-relaxed">
              AForce works with founders, performers, athletes, executives,
              creators, and institutions committed to sustained performance.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 05 LOCATION ─── */}
      <section className="relative w-full py-40 lg:py-56 px-6 lg:px-24 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <Reveal className="lg:col-span-5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">05 / Headquarters</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-10">
              Miami.<br /><span className="text-white/55">Brickell.</span>
            </h2>
            <p className="text-lg text-white/65 font-light leading-relaxed">
              The first ecosystem node. A modern performance hub for the next
              generation of operators.
            </p>
          </Reveal>
          <Reveal delay={300} className="lg:col-span-7">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-sm border border-white/[0.06] bg-gradient-to-br from-[#0a0a0a] via-black to-[#0a0303]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(180,20,30,0.18)_0%,transparent_60%)] breathe" />
              <div className="absolute inset-0 grain" />
              {/* skyline silhouette */}
              <svg className="absolute inset-x-0 bottom-0 w-full h-2/3 opacity-50" viewBox="0 0 800 300" preserveAspectRatio="none">
                <path d="M0,300 L0,200 L40,200 L40,140 L80,140 L80,180 L120,180 L120,100 L150,100 L150,160 L190,160 L190,80 L220,80 L220,170 L260,170 L260,120 L300,120 L300,60 L340,60 L340,150 L380,150 L380,110 L420,110 L420,40 L460,40 L460,130 L500,130 L500,90 L540,90 L540,170 L580,170 L580,130 L620,130 L620,180 L660,180 L660,110 L700,110 L700,200 L740,200 L740,160 L800,160 L800,300 Z" fill="black" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
              </svg>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                  <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Brickell · Miami · FL</span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">25.7617° N · 80.1918° W</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FINAL ─── */}
      <section className="relative w-full py-64 lg:py-80 px-6 lg:px-24 border-t border-white/[0.04] flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.15)_0%,rgba(0,0,0,1)_75%)] breathe" />
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
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group inline-flex items-center gap-4 px-8 py-4 border border-white/15 hover:border-primary/70 rounded-full transition-all duration-500">
              <span className="text-xs uppercase tracking-[0.4em] font-bold text-white group-hover:text-primary transition-colors">Enter the Ecosystem</span>
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
