import { useId, useMemo } from "react";
import { motion } from "framer-motion";

const BG = "#000000";
const LIME = "#B6FF00";
const LIME_DIM = "rgba(182,255,0,0.45)";
const CORAL = "#E8613A";
const WHITE = "#F5F5F5";
const MUTED = "#6B6B6B";
const MUTED_WHITE = "rgba(245,245,245,0.55)";

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const WAVE_W = 440;
const WAVE_H = 160;
const WAVELENGTH = 110;

function useWavePath() {
  return useMemo(() => {
    const amplitude = 14;
    const mid = WAVE_H / 2;
    const pts: string[] = [];
    for (let x = 0; x <= WAVE_W; x += 4) {
      const y = mid + amplitude * Math.sin((2 * Math.PI * x) / WAVELENGTH);
      pts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }, []);
}

function Waveform() {
  const d = useWavePath();
  const gradId = useId();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "50%",
      }}
    >
      <motion.svg
        width={220}
        height={80}
        viewBox={`0 0 ${WAVE_W / 2} ${WAVE_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          overflow: "visible",
          filter: "drop-shadow(0 0 5px rgba(182,255,0,0.6))",
        }}
        animate={{ scaleY: [1, 1.18, 1] }}
        transition={{ duration: 6, ease: "easeInOut" as const, repeat: Infinity }}
      >
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={WAVE_W / 2}
            y2="0"
          >
            <stop offset="0%" stopColor={LIME} stopOpacity="0" />
            <stop offset="22%" stopColor={LIME} stopOpacity="1" />
            <stop offset="50%" stopColor={LIME} stopOpacity="1" />
            <stop offset="78%" stopColor={LIME} stopOpacity="1" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ x: [0, -WAVELENGTH] }}
          transition={{ duration: 7, ease: "linear" as const, repeat: Infinity }}
        />
      </motion.svg>
    </div>
  );
}

function Visualization() {
  const sonar = [300, 252, 204];
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Static concentric sonar rings */}
      {sonar.map((size, i) => (
        <div
          key={size}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: `1px solid rgba(182,255,0,${0.06 + i * 0.05})`,
          }}
        />
      ))}

      {/* Radiating sonar pulse */}
      <motion.div
        style={{
          position: "absolute",
          width: 204,
          height: 204,
          borderRadius: "50%",
          border: `1px solid ${LIME}`,
        }}
        animate={{ scale: [1, 1.42], opacity: [0.35, 0] }}
        transition={{ duration: 4, ease: "easeOut" as const, repeat: Infinity }}
      />

      {/* Inner circle — dark fill */}
      <div
        style={{
          position: "relative",
          width: 204,
          height: 204,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, #0a0a0a 0%, #000000 72%)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Coral breathing ring around the inner circle edge */}
        <motion.div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: "50%",
            border: `1.5px solid ${CORAL}`,
          }}
          animate={{
            opacity: [0.4, 0.95, 0.4],
            boxShadow: [
              `0 0 6px rgba(232,97,58,0.15)`,
              `0 0 22px rgba(232,97,58,0.55)`,
              `0 0 6px rgba(232,97,58,0.15)`,
            ],
          }}
          transition={{ duration: 4, ease: "easeInOut" as const, repeat: Infinity }}
        />

        <Waveform />
      </div>
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: "easeOut" as const } },
};

export function BeginProtocol() {
  const protocol: { word: string; accent: boolean }[] = [
    { word: "Pause", accent: false },
    { word: "Hydrate", accent: true },
    { word: "Lock In", accent: true },
    { word: "Perform", accent: false },
  ];
  const wordsStart = 1.7;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: BG,
        fontFamily: FONT,
        display: "flex",
        justifyContent: "center",
        color: WHITE,
      }}
    >
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.3, delayChildren: 0.15 } },
        }}
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100vh",
          padding: "56px 28px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        {/* Logo lockup */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: WHITE,
              lineHeight: 1,
            }}
          >
            AFORCE
          </div>
          <div
            style={{
              border: `1px solid ${LIME_DIM}`,
              borderRadius: 6,
              padding: "3px 12px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.5em",
              color: LIME,
              textIndent: "0.5em",
            }}
          >
            OS
          </div>
        </motion.div>

        {/* Sync label + visualization */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.42em",
              color: LIME,
              textIndent: "0.42em",
            }}
          >
            PERFORMANCE SYNC ACTIVE
          </div>
          <Visualization />
        </motion.div>

        {/* Protocol-ready + headline + sequence */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: MUTED,
            }}
          >
            Today's protocol is ready.
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: WHITE,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            Performance is non-negotiable.
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            {protocol.map((p, i) => (
              <span
                key={p.word}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.7,
                    ease: "easeOut" as const,
                    delay: wordsStart + i * 0.4,
                  }}
                  style={{ color: p.accent ? LIME : MUTED_WHITE }}
                >
                  {p.word}
                </motion.span>
                {i < protocol.length - 1 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.6,
                      delay: wordsStart + i * 0.4 + 0.2,
                    }}
                    style={{ color: MUTED, fontSize: 12 }}
                  >
                    →
                  </motion.span>
                )}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Begin Protocol button */}
        <motion.button
          variants={fadeUp}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "tween", duration: 0.12, ease: "easeOut" as const }}
          style={{
            width: "100%",
            padding: "18px 0",
            background: "rgba(182,255,0,0.03)",
            border: `1px solid ${LIME_DIM}`,
            borderRadius: 14,
            color: LIME,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.32em",
            textIndent: "0.32em",
            fontFamily: FONT,
            cursor: "pointer",
          }}
        >
          BEGIN PROTOCOL
        </motion.button>
      </motion.div>
    </div>
  );
}
