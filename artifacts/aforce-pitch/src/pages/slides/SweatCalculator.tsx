export default function SweatCalculator() {
  const inputs = [
    { label: "Pre-weight",   value: "225", unit: "lbs" },
    { label: "Post-weight",  value: "221", unit: "lbs" },
    { label: "Height",       value: "70",  unit: "in"  },
    { label: "Duration",     value: "90",  unit: "min" },
    { label: "Fluid intake", value: "8",   unit: "oz"  },
    { label: "Urine output", value: "3",   unit: "oz"  },
    { label: "Sport",        value: "Soccer", unit: "" },
  ];

  const audit = [
    { k: "Sweat-sodium concentration", v: "1,449 mg/L" },
    { k: "Sodium profile",             v: "Very Heavy · acclimatized" },
    { k: "Sport reference",            v: "Soccer · 1.13 L/h" },
    { k: "Climate factor",             v: "×1.03" },
    { k: "Acclim. sweat factor",       v: "×1.08" },
    { k: "Body surface area",          v: "1.95 m²" },
    { k: "Method",                     v: "Direct (ACSM)" },
  ];

  const citations = [
    { label: "Sweat-rate method",        cite: "Sawka et al. · ACSM 2007" },
    { label: "Sport sweat references",   cite: "Baker · Sports Med 2017" },
    { label: "Replacement window",       cite: "Maughan & Shirreffs 2010" },
    { label: "Acclim. & Na⁺ adjustment", cite: "Périard 2015 · Cheuvront 2014" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[18vh] -left-[10vw] w-[55vw] h-[55vw] rounded-full bg-blue/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[20vh] -right-[12vw] w-[55vw] h-[55vw] rounded-full bg-accent/[0.10] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      {/* Eyebrow */}
      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">12 — Inside the OS</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 27</div>
      </div>

      {/* Headline */}
      <div className="absolute top-[12vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[4vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-accent font-semibold">Sweat Intelligence · Engine</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[5vw]">
          <span className="text-text">Measured. Engineered. </span>
          <span className="text-accent">Replenished.</span>
        </h1>
        <div className="font-body text-[1.05vw] text-text/60 mt-[1.6vh] max-w-[60vw] leading-tight">
          Six inputs become a peer-reviewed sweat profile and an exact AForce protocol — in under a second.
          <span className="text-text/85"> The OS is not a tracker. It is a prescription engine.</span>
        </div>
      </div>

      {/* Body grid */}
      <div className="absolute top-[40vh] bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-[1.05fr_0.95fr_18vw] gap-[2vw] z-10">

        {/* ────────── COLUMN 1 — INPUTS ────────── */}
        <div
          className="relative rounded-2xl bg-[#0c1220] border border-blue/40 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(84,120,213,0.18) inset" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-blue" />
          <div className="px-[1.2vw] pt-[1.4vh] pb-[1vh] border-b border-text/8 flex items-center justify-between">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.7vw] h-[0.7vw] rounded-full bg-blue" />
              <span className="font-display font-bold text-text text-[1.1vw] tracking-tight">01 · MEASURE</span>
            </div>
            <span className="font-body uppercase tracking-[0.18em] text-blue/80 text-[0.55vw] font-semibold">Precision mode</span>
          </div>

          <div className="px-[1.2vw] pt-[1vh] pb-[1.2vh] flex-1 flex flex-col gap-[0.7vh]">
            {inputs.map((i) => (
              <div key={i.label} className="flex items-center justify-between border-b border-text/8 pb-[0.6vh]">
                <span className="font-body text-text/65 text-[0.85vw]">{i.label}</span>
                <span className="font-body text-text text-[1vw] font-bold tabular-nums">
                  {i.value}
                  {i.unit && <span className="text-text/45 font-medium text-[0.7vw] ml-[0.3vw]">{i.unit}</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="px-[1.2vw] py-[0.9vh] bg-blue/[0.08] border-t border-blue/25 flex items-center justify-between">
            <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.6vw] font-semibold">Six inputs · 12 seconds</span>
            <span className="font-body text-blue text-[0.7vw] font-bold uppercase tracking-[0.16em]">→ engine</span>
          </div>
        </div>

        {/* ────────── COLUMN 2 — ENGINE / AUDIT ────────── */}
        <div
          className="relative rounded-2xl bg-[#15110a] border border-accent/40 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,214,55,0.18) inset" }}
        >
          <div className="absolute top-0 left-0 right-0 h-[0.4vh] bg-accent" />
          <div className="px-[1.2vw] pt-[1.4vh] pb-[1vh] border-b border-text/8 flex items-center justify-between">
            <div className="flex items-center gap-[0.6vw]">
              <span className="w-[0.7vw] h-[0.7vw] rounded-full bg-accent" />
              <span className="font-display font-bold text-text text-[1.1vw] tracking-tight">02 · ENGINE</span>
            </div>
            <span className="font-body uppercase tracking-[0.18em] text-accent/80 text-[0.55vw] font-semibold">Pure · auditable · cited</span>
          </div>

          {/* Headline numbers */}
          <div className="px-[1.2vw] pt-[1.2vh] pb-[1vh] grid grid-cols-3 gap-[0.8vw] border-b border-text/8">
            <div>
              <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw]">Sweat rate</div>
              <div className="font-display text-accent text-[1.6vw] leading-[1] font-bold mt-[0.3vh]">1.30<span className="text-text/55 font-body text-[0.7vw] ml-[0.25vw]">L/h</span></div>
            </div>
            <div>
              <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw]">Total loss</div>
              <div className="font-display text-text text-[1.6vw] leading-[1] font-bold mt-[0.3vh]">1.95<span className="text-text/55 font-body text-[0.7vw] ml-[0.25vw]">L</span></div>
            </div>
            <div>
              <div className="font-body uppercase tracking-[0.18em] text-text/45 text-[0.55vw]">Sodium loss</div>
              <div className="font-display text-text text-[1.6vw] leading-[1] font-bold mt-[0.3vh]">2.83<span className="text-text/55 font-body text-[0.7vw] ml-[0.25vw]">g</span></div>
            </div>
          </div>

          {/* Audit rows */}
          <div className="px-[1.2vw] pt-[1vh] pb-[1.2vh] flex-1 flex flex-col gap-[0.45vh]">
            {audit.map((r) => (
              <div key={r.k} className="flex items-center justify-between border-b border-text/6 pb-[0.35vh]">
                <span className="font-body text-text/55 text-[0.72vw]">{r.k}</span>
                <span className="font-body text-text text-[0.78vw] font-semibold tabular-nums">{r.v}</span>
              </div>
            ))}
          </div>

          <div className="px-[1.2vw] py-[0.9vh] bg-accent/[0.08] border-t border-accent/25 flex items-center justify-between">
            <span className="font-body uppercase tracking-[0.18em] text-text/65 text-[0.6vw] font-semibold">Every number is traceable</span>
            <span className="font-body text-accent text-[0.7vw] font-bold uppercase tracking-[0.16em]">→ protocol</span>
          </div>
        </div>

        {/* ────────── COLUMN 3 — PHONE / PRESCRIPTION ────────── */}
        <div className="flex flex-col items-center">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold mb-[0.8vh]">03 · Replenish</div>
          <div
            className="w-[18vw] flex-1 bg-bg-elev rounded-[1.6vw] border-2 border-text/20 overflow-hidden p-[0.8vw] flex flex-col shadow-2xl ring-1 ring-accent/15"
            style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
          >
            {/* Status bar */}
            <div className="flex justify-between items-center px-[0.3vw] mb-[0.5vh]">
              <span className="font-body text-[0.55vw] text-text font-medium">6:42</span>
              <div className="flex gap-[0.3vw] items-center">
                <span className="font-body text-[0.45vw] text-text/85 font-semibold">5G</span>
                <div className="px-[0.25vw] py-[0.1vh] rounded-[0.2vw] border border-text/55 font-body text-[0.4vw] text-text/85 leading-none">82</div>
              </div>
            </div>

            {/* Sweat rate card */}
            <div className="rounded-[0.5vw] bg-blue/10 border border-blue/35 px-[0.6vw] py-[0.55vh] mb-[0.5vh]">
              <div className="font-body uppercase tracking-[0.2em] text-blue text-[0.42vw] font-bold">Sweat Rate</div>
              <div className="font-display text-text text-[1.6vw] leading-none font-bold mt-[0.2vh]">1.30<span className="text-text/60 text-[0.7vw] font-body ml-[0.2vw]">L/h</span></div>
              <div className="font-body text-text/55 text-[0.42vw] mt-[0.25vh]">Total this session: <span className="text-text font-semibold">1.95 L</span> · Na⁺ <span className="text-text font-semibold">2.83 g</span></div>
            </div>

            {/* Mild dehydration */}
            <div className="rounded-[0.5vw] bg-accent/10 border border-accent/40 px-[0.6vw] py-[0.5vh] mb-[0.55vh]">
              <div className="flex items-baseline justify-between">
                <span className="px-[0.35vw] py-[0.08vh] rounded-full bg-accent/25 border border-accent/55 font-body text-accent text-[0.42vw] uppercase tracking-[0.14em] font-bold">Mild</span>
                <span className="font-display text-accent text-[0.95vw] font-bold leading-none">1.8%</span>
              </div>
              <div className="font-body text-text/75 text-[0.48vw] mt-[0.3vh] leading-tight">Edge of dehydration. Top up before next session.</div>
            </div>

            {/* AForce prescription */}
            <div className="rounded-[0.5vw] bg-bg/60 border border-accent/45 px-[0.6vw] py-[0.55vh] flex-1 flex flex-col">
              <div className="font-body uppercase tracking-[0.2em] text-accent text-[0.42vw] font-bold">AForce Prescription · Next 4h</div>
              <div className="font-body text-text text-[0.6vw] mt-[0.3vh] leading-tight font-semibold">
                Replace 83 oz over the next 4h — <span className="text-accent">6 sticks + 11 oz water.</span>
              </div>

              <div className="grid grid-cols-2 gap-[0.4vw] mt-[0.6vh]">
                <div className="rounded-[0.35vw] bg-text/[0.04] border border-text/10 px-[0.45vw] py-[0.35vh]">
                  <div className="font-display text-text text-[1vw] leading-none font-bold">6</div>
                  <div className="font-body text-text/55 text-[0.4vw] uppercase tracking-[0.14em] mt-[0.15vh]">Sticks</div>
                </div>
                <div className="rounded-[0.35vw] bg-text/[0.04] border border-text/10 px-[0.45vw] py-[0.35vh]">
                  <div className="font-display text-text text-[1vw] leading-none font-bold">11<span className="text-text/55 font-body text-[0.45vw] ml-[0.15vw]">oz</span></div>
                  <div className="font-body text-text/55 text-[0.4vw] uppercase tracking-[0.14em] mt-[0.15vh]">Water</div>
                </div>
                <div className="rounded-[0.35vw] bg-text/[0.04] border border-text/10 px-[0.45vw] py-[0.35vh]">
                  <div className="font-display text-text text-[1vw] leading-none font-bold">2,829<span className="text-text/55 font-body text-[0.45vw] ml-[0.15vw]">mg</span></div>
                  <div className="font-body text-text/55 text-[0.4vw] uppercase tracking-[0.14em] mt-[0.15vh]">Sodium</div>
                </div>
                <div className="rounded-[0.35vw] bg-text/[0.04] border border-text/10 px-[0.45vw] py-[0.35vh]">
                  <div className="font-display text-text text-[1vw] leading-none font-bold">21<span className="text-text/55 font-body text-[0.45vw] ml-[0.15vw]">oz/h</span></div>
                  <div className="font-body text-text/55 text-[0.4vw] uppercase tracking-[0.14em] mt-[0.15vh]">Refill rate · 4h</div>
                </div>
              </div>

              <div className="font-body text-text/55 text-[0.42vw] mt-[0.5vh] leading-snug">
                125% of measured loss — replaces sweat plus obligatory urine output (Sawka 2007).
              </div>
            </div>
          </div>
          <div className="font-body text-text/45 text-[0.55vw] mt-[0.6vh] uppercase tracking-[0.22em]">Live in AForce OS</div>
        </div>
      </div>

      {/* Citation strip */}
      <div className="absolute bottom-[3vh] left-[6vw] right-[6vw] z-10">
        <div className="border-t border-text/10 pt-[1.2vh] flex items-center justify-between gap-[1.5vw]">
          <div className="flex items-center gap-[1vw]">
            <div className="h-px w-[2.5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-accent font-semibold">Peer-reviewed · No black box</span>
          </div>
          <div className="flex items-center gap-[1.6vw]">
            {citations.map((c) => (
              <div key={c.label} className="text-right leading-tight">
                <div className="font-body text-text/45 text-[0.55vw] uppercase tracking-[0.18em]">{c.label}</div>
                <div className="font-body text-text/85 text-[0.7vw] font-semibold">{c.cite}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
