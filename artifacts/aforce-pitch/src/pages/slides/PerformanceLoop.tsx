import SlideChrome from "@/components/SlideChrome";
import type { ReactNode } from "react";

type Stage = {
  label: string;
  caption: string;
  Icon: () => ReactNode;
  accent?: boolean;
};

const stroke = "currentColor";
const sw = 1;

function IconDrink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="3" width="8" height="18" rx="1.5" />
      <line x1="8" y1="9" x2="16" y2="9" />
    </svg>
  );
}
function IconRitual() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
function IconReminder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconStreak() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="10" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="20" cy="12" r="1.2" />
    </svg>
  );
}
function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <polyline points="18 3 18 7 14 7" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <polyline points="6 21 6 17 10 17" />
    </svg>
  );
}
function IconSubscribe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 13 10 19 20 6" />
    </svg>
  );
}
function IconRetention() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 18 9 12 13 16 21 6" />
    </svg>
  );
}

const STAGES: Stage[] = [
  { label: "Drink", caption: "AForce, the entry point", Icon: IconDrink },
  { label: "Ritual", caption: "Pause. Hydrate. Lock in.", Icon: IconRitual },
  { label: "Check-in", caption: "Contextual reminder", Icon: IconReminder },
  { label: "Streak", caption: "Daily reinforcement", Icon: IconStreak, accent: true },
  { label: "Repeat", caption: "Behavior compounds", Icon: IconRepeat },
  { label: "Subscribe", caption: "Commit to the standard", Icon: IconSubscribe },
  { label: "Retain", caption: "Long-term performance", Icon: IconRetention },
];

// Geometry: 7 nodes on a circle, starting at the top, going clockwise.
const N = STAGES.length;
const START_DEG = -90; // top
const STEP_DEG = 360 / N;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

