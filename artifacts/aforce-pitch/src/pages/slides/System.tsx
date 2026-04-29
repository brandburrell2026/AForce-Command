export default function System() {
  const base = import.meta.env.BASE_URL;
  const flavors = [
    {
      n: "Flavor 01",
      name: "Berry Blast",
      addin: "+ Dulse",
      body: "For recovery, minerals, and daily control. A sea vegetable rich in iodine, iron, and potassium.",
      can: `${base}can-berry.png`,
      stick: `${base}stick-berry.png`,
      accentClass: "text-blue",
      ringClass: "ring-blue/55",
      barClass: "bg-blue",
      bgClass: "from-blue/[0.10] to-blue/0",
      glow: "rgba(84,120,213,0.42)",
    },
    {
      n: "Flavor 02",
      name: "Watermelon Surge",
      addin: "+ Chlorella",
      body: "For heat, stress, and performance correction. Natural electrolytes paired with a green-algae superfood.",
      can: `${base}can-watermelon.png`,
      stick: `${base}stick-watermelon.png`,
      accentClass: "text-primary",
      ringClass: "ring-primary/55",
      barClass: "bg-primary",
      bgClass: "from-primary/[0.10] to-primary/0",
      glow: "rgba(229,51,65,0.40)",
    },
    {
      n: "Flavor 03",
      name: "Soursop Edge",
      addin: "+ Sea Moss",
      body: "For deep recovery, minerals, and sustained support. 92 minerals from one ocean-grown botanical.",
      can: `${base}can-soursop.png`,
      stick: `${base}stick-soursop.png`,
      accentClass: "text-accent",
      ringClass: "ring-accent/55",
      barClass: "bg-accent",
      bgClass: "from-accent/[0.10] to-accent/0",
      glow: "rgba(245,214,55,0.42)",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(84,120,213,0.08) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">07 — Product</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">7 / 27</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-primary font-semibold">The Lineup</span>
        </div>
        <h1 className="font-display text-[4.4vw] leading-[0.92] tracking-tighter text-balance">
          One <span className="text-primary">system.</span> Delivered through <span className="text-accent">product.</span>
        </h1>
        <p className="mt-[1.4vh] font-body text-[1.15vw] text-text/65 leading-snug">
          Three signature flavors. Two formats. One performance loop.
        </p>
        <div className="mt-[1.6vh] flex items-start gap-[0.9vw] max-w-[68vw]">
          <div className="font-display text-[2.6vw] leading-none text-primary/70 select-none">"</div>
          <p className="font-display italic text-[1.45vw] leading-[1.25] tracking-tight text-text">
            AForce is the system we built to <span className="text-primary">stay sharp</span> when performance wasn't optional.
          </p>
        </div>
      </div>

      <div className="absolute top-[33vh] bottom-[14vh] left-[6vw] right-[6vw]">
        <div className="grid grid-cols-3 gap-[1.6vw] h-full">
          {flavors.map((f) => (
            <div
              key={f.name}
              className={`relative rounded-2xl ring-1 ${f.ringClass} bg-bg-elev/40 overflow-hidden flex flex-col`}
            >
              <div className={`absolute inset-0 bg-gradient-to-b ${f.bgClass} pointer-events-none`} />
              <div className={`absolute inset-x-0 top-0 h-[3px] ${f.barClass}`} />

              <div className="relative flex-1 flex items-end justify-center gap-[1vw] pt-[1.6vh] pb-[1vh] px-[1vw]">
                <div
                  className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[80%] h-[55%] rounded-full opacity-55 blur-[3.5vw]"
                  style={{ background: `radial-gradient(circle, ${f.glow} 0%, transparent 70%)` }}
                />
                <img
                  src={f.can}
                  alt=""
                  className="relative h-[28vh] object-contain"
                  style={{
                    filter: `drop-shadow(0 14px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 32px ${f.glow})`,
                  }}
                />
                <img
                  src={f.stick}
                  alt=""
                  className="relative h-[24vh] object-contain"
                  style={{
                    filter: `drop-shadow(0 12px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 28px ${f.glow})`,
                  }}
                />
              </div>

              <div className="relative px-[1.4vw] pb-[1.6vh]">
                <div className={`font-body uppercase tracking-[0.28em] text-[0.85vw] font-semibold ${f.accentClass}`}>
                  {f.n}
                </div>
                <div className="mt-[0.6vh] font-display text-[1.7vw] leading-tight tracking-tight text-text">
                  {f.name} <span className={f.accentClass}>{f.addin}</span>
                </div>
                <div className="mt-[1vh] font-body text-[0.92vw] text-text/65 leading-snug">{f.body}</div>
                <div className="mt-[1.4vh] pt-[1vh] border-t border-text/10 font-body uppercase tracking-[0.28em] text-[0.78vw] text-text/55 font-semibold">
                  325ml Can · 14g Stick
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-[3.5vh] left-[6vw] right-[6vw] border-t border-text/10 pt-[1.6vh] flex items-baseline justify-between gap-[2vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.9vw] text-primary font-semibold whitespace-nowrap shrink-0">
          pH 8.8 · Zero Sugar
        </div>
        <div className="font-display text-[1.5vw] leading-tight tracking-tight text-text text-center whitespace-nowrap">
          Every <span className="text-blue">format</span> serves the same outcome: <span className="text-primary">sustained</span> <span className="text-accent">performance.</span>
        </div>
        <div className="font-body uppercase tracking-[0.32em] text-[0.78vw] text-muted text-right leading-snug whitespace-nowrap shrink-0">
          <div>Spring 2026 Launch</div>
          <div>Cans + Sticks · Day One</div>
        </div>
      </div>
    </div>
  );
}
