import Reveal from "../Reveal";

export default function WhyAforce() {
  return (
    <section
      id="why"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="eyebrow text-signal">Why AForce</p>
        </Reveal>

        <div className="mt-10 grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Reveal delay={0.05}>
              <h2 className="font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl lg:text-7xl">
                A new category,
                <br />
                for people who
                <br />
                <span className="chrome-text">perform.</span>
              </h2>
            </Reveal>
          </div>

          <div className="flex items-end lg:col-span-5">
            <Reveal delay={0.15} variant="fade">
              <p className="max-w-md text-lg leading-relaxed text-bone/60">
                Not an energy drink. Not a sports drink. Premium alkaline
                performance hydration — engineered for the composure before the
                moment, not the noise after it.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Massive editorial photograph */}
        <Reveal delay={0.1} variant="fade" className="mt-16">
          <figure className="group relative overflow-hidden rounded-2xl border border-white/[0.06]">
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-elevated to-canvas-2" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.5]"
              style={{
                background:
                  "radial-gradient(60% 80% at 30% 20%, rgba(245,240,232,0.06), transparent 60%)",
              }}
            />
            <figcaption className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.25em] text-bone/40">
              Editorial photography · full-bleed
            </figcaption>
          </figure>
        </Reveal>

        {/* Audience — quiet list, no clutter */}
        <div className="mt-20 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {[
            "Entrepreneurs",
            "Athletes",
            "Executives",
            "Military",
            "Doctors",
            "Creators",
          ].map((who, i) => (
            <Reveal key={who} delay={i * 0.05} variant="fade">
              <div className="border-t border-white/[0.08] pt-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone/50">
                  {who}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
