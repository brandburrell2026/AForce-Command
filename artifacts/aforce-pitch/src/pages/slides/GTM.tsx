import { Fragment } from "react";

export default function GTM() {
  const phase1Proof = [
    { obj: "Prove ritual adoption", kpi: "Repeat purchase 28–32%" },
    { obj: "Prove CAC efficiency", kpi: "CAC under $40" },
    { obj: "Prove subscription demand", kpi: "20%+ conversion" },
    { obj: "Prove OS engagement", kpi: "45%+ DAU" },
    { obj: "Prove geographic repeatability", kpi: "Miami + NYC consistency" },
  ];

  const phase2Scale = [
    "Whole Foods + Sprouts retail",
    "DTC scale + paid acquisition",
    "National media activation",
    "Ambassador & athlete network",
    "OS expansion (v2 personalization)",
    "Additional cities",
  ];

  const flywheel = ["Pause", "Hydrate", "Lock In", "Perform"];
  const flywheelDownstream = [
    "Repeat behavior",
    "Subscription",
    "OS data",
    "Better personalization",
    "Higher retention",
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 18% 32%, rgba(229,51,65,0.10) 0%, transparent 65%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 45% at 82% 70%, rgba(84,120,213,0.10) 0%, transparent 65%)" }}
      />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">15 — Go-To-Market</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">15 / 22</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.4vh]">
          <div className="h-[2px] w-[5vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.3vw] text-accent font-semibold">Sequencing</span>
        </div>
        <h2 className="font-display text-[3.8vw] leading-[0.95] tracking-tighter max-w-[78vw]">
          Build <span className="text-accent">proof of habit</span> before building scale.
        </h2>
      </div>

      <div className="absolute top-[30vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[3vw]">
        <div className="relative rounded-2xl ring-1 ring-primary/35 bg-bg-elev/40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.10] to-primary/0 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
          <div className="relative p-[1.6vw]">
            <div className="flex items-baseline justify-between mb-[1.2vh]">
              <div className="font-body uppercase tracking-[0.28em] text-[1vw] font-semibold text-primary">Phase 1 — Build Proof</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.78vw] text-text/45 font-semibold">Miami → NYC · Pre-TV</div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-x-[1.4vw] gap-y-[1vh] mb-[1.6vh]">
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/45 font-semibold">Objective</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.7vw] text-text/45 font-semibold text-right">KPI</div>
              {phase1Proof.map((row) => (
                <Fragment key={row.obj}>
                  <div className="font-body text-[1.05vw] text-text/85 leading-snug">{row.obj}</div>
                  <div className="font-body text-[1.05vw] text-text leading-snug text-right font-semibold">{row.kpi}</div>
                </Fragment>
              ))}
            </div>

            <div className="border-t border-primary/20 pt-[1.2vh]">
              <div className="font-display text-[1.4vw] leading-[1.2] tracking-tight">
                <span className="text-accent">The metrics become the product.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl ring-1 ring-blue/35 bg-bg-elev/40 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue/[0.10] to-blue/0 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-[3px] bg-blue" />
          <div className="relative p-[1.6vw]">
            <div className="flex items-baseline justify-between mb-[1.2vh]">
              <div className="font-body uppercase tracking-[0.28em] text-[1vw] font-semibold text-blue">Phase 2 — Build Scale</div>
              <div className="font-body uppercase tracking-[0.22em] text-[0.78vw] text-text/45 font-semibold">Unlocked by Phase 1</div>
            </div>

            <ul className="font-body text-[1.1vw] text-text/85 leading-[1.4] space-y-[0.9vh] mb-[1.6vh]">
              {phase2Scale.map((it) => (
                <li key={it} className="flex gap-[0.7vw]">
                  <span className="text-blue mt-[0.05vh] shrink-0 text-[1.2vw] leading-none">·</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-blue/20 pt-[1.2vh]">
              <div className="font-body text-[0.95vw] text-text/55 leading-snug">
                Scale becomes the <span className="text-text">result of proof</span> — not the starting point.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[12vh] left-[6vw] right-[6vw]">
        <div className="rounded-2xl ring-1 ring-accent/30 bg-bg-elev/40 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.06] via-transparent to-accent/[0.06] pointer-events-none" />
          <div className="relative p-[1.4vw]">
            <div className="flex items-center justify-between mb-[1.4vh]">
              <div className="flex items-center gap-[0.8vw]">
                <div className="h-px w-[2.5vw] bg-accent" />
                <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-accent font-semibold">The Ritual Flywheel</div>
              </div>
              <div className="font-body text-[0.85vw] text-text/45 italic">the GTM moat</div>
            </div>

            <div className="flex items-center justify-between gap-[0.6vw] mb-[1.2vh]">
              {flywheel.map((step, i) => (
                <Fragment key={step}>
                  <div className="flex-1 text-center px-[0.6vw] py-[0.8vh] ring-1 ring-accent/40 rounded-lg bg-accent/[0.06]">
                    <div className="font-display text-[1.15vw] tracking-tight text-text">{step}</div>
                  </div>
                  {i < flywheel.length - 1 && <div className="text-accent text-[1.1vw] font-light">→</div>}
                </Fragment>
              ))}
            </div>

            <div className="flex items-center justify-center gap-[0.7vw] flex-wrap">
              {flywheelDownstream.map((step, i) => (
                <Fragment key={step}>
                  <div className="font-body text-[0.95vw] text-text/75">{step}</div>
                  {i < flywheelDownstream.length - 1 && <div className="text-text/35 text-[0.95vw]">↓</div>}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw]">
        <div className="border-t border-text/10 pt-[1.6vh]">
          <div className="font-display text-[1.5vw] leading-[1.25] tracking-tight">
            <span className="text-accent">Ritual creates retention.</span>
            <span className="text-text/55"> Retention creates </span>
            <span className="text-text">enterprise value.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
