import SlideChrome from "@/components/SlideChrome";
import bgImg from "@assets/slide12_loopA_neural.png";
import type { ReactNode } from "react";

type Stage = {
  label: string;
  caption: string;
  Icon: () => ReactNode;
  accent?: boolean;
};

// Minimal line icons — 1px stroke, 24x24 viewBox, soft white.
const stroke = "currentColor";
const sw = 1;

function IconProduct() {
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
function IconReinforcement() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h6l2-5 2 10 2-5h4" />
    </svg>
  );
}
function IconAccountability() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 13 10 19 20 6" />
    </svg>
  );
}
function IconSubscription() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <polyline points="18 3 18 7 14 7" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <polyline points="6 21 6 17 10 17" />
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
function IconCommunity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="10" r="3" />
      <circle cx="16" cy="10" r="3" />
      <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M11 20c0-3 2.5-5 5-5s5 2 5 5" />
    </svg>
  );
}

const STAGES: Stage[] = [
  { label: "Product", caption: "Entry point", Icon: IconProduct },
  { label: "Ritual", caption: "Pause. Hydrate. Lock in.", Icon: IconRitual },
  { label: "Reinforcement", caption: "Contextual behavioral nudges", Icon: IconReinforcement, accent: true },
  { label: "Accountability", caption: "Daily readiness verdict", Icon: IconAccountability },
  { label: "Subscription", caption: "Commit to the standard", Icon: IconSubscription },
  { label: "Retention", caption: "Habit compounds", Icon: IconRetention },
  { label: "Community", caption: "Shared performance circle", Icon: IconCommunity },
];

function Connector({ active }: { active?: boolean }) {
  return (
    <div className="relative flex-1 flex items-center justify-center mx-[0.4vw]" aria-hidden="true">
      <div className="h-px w-full bg-text/[0.10]" />
      {active && (
        <div
          className="absolute h-1 w-1 rounded-full bg-[#E25C5C]"
          style={{ boxShadow: "0 0 10px rgba(226,92,92,0.55)" }}
        />
      )}
    </div>
  );
}

function StageNode({ index, stage }: { index: number; stage: Stage }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ width: "9.5vw" }}>
      <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/75 font-bold tabular-nums mb-[1.4vh]">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div
        className="relative flex items-center justify-center rounded-full border"
        style={{
          width: "5.6vw",
          height: "5.6vw",
          borderColor: stage.accent ? "rgba(226,92,92,0.45)" : "rgba(255,255,255,0.10)",
        }}
      >
        {stage.accent && (
          <div
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: "inset 0 0 30px rgba(226,92,92,0.10), 0 0 36px rgba(226,92,92,0.08)" }}
          />
        )}
        <div className="text-text/75" style={{ width: "1.9vw", height: "1.9vw" }}>
          <stage.Icon />
        </div>
      </div>
      <div className="mt-[2vh] font-display text-[1.15vw] text-text font-bold tracking-tight">{stage.label}</div>
      <div className="mt-[0.6vh] font-body text-[0.72vw] text-text/55 leading-snug max-w-[8.5vw]">{stage.caption}</div>
    </div>
  );
}

export default function PerformanceEcosystem() {
  return (
    <SlideChrome slide={12}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          opacity: 0.5,
          filter: "contrast(1.1) brightness(0.95)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[6vw] pt-[10vh] pb-[9vh]">
        {/* Header */}
        <div className="flex items-end justify-between gap-[3vw]">
          <div className="min-w-0">
            <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter">
              <span className="text-text">Every stage </span>
              <span className="text-text/45">earns the next.</span>
            </h2>
            <div className="mt-[1.6vh] font-body text-[0.95vw] text-text/55 max-w-[55vw] leading-[1.5]">
              A closed behavioral loop. <span className="text-text/85">Each surface compounds the one before it.</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/55 font-semibold">
              Seven stages · One ritual
            </div>
            <div className="font-body text-[0.7vw] text-text/35 mt-[0.6vh] italic">
              The OS is the connective tissue.
            </div>
          </div>
        </div>

        {/* Flow */}
        <div className="flex-1 flex items-center">
          <div className="w-full flex items-center justify-between">
            {STAGES.map((stage, i) => (
              <div key={stage.label} className="flex items-center" style={{ flex: i === 0 ? "0 0 auto" : "1 1 auto" }}>
                {i > 0 && <Connector active={STAGES[i - 1].accent || stage.accent} />}
                <StageNode index={i} stage={stage} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-text/[0.08] pt-[1.6vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[0.62vw] text-text/55 font-semibold">
            Product · Ritual · Reinforcement · Accountability · Subscription · Retention · Community
          </div>
          <div className="font-body text-[0.72vw] text-text/55 italic">
            The loop is the moat. <span className="text-text not-italic font-semibold">Performance compounds.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
