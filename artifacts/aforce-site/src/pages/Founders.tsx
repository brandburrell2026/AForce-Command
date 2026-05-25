import { Link } from 'wouter';
import { AmbientAudio } from '@/components/AmbientAudio';
import { Reveal } from '@/components/Reveal';

const AFORCE_OS_URL = '/aforce-os/';

// Photo slots — replace src with real monochrome founder photography when delivered.
// Until then, each slot renders a cinematic typographic + atmospheric placeholder.
function PhotoSlot({
  label,
  ratio = 'aspect-[4/5]',
  caption,
}: {
  label: string;
  ratio?: string;
  caption?: string;
}) {
  return (
    <div className={`relative ${ratio} w-full overflow-hidden rounded-sm border border-white/[0.06] bg-gradient-to-br from-[#0a0a0a] via-black to-[#0a0303]`}>
      {/* atmospheric layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(180,20,30,0.20)_0%,transparent_60%)] breathe" />
      <div className="absolute inset-0 grain" />
      {/* red edge glow */}
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-primary/10 to-transparent" />
      {/* central monogram */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
        <span className="text-white/30 text-[9px] uppercase tracking-[0.4em] font-bold">
          {label}
        </span>
      </div>
      {caption && (
        <div className="absolute bottom-4 left-4 right-4 text-[9px] uppercase tracking-[0.3em] text-white/25">
          {caption}
        </div>
      )}
    </div>
  );
}

function FoundersNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
          <span className="text-sm font-bold tracking-[0.3em] uppercase">AForce</span>
        </Link>
        <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.25em] text-white/55">
          <Link href="/manifesto" className="hover:text-white transition-colors">Manifesto</Link>
          <Link href="/science" className="hover:text-white transition-colors">Science</Link>
          <span className="text-white">Founders</span>
        </div>
        <Link href="/" className="text-[11px] uppercase tracking-[0.3em] text-white/55 hover:text-white transition-colors">
          ← Back
        </Link>
      </div>
    </nav>
  );
}

