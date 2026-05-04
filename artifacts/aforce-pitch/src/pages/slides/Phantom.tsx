export default function Phantom() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 78% 50%, rgba(84,120,213,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 40% at 18% 78%, rgba(229,51,65,0.06) 0%, transparent 70%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">12 — Phantom Hardware</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 28</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
            <div className="h-[2px] w-[5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-blue font-semibold">The Wearable</span>
          </div>
          <h1 className="font-display text-[5vw] leading-[0.92] tracking-tighter text-balance">
            The OS, on your <span className="text-blue">wrist.</span>
          </h1>
          <p className="mt-[1.4vh] font-body text-[1.15vw] text-text/65 leading-snug">
            No screen. No notifications. One LED edge. Real-time hydration state, communicated by color.
          </p>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          Phantom is the only first-party device built around the AForce loop — every reading routes back to the can, the stick, the recommendation.
        </p>
      </div>

      <div className="absolute top-[34vh] bottom-[14vh] left-[6vw] right-[6vw] grid grid-cols-[1fr_1.45fr] gap-[2vw]">
        <div className="flex flex-col gap-[1.6vh]">
          <div className="relative rounded-2xl ring-1 ring-blue/35 bg-bg-elev/40 overflow-hidden flex-1">
            <div className="absolute inset-0 bg-gradient-to-b from-blue/[0.10] to-blue/0 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-[3px] bg-blue" />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] font-semibold text-blue">Tier 01 · Hero · Premium</div>
              <div className="flex items-baseline gap-[0.7vw] mt-[1.4vh]">
                <div className="font-display text-[2.4vw] leading-none tracking-tight text-blue">Phantom One</div>
              </div>
              <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh]">Hydration & Performance Band</div>
              <div className="font-body text-[0.92vw] text-text/72 leading-snug mt-[1.4vh]">
                Soft-touch strap, LED edge light, BLE-paired to AForce OS. The everyday band — minimal, futuristic, premium.
              </div>
              <div className="mt-auto pt-[1.4vh] border-t border-text/10 flex flex-wrap gap-[0.5vw]">
                {["Soft-touch strap", "LED edge", "BLE 5.3", "7-day battery", "Haptic engine"].map((c) => (
                  <span
                    key={c}
                    className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/55 px-[0.55vw] py-[0.4vh] rounded border border-text/10"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl ring-1 ring-text/25 bg-bg-elev/40 overflow-hidden flex-1">
            <div className="absolute inset-0 bg-gradient-to-b from-text/[0.06] to-text/0 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-[3px] bg-text/70" />
            <div className="relative p-[1.4vw] flex flex-col h-full">
              <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] font-semibold text-text/85">Tier 02 · Luxury · Limited</div>
              <div className="flex items-baseline gap-[0.7vw] mt-[1.4vh]">
                <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">Phantom Meridian</div>
              </div>
              <div className="font-body text-[0.85vw] text-text/55 mt-[0.4vh]">Ceramic Edition · Refined. Timeless. Powerful.</div>
              <div className="font-body text-[0.92vw] text-text/72 leading-snug mt-[1.4vh]">
                Advanced ceramic finish with a refined link bracelet. Same engine inside — jewelry-grade execution outside.
              </div>
              <div className="mt-auto pt-[1.4vh] border-t border-text/10 flex flex-wrap gap-[0.5vw]">
                {["Ceramic body", "Linked bracelet", "Sapphire LED guide", "Limited series"].map((c) => (
                  <span
                    key={c}
                    className="font-body uppercase tracking-[0.22em] text-[0.65vw] text-text/55 px-[0.55vw] py-[0.4vh] rounded border border-text/10"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden ring-1 ring-text/15 bg-black">
          <img
            src={`${base}phantom-overview.png`}
            alt="Phantom One hero, LED state feedback, Phantom Meridian luxury edition, and component tech overview"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw] border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between gap-[2vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-blue font-semibold whitespace-nowrap shrink-0">
          Optimal · Good · Caution · Alert
        </div>
        <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text text-center whitespace-nowrap">
          Glance the <span className="text-blue">color.</span> Know the <span className="text-text">state.</span> Trust the <span className="text-primary">loop.</span>
        </div>
        <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] text-muted text-right leading-snug whitespace-nowrap shrink-0">
          <div>Phantom One · 2026</div>
          <div>Meridian · 2027</div>
        </div>
      </div>
    </div>
  );
}
