import { useReveal } from "../hooks/useReveal";
import { FLAVORS } from "../data/flavors";

export default function Sticks() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="sticks"
      className="border-t border-white/[0.06] px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
    >
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow reveal text-signal">Single-Serve</p>
            <h2 className="reveal mt-4 max-w-xl font-display text-3xl leading-tight tracking-[-0.01em] text-bone sm:text-4xl">
              The ritual, anywhere.
            </h2>
          </div>
          <p className="reveal max-w-xs text-sm leading-relaxed text-bone/55 sm:text-right">
            Every flavor in a single-serve stick. Pocket it for the gate, the
            green room, the pre-op scrub. Just add water.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {FLAVORS.map((flavor, i) => (
            <article
              key={flavor.id}
              className="reveal group flex flex-col"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {/* White product plate — studio stick shot sits on white seamlessly */}
              <div className="relative overflow-hidden rounded-2xl bg-white">
                <div className="relative flex h-80 w-full items-center justify-center p-8">
                  <img
                    src={flavor.stick}
                    alt={flavor.stickAlt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-auto object-contain transition-transform duration-500 group-hover:-translate-y-1"
                  />
                </div>
                {/* Flavor accent rule along the base of the plate */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1"
                  style={{ backgroundColor: flavor.color }}
                />
              </div>

              {/* Info sits on the dark canvas below the plate */}
              <div className="px-1 pt-6">
                <h3 className="font-display text-xl text-bone">{flavor.name}</h3>
                <p className="mt-2 font-mono text-xs tracking-[0.16em] text-bone/45 uppercase">
                  {flavor.botanical} · 0.28 oz (8 g)
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
