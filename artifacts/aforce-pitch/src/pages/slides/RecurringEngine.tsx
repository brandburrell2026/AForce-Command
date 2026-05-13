export default function RecurringEngine() {
  const layers = [
    {
      label: "Product",
      title: "Hydration sticks, cans, bundles.",
      body: "Daily usage. Repeat purchase. The entry point that becomes a habit.",
      accent: "text-primary",
      ring: "ring-primary/35",
      bar: "bg-primary",
      bg: "from-primary/[0.10] to-primary/0",
    },
    {
      label: "Subscription · OS",
      title: "Personalized hydration intelligence.",
      body: "Real-time coaching + performance tracking. Recurring revenue at 90%+ gross margin.",
      accent: "text-accent",
      ring: "ring-accent/35",
      bar: "bg-accent",
      bg: "from-accent/[0.10] to-accent/0",
    },
    {
      label: "Data Loop",
      title: "Behavior → insights → better recommendations.",
      body: "Every cycle increases retention and spend. The asset that compounds.",
      accent: "text-blue",
      ring: "ring-blue/35",
      bar: "bg-blue",
      bg: "from-blue/[0.10] to-blue/0",
    },
  ];

  const metrics = [
    { value: "$52", label: "AOV" },
    { value: "5–7×", label: "Yearly repeat" },
    { value: "$5 · $15", label: "OS / month" },
    { value: "90%+", label: "Retention potential" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 50% at 20% 25%, rgba(229,51,65,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 50% at 85% 30%, rgba(245,214,55,0.12) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 90%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">20 — Recurring Engine</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">20 / 25</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Three Layers · One Engine</span>
          </div>
          <h2 className="font-display text-[4.6vw] leading-[0.92] tracking-tighter">
            Every user <span className="text-accent">becomes a system.</span>
          </h2>
        </div>
        <p className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <span className="text-text">Behavior-driven, recurring-revenue platform.</span> Product creates entry. The system creates compounding value.
        </p>
      </div>

      <div className="absolute top-[36vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.4vw]">
        {layers.map((l, i) => (
          <div key={l.label} className={`relative rounded-2xl ring-1 ${l.ring} bg-bg-elev/40 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-b ${l.bg} pointer-events-none`} />
            <div className={`absolute inset-x-0 top-0 h-[3px] ${l.bar}`} />
            <div className="relative p-[1.4vw] flex flex-col h-[26vh]">
              <div className="flex items-center justify-between">
                <div className={`font-body uppercase tracking-[0.28em] text-[0.85vw] ${l.accent} font-semibold`}>{l.label}</div>
                <div className={`font-display text-[1.4vw] ${l.accent} leading-none opacity-70`}>0{i + 1}</div>
              </div>
              <div className="font-display text-[1.6vw] leading-tight tracking-tight text-text mt-[1.4vh]">{l.title}</div>
              <div className="mt-auto pt-[1.4vh] border-t border-text/10 font-body text-[0.95vw] text-text/65 leading-snug">
                {l.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-[66vh] left-[6vw] right-[6vw]">
        <div className="rounded-2xl ring-1 ring-accent/35 bg-bg-elev/40 px-[2vw] py-[2vh] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.06] via-accent/[0.06] to-blue/[0.06] pointer-events-none" />
          <div className="relative font-display text-[2vw] leading-[1.2] tracking-tight text-center">
            <span className="text-primary">Performance</span>
            <span className="text-text/55"> creates </span>
            <span className="text-text">habit.</span>
            <span className="text-text/35"> · </span>
            <span className="text-text">Habit</span>
            <span className="text-text/55"> creates </span>
            <span className="text-accent">subscription.</span>
            <span className="text-text/35"> · </span>
            <span className="text-accent">Subscription</span>
            <span className="text-text/55"> creates </span>
            <span className="text-blue">enterprise value.</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="grid grid-cols-4 gap-[1vw]">
            {metrics.map((m, i) => (
              <div key={m.label} className={`flex flex-col ${i > 0 ? "border-l border-text/10 pl-[1vw]" : ""}`}>
                <div className="font-display text-[1.8vw] leading-none text-text">{m.value}</div>
                <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/55 mt-[0.6vh]">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
