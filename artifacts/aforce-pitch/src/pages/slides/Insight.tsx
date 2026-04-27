export default function Insight() {
  const oldModel = ["Push harder", "Drink when needed", "Hope it holds"];
  const newModel = ["Measure", "Adjust", "Stay in control"];
  const shifts = [
    { from: "Reactive", to: "Proactive" },
    { from: "Guessing", to: "Knowing" },
    { from: "Effort", to: "Precision" },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 82% 25%, rgba(245,214,55,0.14) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 18% 75%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">04 — Insight</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">04 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex justify-between items-end gap-[4vw]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
            <div className="h-[2px] w-[5vw] bg-accent" />
            <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Insight · The Leak</span>
          </div>
          <h2 className="font-display text-[4.8vw] leading-[0.92] tracking-tighter text-balance">
            Performance doesn't collapse. <span className="text-accent">It leaks.</span>
          </h2>
        </div>
        <div className="font-body text-[1.05vw] text-text/65 max-w-[26vw] leading-snug pb-[1vh] text-right">
          <div className="text-text">You don't feel it immediately. You feel it later.</div>
          <div className="mt-[1vh] text-text/55">
            <span className="text-text/85">Slower reactions.</span> <span className="text-text/85">Lower clarity.</span> <span className="text-text/85">Worse decisions.</span>
          </div>
          <div className="mt-[1.6vh] pt-[1vh] border-t border-text/15 italic text-[0.95vw] text-accent/80">
            We didn't learn this in theory. <span className="text-text">We learned it under pressure.</span>
          </div>
        </div>
      </div>

      <div className="absolute top-[36vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1vw] mb-[1.4vh]">
          <div className="h-px w-[3vw] bg-accent" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The Category Shift</div>
        </div>
        <div className="font-display text-[3.2vw] leading-[1.04] tracking-tight text-balance">
          <span className="text-text/55">Performance is not </span>
          <span className="text-text">effort.</span>
          <span className="text-text/55"> It is </span>
          <span className="text-accent">management.</span>
        </div>
      </div>

      <div className="absolute top-[53vh] bottom-[17vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[2vw]">
        <div className="relative rounded-2xl ring-1 ring-text/20 bg-bg-elev/40 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-text/40" />
          <div className="relative p-[1.6vw] flex flex-col h-full">
            <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-text/55 font-semibold">The Old Model</div>
            <div className="font-display text-[2vw] leading-tight tracking-tight text-text/75 mt-[1vh]">React. Push. Hope.</div>
            <ul className="mt-[1.6vh] space-y-[1vh]">
              {oldModel.map((m) => (
                <li key={m} className="flex items-center gap-[0.8vw] font-body text-[1.15vw] text-text/65">
                  <span className="text-text/30 font-display text-[1.3vw]">×</span> {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative rounded-2xl ring-1 ring-accent/35 bg-bg-elev/40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.10] to-accent/0 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-accent" />
          <div className="relative p-[1.6vw] flex flex-col h-full">
            <div className="font-body uppercase tracking-[0.28em] text-[0.85vw] text-accent font-semibold">The New Model</div>
            <div className="font-display text-[2vw] leading-tight tracking-tight text-text mt-[1vh]">Measure. Adjust. Hold.</div>
            <ul className="mt-[1.6vh] space-y-[1vh]">
              {newModel.map((m) => (
                <li key={m} className="flex items-center gap-[0.8vw] font-body text-[1.15vw] text-text">
                  <span className="text-accent font-display text-[1.3vw]">→</span> {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[2vh]">
          <div className="flex items-center justify-between gap-[2vw] flex-wrap">
            <div className="flex items-center gap-[2vw]">
              {shifts.map((s) => (
                <div key={s.from} className="flex items-center gap-[0.6vw] font-body text-[1.1vw]">
                  <span className="text-text/55">{s.from}</span>
                  <span className="text-accent">→</span>
                  <span className="text-text">{s.to}</span>
                </div>
              ))}
            </div>
            <div className="font-body text-[0.95vw] uppercase tracking-[0.28em]">
              <span className="text-text/45 mr-[0.8vw]">Unlocks</span>
              <span className="text-accent font-semibold">Consistency · Clarity · Control</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
