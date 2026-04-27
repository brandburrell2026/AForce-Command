const COLORS = {
  bg: "#050510",
  card: "#0D0D20",
  cardEdge: "#13132B",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.40)",
  hairline: "rgba(255,255,255,0.08)",
  PEAK: "#B4FF50",
  BALANCED: "#00E5C8",
  RECOVERING: "#FFA01E",
  DEPLETED: "#FF2D55",
};

const BANDS = [
  { name: "DEPLETED", min: 0, max: 59, color: COLORS.DEPLETED },
  { name: "RECOVERING", min: 60, max: 74, color: COLORS.RECOVERING },
  { name: "BALANCED", min: 75, max: 89, color: COLORS.BALANCED },
  { name: "PEAK", min: 90, max: 100, color: COLORS.PEAK },
] as const;

function bandFor(score: number) {
  return BANDS.find((b) => score >= b.min && score <= b.max) ?? BANDS[0];
}

export function Hero() {
  const score = 82;
  const decayPerMin = 0.42;
  const minutesToNextDown = Math.round((score - 75) / decayPerMin);
  const active = bandFor(score);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-8"
      style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}
    >
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.015); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 18px var(--c)) drop-shadow(0 0 36px color-mix(in srgb, var(--c) 60%, transparent)); }
          50%      { filter: drop-shadow(0 0 26px var(--c)) drop-shadow(0 0 56px color-mix(in srgb, var(--c) 70%, transparent)); }
        }
      `}</style>

      <div
        className="w-[520px] rounded-[20px] p-6 flex flex-col gap-5 relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${COLORS.card} 0%, ${COLORS.cardEdge} 100%)`,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: `0 0 80px ${active.color}24, 0 12px 40px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Soft band-tinted backdrop */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: -120,
            right: -120,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${active.color}26 0%, transparent 70%)`,
            filter: "blur(20px)",
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between relative">
          <div
            className="font-bold"
            style={{ color: COLORS.faint, fontSize: 10, letterSpacing: 2.8 }}
          >
            PERFORMANCE STATE
          </div>
          <div
            className="rounded-full px-[14px] py-[7px] flex items-center gap-[8px]"
            style={{
              background: `${active.color}1F`,
              border: `1px solid ${active.color}80`,
              boxShadow: `0 0 16px ${active.color}40`,
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 7,
                height: 7,
                background: active.color,
                boxShadow: `0 0 10px ${active.color}`,
              }}
            />
            <span
              className="font-bold"
              style={{
                color: active.color,
                fontSize: 11,
                letterSpacing: 1.8,
              }}
            >
              {active.name}
            </span>
          </div>
        </div>

        {/* Hero score */}
        <div
          className="flex flex-col items-center justify-center relative py-2"
          style={{ ["--c" as string]: active.color }}
        >
          <div
            className="font-bold leading-none"
            style={{
              color: COLORS.text,
              fontSize: 112,
              letterSpacing: -4,
              animation: "glowPulse 4s ease-in-out infinite",
            }}
          >
            {score}
          </div>
          <div
            className="font-semibold mt-[6px]"
            style={{
              color: active.color,
              fontSize: 11,
              letterSpacing: 2.4,
            }}
          >
            {active.min}–{active.max} · {active.name}
          </div>
        </div>

        {/* Band track with floating marker */}
        <div className="relative pt-[18px] pb-[6px]">
          {/* Floating marker pill above the bar */}
          <div
            className="absolute"
            style={{
              left: `${(score / 100) * 100}%`,
              top: -2,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="font-bold rounded-md px-[8px] py-[3px]"
              style={{
                color: COLORS.bg,
                background: active.color,
                fontSize: 10,
                letterSpacing: 0.5,
                boxShadow: `0 0 14px ${active.color}99`,
              }}
            >
              {score}
            </div>
            <div
              aria-hidden
              style={{
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: `6px solid ${active.color}`,
                margin: "0 auto",
                filter: `drop-shadow(0 0 6px ${active.color})`,
              }}
            />
          </div>

          {/* The 4-zone band */}
          <div
            className="relative w-full overflow-hidden flex"
            style={{
              height: 14,
              borderRadius: 10,
              border: `1px solid ${COLORS.hairline}`,
            }}
          >
            {BANDS.map((b) => {
              const widthPct = ((b.max - b.min + 1) / 101) * 100;
              const isActive = b.name === active.name;
              return (
                <div
                  key={b.name}
                  className="relative"
                  style={{
                    width: `${widthPct}%`,
                    background: isActive
                      ? `linear-gradient(180deg, ${b.color} 0%, ${b.color}D9 100%)`
                      : `${b.color}33`,
                    boxShadow: isActive
                      ? `inset 0 0 12px ${b.color}AA, 0 0 24px ${b.color}66`
                      : "none",
                  }}
                >
                  {isActive && (
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(180deg, ${b.color}66 0%, transparent 100%)`,
                        animation: "breathe 2.4s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tick labels */}
          <div className="relative w-full mt-[10px]" style={{ height: 12 }}>
            {[0, 60, 75, 90, 100].map((n) => (
              <div
                key={n}
                className="absolute font-semibold"
                style={{
                  left: `${n}%`,
                  transform:
                    n === 0
                      ? "translateX(0)"
                      : n === 100
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                  color: COLORS.faint,
                  fontSize: 9,
                  letterSpacing: 0.5,
                }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* Footer: prediction + decay */}
        <div
          className="flex items-center justify-between gap-3 pt-3"
          style={{ borderTop: `1px solid ${COLORS.hairline}` }}
        >
          <div className="flex items-center gap-[10px]">
            <span
              className="inline-block rounded-full"
              style={{
                width: 6,
                height: 6,
                background: COLORS.RECOVERING,
                boxShadow: `0 0 8px ${COLORS.RECOVERING}`,
              }}
            />
            <div className="flex flex-col">
              <span
                className="font-bold"
                style={{
                  color: COLORS.faint,
                  fontSize: 9,
                  letterSpacing: 1.6,
                }}
              >
                NEXT BAND
              </span>
              <span
                className="font-semibold"
                style={{ color: COLORS.text, fontSize: 13 }}
              >
                <span style={{ color: COLORS.RECOVERING }}>RECOVERING</span> in{" "}
                {minutesToNextDown}m
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span
              className="font-bold"
              style={{
                color: COLORS.faint,
                fontSize: 9,
                letterSpacing: 1.6,
              }}
            >
              DECAY
            </span>
            <span
              className="font-semibold"
              style={{ color: COLORS.text, fontSize: 13 }}
            >
              {decayPerMin.toFixed(2)}{" "}
              <span style={{ color: COLORS.faint, fontSize: 11 }}>pts/min</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
