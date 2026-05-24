import { motion } from "framer-motion";
import SlideChrome from "@/components/SlideChrome";

type Stage = {
  n: string;
  label: string;
  accent?: boolean;
};

const STAGES: Stage[] = [
  { n: "01", label: "Behavior" },
  { n: "02", label: "Accountability" },
  { n: "03", label: "Ritual" },
  { n: "04", label: "Subscription", accent: true },
  { n: "05", label: "Community" },
  { n: "06", label: "Retention" },
];

const CENTER = 50;
const RADIUS = 30;
const LABEL_RADIUS = 41.5;
const NUMBER_RADIUS = 36;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // -90 so 0deg = top
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

function arcPath(fromDeg: number, toDeg: number, r: number) {
  const a = polar(r, fromDeg);
  const b = polar(r, toDeg);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}

// Arrowhead at the end of arc, pointing tangent (clockwise).
function arrowAt(deg: number, r: number) {
  const p = polar(r, deg);
  // Tangent direction (clockwise) = angle + 90°
  const tangentDeg = deg;
  const rad = ((tangentDeg) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const size = 1.0;
  // Triangle pointing along (dx, dy)
  const tip = { x: p.x + dx * size * 0.6, y: p.y + dy * size * 0.6 };
  const baseL = {
    x: p.x - dx * size * 0.4 - dy * size * 0.5,
    y: p.y - dy * size * 0.4 + dx * size * 0.5,
  };
  const baseR = {
    x: p.x - dx * size * 0.4 + dy * size * 0.5,
    y: p.y - dy * size * 0.4 - dx * size * 0.5,
  };
  return `${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`;
}

export default function RetentionIsProduct() {
  const step = 360 / STAGES.length;
  return (
    <SlideChrome slide={25}>
      <div className="absolute inset-0 grid grid-cols-12 px-[8vw] pt-[12vh] pb-[10vh] gap-[3vw]">
        {/* LEFT RAIL */}
        <div className="col-span-5 flex flex-col">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
            Retention Is the Product
          </div>

          <div className="mt-[2vh] flex flex-col gap-[0.4vh]">
            <div className="font-display text-[2.4vw] leading-[1.05] tracking-tight text-text/35">
              Not the ingredients.
            </div>
            <div className="font-display text-[2.4vw] leading-[1.05] tracking-tight text-text/35">
              Not the can.
            </div>
            <div className="font-display text-[2.4vw] leading-[1.05] tracking-tight text-text/35">
              Not the app.
            </div>
            <div className="font-display text-[4.4vw] leading-[1] tracking-tighter text-primary mt-[1vh]">
              The behavior.
            </div>
          </div>

          <div className="font-body text-[0.9vw] leading-[1.55] text-text/65 mt-[3vh] max-w-[26vw]">
            The OS transforms hydration from consumption into{" "}
            <span className="text-text/95">accountability.</span> Every cycle reinforces
            the next. Behavior compounds.
          </div>

          <div className="mt-auto pt-[3vh] flex items-baseline gap-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/35 font-semibold">
              The Retention Flywheel
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.62vw] text-text/30 font-semibold">
              06 stages · compounding
            </div>
          </div>
        </div>

        {/* RIGHT — FLYWHEEL */}
        <div className="col-span-7 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full max-h-[72vh]"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Retention flywheel: Behavior, Accountability, Ritual, Subscription, Community, Retention"
            >
              <defs>
                <radialGradient id="center-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="var(--slide-primary)" stopOpacity="0.18" />
                  <stop offset="60%" stopColor="var(--slide-primary)" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="var(--slide-primary)" stopOpacity="0" />
                </radialGradient>
                <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.4" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Faint outer concentric rings — compounding cycles */}
              {[RADIUS + 5, RADIUS + 8.5, RADIUS + 12].map((r, i) => (
                <circle
                  key={r}
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.08"
                  strokeDasharray="0.6 1.2"
                  className="text-text/20"
                  style={{ opacity: 0.5 - i * 0.12 }}
                />
              ))}

              {/* Center glow */}
              <circle cx={CENTER} cy={CENTER} r="18" fill="url(#center-glow)" />

              {/* Main flywheel ring — base */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.12"
                className="text-text/15"
              />

              {/* Six arc segments connecting stages, each with arrowhead */}
              {STAGES.map((stage, i) => {
                const from = i * step + 4; // small gap after node
                const to = (i + 1) * step - 4; // gap before next node
                const isAccentLead = STAGES[(i + 1) % STAGES.length].accent;
                return (
                  <g key={stage.label}>
                    <motion.path
                      d={arcPath(from, to, RADIUS)}
                      fill="none"
                      stroke={isAccentLead ? "var(--slide-primary)" : "currentColor"}
                      strokeWidth={isAccentLead ? 0.5 : 0.4}
                      strokeLinecap="round"
                      className={isAccentLead ? "" : "text-text/55"}
                      filter={isAccentLead ? "url(#soft-glow)" : undefined}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{
                        duration: 0.8,
                        delay: 0.4 + i * 0.12,
                        ease: [0.22, 0.61, 0.36, 1],
                      }}
                    />
                    <polygon
                      points={arrowAt(to, RADIUS)}
                      fill={isAccentLead ? "var(--slide-primary)" : "currentColor"}
                      className={isAccentLead ? "" : "text-text/65"}
                    />
                  </g>
                );
              })}

              {/* Stage nodes */}
              {STAGES.map((stage, i) => {
                const deg = i * step;
                const p = polar(RADIUS, deg);
                const accent = !!stage.accent;
                return (
                  <g key={stage.label}>
                    {accent && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="2.6"
                        fill="var(--slide-primary)"
                        opacity="0.18"
                        filter="url(#soft-glow)"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={accent ? 1.05 : 0.85}
                      fill={accent ? "var(--slide-primary)" : "var(--slide-bg)"}
                      stroke={accent ? "var(--slide-primary)" : "currentColor"}
                      strokeWidth="0.25"
                      className={accent ? "" : "text-text/90"}
                    />
                  </g>
                );
              })}

              {/* Stage labels & numbers */}
              {STAGES.map((stage, i) => {
                const deg = i * step;
                const labelP = polar(LABEL_RADIUS, deg);
                const numP = polar(NUMBER_RADIUS, deg);
                // Decide anchor based on horizontal position
                const dx = labelP.x - CENTER;
                let anchor: "start" | "middle" | "end" = "middle";
                if (dx > 4) anchor = "start";
                else if (dx < -4) anchor = "end";

                // Vertical offset depending on top vs bottom
                const dy = labelP.y - CENTER;
                const yOffset = dy < -4 ? -0.6 : dy > 4 ? 2.4 : 1;
                const numYOffset = dy < -4 ? -3.6 : dy > 4 ? -0.6 : -1.8;

                return (
                  <g key={`label-${stage.label}`}>
                    <text
                      x={numP.x}
                      y={numP.y + numYOffset}
                      fill="currentColor"
                      fontSize="1.3"
                      fontFamily="Manrope, sans-serif"
                      fontWeight="600"
                      letterSpacing="0.55"
                      textAnchor={anchor}
                      className="text-text/35"
                      style={{ textTransform: "uppercase" }}
                    >
                      {stage.n}
                    </text>
                    <text
                      x={labelP.x}
                      y={labelP.y + yOffset}
                      fill={stage.accent ? "var(--slide-primary)" : "currentColor"}
                      fontSize="2.6"
                      fontFamily="Archivo Black, Manrope, sans-serif"
                      fontWeight="900"
                      letterSpacing="-0.05"
                      textAnchor={anchor}
                      className={stage.accent ? "" : "text-text"}
                    >
                      {stage.label}
                    </text>
                  </g>
                );
              })}

              {/* Center mark */}
              <text
                x={CENTER}
                y={CENTER - 2.5}
                fill="currentColor"
                fontSize="1.4"
                fontFamily="Manrope, sans-serif"
                fontWeight="700"
                letterSpacing="0.65"
                textAnchor="middle"
                className="text-text/55"
                style={{ textTransform: "uppercase" }}
              >
                Behavior Compounds
              </text>
              <line
                x1={CENTER - 6}
                y1={CENTER - 0.5}
                x2={CENTER + 6}
                y2={CENTER - 0.5}
                stroke="var(--slide-primary)"
                strokeWidth="0.18"
                strokeLinecap="round"
              />
              <text
                x={CENTER}
                y={CENTER + 2.4}
                fill="currentColor"
                fontSize="1.05"
                fontFamily="Manrope, sans-serif"
                fontWeight="600"
                letterSpacing="0.5"
                textAnchor="middle"
                className="text-text/40"
                style={{ textTransform: "uppercase" }}
              >
                Day 1 · Day 7 · Day 28 · Day 90
              </text>
            </svg>
          </div>

          {/* Map footer */}
          <div className="absolute bottom-0 left-0 right-0 flex items-baseline justify-between gap-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.62vw] text-text/30 font-semibold">
              Compounding system · self-reinforcing
            </div>
            <div className="font-display text-[1.1vw] leading-[1.2] tracking-tight text-text/75 text-right max-w-[26vw]">
              Every cycle deepens the next.{" "}
              <span className="text-primary">The loop is the moat.</span>
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
