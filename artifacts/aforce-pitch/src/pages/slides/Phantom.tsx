export default function Phantom() {
  const base = import.meta.env.BASE_URL;

  const panels = [
    {
      n: "01",
      label: "Hero · Phantom One",
      img: `${base}phantom-hero.png`,
      caption: "Minimal design with LED edge light. No screen. Premium and futuristic.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
    },
    {
      n: "02",
      label: "LED State Feedback",
      img: `${base}phantom-states.png`,
      caption: "Real-time hydration status — communicated through color and pulse.",
      accent: "text-primary",
      ring: "ring-primary/30",
      bar: "bg-primary",
    },
    {
      n: "03",
      label: "Phantom Meridian · Luxury",
      img: `${base}phantom-meridian.png`,
      caption: "Ceramic edition. Refined link bracelet. Same engine, jewelry-grade execution.",
      accent: "text-text",
      ring: "ring-text/20",
      bar: "bg-text/70",
    },
    {
      n: "04",
      label: "Concept · Tech Stack",
      img: `${base}phantom-tech.png`,
      caption: "LED guide · sensor array · BLE · battery · haptic engine · soft-touch strap.",
      accent: "text-accent",
      ring: "ring-accent/30",
      bar: "bg-accent",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 82% 28%, rgba(84,120,213,0.16) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 55% at 18% 75%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      {/* Header */}
      <div className="absolute top-[5vh] left-[5vw] right-[5vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-blue font-semibold">15 — Phantom Hardware</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">15 / 24</div>
      </div>

      {/* Title row */}
      <div className="absolute top-[10vh] left-[5vw] right-[5vw] flex justify-between items-end gap-[3vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1vh]">
            <div className="h-[2px] w-[3.5vw] bg-blue" />
            <span className="font-body uppercase tracking-[0.32em] text-[1vw] text-blue font-semibold">Phase 2 · The Wearable</span>
          </div>
          <h2 className="font-display text-[4vw] leading-[0.92] tracking-tighter">
            The OS, <span className="text-blue">on your wrist.</span>
          </h2>
          <p className="font-body text-[0.95vw] text-text/65 leading-snug mt-[1vh] max-w-[55vw]">
            No screen. No notifications. One LED edge — real-time hydration state, communicated by color. Phantom is the only first-party device built around the AForce loop.
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-[0.7vw] px-[1vw] py-[0.6vh] rounded-full border border-accent/40 bg-accent/[0.08]">
          <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-accent font-semibold">Vision Slide</span>
          <span className="w-[1px] h-[1.4vh] bg-accent/30" />
          <span className="font-body text-[0.65vw] text-text/70">$0 of this round funds Phantom</span>
        </div>
      </div>

      {/* 2x2 panel grid */}
      <div className="absolute top-[28vh] bottom-[8vh] left-[5vw] right-[5vw] grid grid-cols-2 grid-rows-2 gap-[1.2vw]">
        {panels.map((p) => (
          <div
            key={p.n}
            className={`relative rounded-2xl ring-1 ${p.ring} bg-bg-elev/40 overflow-hidden flex flex-col`}
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.bar} z-10`} />

            {/* Photo */}
            <div className="relative flex-1 overflow-hidden">
              <img
                src={p.img}
                alt={p.label}
                className="absolute inset-0 w-full h-full object-cover select-none"
                draggable={false}
              />
            </div>

            {/* Caption strip */}
            <div className="relative px-[1.2vw] py-[1vh] border-t border-text/10 bg-bg/85 backdrop-blur-sm flex items-baseline gap-[0.8vw]">
              <span className={`font-display text-[1.1vw] leading-none tracking-tight ${p.accent} shrink-0`}>{p.n}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-body uppercase tracking-[0.26em] text-[0.65vw] font-semibold ${p.accent}`}>{p.label}</div>
                <div className="font-body text-[0.78vw] text-text/70 leading-snug mt-[0.2vh] truncate">{p.caption}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="absolute bottom-[2.5vh] left-[5vw] right-[5vw]">
        <div className="border-t border-text/10 pt-[1.2vh] flex justify-between items-center">
          <div className="font-display text-[1.2vw] leading-tight tracking-tight text-text/85">
            Glance the <span className="text-blue">color.</span> Know the <span className="text-text">state.</span> Trust the <span className="text-primary">loop.</span>
          </div>
          <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Phantom One · 2027 &nbsp;·&nbsp; Meridian · 2027+<br/>
            $4M Seed funds the can. Phantom funds itself on data.
          </div>
        </div>
      </div>
    </div>
  );
}
