import Reveal from "../Reveal";
import { FLAVORS } from "@/lib/flavors";

export default function Products() {
  return (
    <section
      id="products"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow text-signal">The Product</p>
              <h2 className="mt-6 max-w-2xl font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl">
                Three flavors,
                <br />
                <span className="chrome-text">one standard.</span>
              </h2>
            </div>
            <p className="max-w-xs font-mono text-xs uppercase tracking-[0.16em] text-bone/45 sm:text-right">
              pH 8.8 · Electrolytes + Minerals · 11 fl oz
            </p>
          </div>
        </Reveal>

        {/* Floating chrome cans with reflections */}
        <div className="mt-24 grid gap-x-6 gap-y-24 sm:grid-cols-3">
          {FLAVORS.map((f, i) => (
            <Reveal key={f.id} delay={i * 0.1} variant="fade">
              <div className="group relative flex flex-col items-center text-center">
                {/* Flavor halo */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-6 h-64 w-64 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ background: f.color }}
                />

                {/* Can + reflection */}
                <div className="relative z-10 flex flex-col items-center">
                  <img
                    src={`/cans-cut/${f.id}.png`}
                    alt={f.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-[26rem] w-auto object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)] transition-transform duration-700 ease-out group-hover:-translate-y-3"
                  />
                  {/* Glass reflection */}
                  <img
                    src={`/cans-cut/${f.id}.png`}
                    alt=""
                    aria-hidden
                    className="pointer-events-none -mt-2 h-32 w-auto -scale-y-100 object-cover object-top opacity-20 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.6),transparent_70%)]"
                  />
                </div>

                <div className="relative z-10 -mt-6">
                  <span
                    className="mx-auto block h-1 w-10 rounded-full"
                    style={{ backgroundColor: f.color }}
                  />
                  <h3 className="mt-6 font-display text-2xl text-bone">
                    {f.name}
                  </h3>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-bone/45">
                    {f.botanical} · pH 8.8
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Single-serve sticks — quiet secondary strip */}
        <Reveal variant="fade" className="mt-28">
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 sm:px-12">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-md">
                <p className="eyebrow text-signal">Single-Serve</p>
                <h3 className="mt-5 font-display text-3xl leading-tight text-bone sm:text-4xl">
                  The ritual, anywhere.
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-bone/55">
                  Every flavor in an 8 g stick. Pocket it for the gate, the green
                  room, the pre-op scrub. Just add water.
                </p>
              </div>
              <div className="flex items-end justify-center gap-6 sm:gap-10">
                {FLAVORS.map((f) => (
                  <div key={f.id} className="flex flex-col items-center">
                    <img
                      src={`/sticks-cut/${f.id}.png`}
                      alt={`AForce ${f.name} single-serve stick`}
                      loading="lazy"
                      className="h-56 w-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:-translate-y-2"
                    />
                    <span
                      className="mt-4 h-0.5 w-6 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