function LoopDiagram() {
  // Coordinate system: 1000x1000 SVG, used purely for geometry math; nodes
  // rendered as absolutely positioned divs in a square container so text
  // remains crisp in the deck's vw scale.
  const RING_R = 380; // radius of node centers (out of 500 half)
  const ARC_R = 380; // arc radius (matches node ring)
  const NODE_R = 96; // visual node radius

  const arcs = STAGES.map((_, i) => {
    const a1 = START_DEG + i * STEP_DEG;
    const a2 = START_DEG + (i + 1) * STEP_DEG;
    const gap = 6; // degrees of breathing room around node centers
    const p1 = polar(a1 + gap, ARC_R);
    const p2 = polar(a2 - gap, ARC_R);
    return {
      d: `M ${500 + p1.x} ${500 + p1.y} A ${ARC_R} ${ARC_R} 0 0 1 ${500 + p2.x} ${500 + p2.y}`,
      accent: STAGES[i].accent || STAGES[(i + 1) % N].accent,
    };
  });

  return (
    <div className="relative" style={{ width: "66vh", height: "66vh" }}>
      {/* Soft radial backlight */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0.04), transparent 65%)",
          filter: "blur(8px)",
        }}
        aria-hidden="true"
      />

      {/* Concentric guide rings (compounding cycles) */}
      <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="500" cy="500" r="220" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx="500" cy="500" r="300" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx="500" cy="500" r={ARC_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 6" />

        {/* Connector arcs between stages */}
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            fill="none"
            stroke={arc.accent ? "rgba(226,92,92,0.55)" : "rgba(255,255,255,0.12)"}
            strokeWidth="1"
            strokeLinecap="round"
          />
        ))}

        {/* Single red flow dot to imply motion direction (placed after the accent node) */}
        {(() => {
          const accentIdx = STAGES.findIndex((s) => s.accent);
          const a = START_DEG + (accentIdx + 0.5) * STEP_DEG;
          const p = polar(a, ARC_R);
          return (
            <circle
              cx={500 + p.x}
              cy={500 + p.y}
              r="6"
              fill="#E25C5C"
              style={{ filter: "drop-shadow(0 0 6px rgba(226,92,92,0.6))" }}
            />
          );
        })()}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/40 mb-[1vh]">The Loop</div>
        <div className="font-display text-[3.2vw] tracking-tighter text-text leading-none">Day 1</div>
        <div className="font-body text-[0.95vw] text-text/45 mt-[1vh] tabular-nums">→ Day 7 → Day 28 → Day 90</div>
      </div>

      {/* Nodes */}
      {STAGES.map((stage, i) => {
        const angle = START_DEG + i * STEP_DEG;
        const p = polar(angle, RING_R);
        const cx = 50 + (p.x / 10);
        const cy = 50 + (p.y / 10);
        return (
          <div
            key={stage.label}
            className="absolute flex flex-col items-center text-center"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              transform: "translate(-50%, -50%)",
              width: "9vw",
            }}
          >
            <div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: `${NODE_R}px`,
                height: `${NODE_R}px`,
                background: "rgba(0,0,0,0.85)",
                border: stage.accent
                  ? "1px solid rgba(226,92,92,0.5)"
                  : "1px solid rgba(255,255,255,0.10)",
                boxShadow: stage.accent
                  ? "0 0 30px rgba(226,92,92,0.10), inset 0 0 22px rgba(226,92,92,0.08)"
                  : "0 0 24px rgba(0,0,0,0.6)",
              }}
            >
              <div className="font-body uppercase tracking-[0.3em] text-[0.85vw] text-text/75 font-bold tabular-nums absolute -top-[2.6vh] left-1/2 -translate-x-1/2">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="text-text/80" style={{ width: "34px", height: "34px" }}>
                <stage.Icon />
              </div>
            </div>
            <div className="mt-[1.2vh] font-display text-[1.1vw] text-text font-bold tracking-tight whitespace-nowrap">{stage.label}</div>
            <div className="mt-[0.3vh] font-body text-[0.7vw] text-text/55 leading-tight">{stage.caption}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function PerformanceLoop() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[10vh] pb-[9vh]">
        {/* Header */}
        <div className="flex items-end justify-between gap-[3vw]">
          <div className="min-w-0">
            <h2 className="font-display text-[3.4vw] leading-[1] tracking-tighter">
              <span className="text-text">The loop is the moat.</span>
              <br />
              <span className="text-text/45">Every cycle compounds.</span>
            </h2>
          </div>
          <div className="text-right shrink-0">
            <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/55 font-semibold">
              One ritual · Repeated daily
            </div>
            <div className="font-body text-[0.7vw] text-text/35 mt-[0.6vh] italic">
              Behavior, not awareness, is the asset.
            </div>
          </div>
        </div>

        {/* Body: left rail copy + loop diagram */}
        <div className="flex-1 flex items-center justify-between gap-[4vw] mt-[2vh]">
          <div className="max-w-[24vw] flex flex-col gap-[2.5vh]">
            <div className="font-body text-[1vw] text-text/65 leading-[1.55] font-light">
              Performance is not built in the moment.
              <br />
              <span className="text-text/90">It is built in the ritual before it</span> — and reinforced
              in the one after.
            </div>
            <div className="border-t border-text/[0.08] pt-[2.5vh] flex flex-col gap-[1.4vh]">
              <Stat label="Repeat purchase" value="28–32%" />
              <Stat label="Subscription conversion" value="20%+" />
              <Stat label="Daily active ritual" value="73%" accent />
            </div>
            <div className="font-body text-[0.7vw] text-text/35 italic leading-snug">
              The loop strengthens with every revolution.
              <br />
              Each cycle deepens accountability, retention, and lifetime value.
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <LoopDiagram />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-text/[0.08] pt-[1.6vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[0.62vw] text-text/55 font-semibold">
            Drink · Ritual · Check-in · Streak · Repeat · Subscribe · Retain
          </div>
          <div className="font-body text-[0.72vw] text-text/55 italic">
            A recurring behavioral system. <span className="text-text not-italic font-semibold">Engineered to be inevitable.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-body uppercase tracking-[0.3em] text-[0.8vw] text-text/45">{label}</span>
      <span
        className={`font-display text-[2vw] tracking-tight tabular-nums ${
          accent ? "text-[#E25C5C]" : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