export default function Founders() {
  return (
    <div className="bg-black min-h-screen text-white overflow-x-hidden relative font-sans selection:bg-primary/40 selection:text-white">
      <AmbientAudio />
      <FoundersNav />

      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[100dvh] flex items-end px-6 lg:px-24 pt-32 pb-24 overflow-hidden">
        {/* hero image slot */}
        <div className="absolute inset-0">
          <PhotoSlot label="Hero — Brandon + Julius Burrell" ratio="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <Reveal>
            <div className="flex items-center gap-4 mb-10">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.4em] text-[10px] font-bold">
                The Founders
              </span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] font-bold tracking-[-0.02em] leading-[0.95] mb-12">
              Built under<br />
              <span className="text-glow-primary">pressure.</span>
            </h1>
          </Reveal>

          <Reveal delay={600}>
            <p className="text-lg md:text-2xl text-white/70 font-light max-w-3xl leading-relaxed">
              AForce was not created from trends. It was built from
              responsibility, discipline, and the belief that performance is
              earned daily.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── 01 THE BEGINNING ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                01 / The Beginning
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-20 max-w-4xl">
              Before AForce,<br />
              <span className="text-white/55">there was the standard.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-start">
            <Reveal delay={300}>
              <div className="space-y-8 text-lg md:text-xl text-white/70 font-light leading-relaxed">
                <p>
                  Two brothers — raised on discipline, sharpened by ambition,
                  shaped by responsibility. The standard was not taught. It was
                  inherited.
                </p>
                <p>
                  Performance, in their house, was never a goal. It was the
                  baseline. The thing you owed to the people who counted on you.
                </p>
                <p>
                  Long before AForce had a name, it had a posture: show up
                  prepared, every day, without exception.
                </p>
              </div>
            </Reveal>

            <Reveal delay={500}>
              <PhotoSlot label="Editorial — early years" ratio="aspect-[4/5]" caption="Photo slot — drop in monochrome archive image" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 02 BRANDON BURRELL ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(180,20,30,0.10)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <Reveal className="lg:col-span-5">
            <PhotoSlot label="Brandon Burrell — portrait" ratio="aspect-[4/5]" caption="Photo slot — monochrome editorial portrait" />
          </Reveal>

          <div className="lg:col-span-7 lg:pl-8">
            <Reveal delay={150}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                  02 / Brandon Burrell
                </span>
              </div>
            </Reveal>

            <Reveal delay={250}>
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-4">
                Brandon
              </h2>
              <h3 className="text-2xl md:text-3xl font-light text-white/55 tracking-tight mb-10">
                Founder. Operator. Systems thinker.
              </h3>
            </Reveal>

            <Reveal delay={400}>
              <p className="text-lg md:text-xl text-white/70 font-light leading-relaxed mb-12 max-w-2xl">
                A background in finance and global hospitality leadership.
                Operational experience built across continents. The kind of
                practitioner who sees a company the way a physicist sees a
                system — inputs, loops, compounding feedback. AForce is the
                output of that worldview.
              </p>
            </Reveal>

            <Reveal delay={550}>
              <ul className="space-y-3 max-w-md">
                {[
                  'Finance + capital markets background',
                  'Global hospitality leadership',
                  'Cross-border operational experience',
                  'Performance + ecosystem philosophy',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-4 text-sm uppercase tracking-[0.18em] text-white/75 py-3 border-b border-white/[0.05]">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── 03 JULIUS BURRELL ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(180,20,30,0.10)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 lg:order-1 order-2 lg:pr-8">
            <Reveal delay={150}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-px bg-primary" />
                <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                  03 / Julius Burrell
                </span>
              </div>
            </Reveal>

            <Reveal delay={250}>
              <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-4">
                Julius
              </h2>
              <h3 className="text-2xl md:text-3xl font-light text-white/55 tracking-tight mb-10">
                Co-founder. Execution. Cultural backbone.
              </h3>
            </Reveal>

            <Reveal delay={400}>
              <p className="text-lg md:text-xl text-white/70 font-light leading-relaxed mb-12 max-w-2xl">
                The operational force. The grounded builder. The partner who
                turns conviction into shipped reality. Where the company moves
                from idea to standard, Julius is the reason the standard holds.
                He is the cultural backbone — the part that does not flinch.
              </p>
            </Reveal>

            <Reveal delay={550}>
              <ul className="space-y-3 max-w-md">
                {[
                  'Execution-led operator',
                  'Cultural and operational backbone',
                  'Trusted co-founder, on every front',
                  'Bias for shipping the standard',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-4 text-sm uppercase tracking-[0.18em] text-white/75 py-3 border-b border-white/[0.05]">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal className="lg:col-span-5 lg:order-2 order-1">
            <PhotoSlot label="Julius Burrell — portrait" ratio="aspect-[4/5]" caption="Photo slot — monochrome editorial portrait" />
          </Reveal>
        </div>
      </section>

      {/* ─── 04 WHY AFORCE EXISTS ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-[#020202] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(180,20,30,0.16)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                04 / Why AForce
              </span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-20 max-w-4xl">
              Performance is<br />
              <span className="text-glow-primary">non-negotiable.</span>
            </h2>
          </Reveal>

          <Reveal delay={350}>
            <p className="text-lg md:text-xl text-white/65 font-light leading-relaxed max-w-3xl mb-16">
              AForce was built for the people who operate under pressure — the
              ones who carry weight others cannot see. Identity, ritual,
              accountability, hydration, behavioral systems: all of it engineered
              for the people who do not get to be off.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-6 gap-x-4 border-t border-white/[0.06] pt-10">
            {['Founders', 'Athletes', 'Surgeons', 'Performers', 'Executives', 'Creators', 'Operators'].map((p, i) => (
              <Reveal key={p} delay={i * 100}>
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-white/75 font-bold">
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  {p}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 05 THE VISION ─── */}
      <section className="relative w-full py-48 lg:py-64 px-6 lg:px-24 z-10 border-t border-white/[0.04] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(180,20,30,0.22)_0%,transparent_70%)] breathe" />
        <div className="absolute inset-x-0 bottom-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-[20%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-[15%] h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        <div className="relative max-w-6xl mx-auto">
          <Reveal>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                05 / The Vision
              </span>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.02] mb-20">
              The future<br />
              <span className="text-glow-primary">is behavioral.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10 max-w-4xl">
            {[
              { k: 'A performance operating system', d: 'The instrument layer.' },
              { k: 'A ritual ecosystem', d: 'The behavioral substrate.' },
              { k: 'A behavioral intelligence platform', d: 'The data layer.' },
              { k: 'A premium identity brand', d: 'The cultural layer.' },
            ].map((v, i) => (
              <Reveal key={v.k} delay={i * 150}>
                <div className="py-6 border-t border-white/[0.06]">
                  <span className="text-primary/70 font-mono text-[10px] tracking-[0.3em] block mb-3">
                    0{i + 1}
                  </span>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">{v.k}</h3>
                  <p className="text-sm text-white/50">{v.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 06 BROTHERHOOD ─── */}
      <section className="relative w-full py-48 lg:py-72 px-6 lg:px-24 z-10 border-t border-white/[0.04] bg-black overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,20,30,0.12)_0%,transparent_60%)] breathe" />

        <div className="relative max-w-5xl mx-auto flex flex-col items-center gap-20">
          <Reveal>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <span className="text-primary uppercase tracking-[0.3em] text-[10px] font-bold">
                06 / Brotherhood
              </span>
              <div className="w-8 h-px bg-primary" />
            </div>
          </Reveal>

          <Reveal delay={300} className="w-full max-w-2xl">
            <PhotoSlot label="Brotherhood — meaningful founder image" ratio="aspect-[4/3]" caption="Photo slot — monochrome, fading into darkness" />
          </Reveal>

          <Reveal delay={600}>
            <h2 className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-bold tracking-[-0.03em] leading-[0.9] text-center">
              Built<br />
              <span className="text-glow-primary">together.</span>
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ─── FINAL ─── */}
      <section className="relative w-full py-64 lg:py-80 px-6 lg:px-24 z-10 border-t border-white/[0.04] flex flex-col items-center text-center overflow-hidden">
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
              <span className="inline-block text-primary transition-transform duration-500 group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
