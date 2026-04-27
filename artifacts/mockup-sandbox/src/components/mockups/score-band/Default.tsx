import { TrendingDown } from "lucide-react";

const COLORS = {
  bg: "#050510",
  card: "#0D0D20",
  cardEdge: "#13132B",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
  faint: "rgba(255,255,255,0.40)",
  border: "rgba(255,255,255,0.06)",
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

export function Default() {
  const score = 82;
  const decayPerMin = 0.42;
  const minutesToNextDown = Math.round((score - 75) / decayPerMin);
  const active = bandFor(score);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-8"
      style={{ background: COLORS.bg, fontFamily: "Inter, sans-serif" }}
    >
      <div
        className="w-[500px] rounded-2xl p-5 flex flex-col gap-4"
        style={{
          background: `linear-gradient(180deg, ${COLORS.card} 0%, ${COLORS.cardEdge} 100%)`,
          border: `1px solid ${COLORS.border}`,
          boxShadow: `0 0 60px ${active.color}1A, 0 8px 24px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Header row: eyebrow + state pill */}
        <div className="flex items-start justify-between">
          <div>
            <div
              className="font-bold mb-[4px]"
              style={{
                color: COLORS.faint,
                fontSize: 10,
                letterSpacing: 2.5,
              }}
            >
              HYDRATION SCORE
            </div>
            <div className="flex items-baseline gap-[10px]">
              <div
                className="font-bold leading-none"
                style={{
                  color: COLORS.text,
                  fontSize: 56,
                  letterSpacing: -1.5,
                  textShadow: `0 0 24px ${active.color}80`,
                }}
              >
                {score}
              </div>
              <div
                className="font-semibold"
                style={{ color: COLORS.faint, fontSize: 14 }}
              >
                / 100
              </div>
            </div>
          </div>

          {/* State pill */}
          <div
            className="rounded-full px-[14px] py-[7px] flex items-center gap-[8px]"
            style={{
              background: `${active.color}1A`,
              border: `1px solid ${active.color}66`,
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
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

        {/* Band track */}
        <div className="relative pt-[6px] pb-[18px]">
          {/* The 4-zone bar */}
          <div
            className="relative w-full overflow-hidden rounded-full flex"
            style={{ height: 10 }}
          >
            {BANDS.map((b) => {
              const widthPct = ((b.max - b.min + 1) / 101) * 100;
              const isActive = b.name === active.name;
              return (
                <div
                  key={b.name}
                  style={{
                    width: `${widthPct}%`,
                    background: isActive
                      ? `linear-gradient(180deg, ${b.color}FF 0%, ${b.color}CC 100%)`
                      : `${b.color}38`,
                    boxShadow: isActive
                      ? `0 0 18px ${b.color}99, inset 0 0 8px ${b.color}66`
                      : "none",
                    transition: "all 200ms ease",
                  }}
                />
              );
            })}
          </div>

          {/* Score marker (needle) */}
          <div
            className="absolute"
            style={{
              left: `${(score / 100) * 100}%`,
              top: 0,
              transform: "translateX(-50%)",
              height: 22,
            }}
          >
            <div
              style={{
                width: 2,
                height: 22,
                background: COLORS.text,
                boxShadow: `0 0 12px ${active.color}, 0 0 24px ${active.color}80`,
              }}
            />
            <div
              className="absolute"
              style={{
                left: "50%",
                top: -5,
                transform: "translateX(-50%)",
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: COLORS.text,
                boxShadow: `0 0 14px ${active.color}, 0 0 28px ${active.color}80`,
              }}
            />
          </div>

          {/* Boundary tick labels */}
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

        {/* Band legend (compact) */}
        <div className="flex items-center justify-between gap-[6px]">
          {BANDS.map((b) => {
            const isActive = b.name === active.name;
            return (
              <div
                key={b.name}
                className="flex items-center gap-[6px] flex-1"
                style={{ opacity: isActive ? 1 : 0.45 }}
              >
                <span
                  className="inline-block rounded-sm"
                  style={{
                    width: 8,
                    height: 8,
                    background: b.color,
                    boxShadow: isActive ? `0 0 8px ${b.color}` : "none",
                  }}
                />
                <div className="flex flex-col">
                  <span
                    className="font-bold"
                    style={{
                      color: isActive ? b.color : COLORS.muted,
                      fontSize: 9,
                      letterSpacing: 1.2,
                    }}
                  >
                    {b.name}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: COLORS.faint, fontSize: 9 }}
                  >
                    {b.min}–{b.max}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prediction strip */}
        <div
          className="rounded-xl px-[14px] py-[12px] flex items-center gap-[12px]"
          style={{
            background: `${COLORS.RECOVERING}10`,
            border: `1px solid ${COLORS.RECOVERING}3D`,
          }}
        >
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              background: `${COLORS.RECOVERING}22`,
            }}
          >
            <TrendingDown size={14} color={COLORS.RECOVERING} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bold mb-[2px]"
              style={{
                color: COLORS.RECOVERING,
                fontSize: 9,
                letterSpacing: 1.6,
              }}
            >
              PREDICTION
            </div>
            <div
              className="font-semibold"
              style={{ color: COLORS.text, fontSize: 13 }}
            >
              Drops to{" "}
              <span style={{ color: COLORS.RECOVERING }}>RECOVERING</span> in{" "}
              {minutesToNextDown}m
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-bold"
              style={{ color: COLORS.text, fontSize: 13 }}
            >
              {decayPerMin.toFixed(2)}
            </div>
            <div
              className="font-semibold"
              style={{
                color: COLORS.faint,
                fontSize: 8,
                letterSpacing: 1.2,
              }}
            >
              PTS / MIN
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
