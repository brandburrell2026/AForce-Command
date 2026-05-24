import { motion } from "framer-motion";

/**
 * Ultra-restrained ambient motion layer. Sits behind content, opacity capped
 * under 15%, slow movement only (8-14s cycles), 24fps cinematic feel.
 *
 * Variants:
 *  - `concentric-rings`  — slowly rotating rings + faint red pulse (loop/system slides)
 *  - `heartbeat-pulse`   — soft red breathing + ECG drift (emotional pressure slides)
 *  - `device-glow`       — low ambient red reflection (OS / device slides)
 *  - `expanding-grid`    — slow grid expansion + horizon glow (final / scale slides)
 *
 * All layers are pointer-events:none and absolutely positioned to inset-0.
 */
export default function CinematicMotion({
  variant,
  className = "",
}: {
  variant:
    | "concentric-rings"
    | "heartbeat-pulse"
    | "device-glow"
    | "expanding-grid";
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {variant === "concentric-rings" && <ConcentricRings />}
      {variant === "heartbeat-pulse" && <HeartbeatPulse />}
      {variant === "device-glow" && <DeviceGlow />}
      {variant === "expanding-grid" && <ExpandingGrid />}
    </div>
  );
}

/* ---------- concentric rings ---------- */
function ConcentricRings() {
  const RINGS = [42, 56, 70, 84]; // vw
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* faint red pulse halo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "48vw",
          height: "48vw",
          background:
            "radial-gradient(circle, rgba(226,92,92,0.18) 0%, transparent 62%)",
          filter: "blur(8vw)",
        }}
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.04, 1] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {RINGS.map((size, i) => (
        <motion.div
          key={size}
          className="absolute rounded-full border border-text/[0.06]"
          style={{ width: `${size}vw`, height: `${size}vw` }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{
            duration: 80 + i * 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
      {/* slow traveling spark on the inner ring */}
      <motion.div
        className="absolute"
        style={{ width: "42vw", height: "42vw" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[0.4vw] h-[0.4vw] rounded-full"
          style={{
            background: "rgba(226,92,92,0.85)",
            boxShadow: "0 0 1.2vw 0.3vw rgba(226,92,92,0.45)",
          }}
        />
      </motion.div>
    </div>
  );
}

/* ---------- heartbeat pulse ---------- */
function HeartbeatPulse() {
  return (
    <>
      {/* slow red breathing ambient */}
      <motion.div
        className="absolute"
        style={{
          right: "-15vw",
          top: "20vh",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(226,92,92,0.16) 0%, transparent 65%)",
          filter: "blur(10vw)",
        }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* ECG waveform drift, bottom edge */}
      <svg
        className="absolute bottom-[14vh] left-0 w-full opacity-[0.09]"
        height="80"
        viewBox="0 0 1600 80"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M0 40 L380 40 L420 40 L440 12 L460 68 L480 22 L500 40 L820 40 L860 40 L880 12 L900 68 L920 22 L940 40 L1260 40 L1300 40 L1320 12 L1340 68 L1360 22 L1380 40 L1600 40"
          fill="none"
          stroke="#E25C5C"
          strokeWidth="1.2"
          animate={{ x: [0, -460] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </>
  );
}

/* ---------- device glow ---------- */
function DeviceGlow() {
  return (
    <>
      {/* low ambient red reflection — bottom center, under devices */}
      <motion.div
        className="absolute"
        style={{
          left: "50%",
          bottom: "-12vh",
          transform: "translateX(-50%)",
          width: "70vw",
          height: "40vh",
          background:
            "radial-gradient(ellipse at center, rgba(226,92,92,0.14) 0%, transparent 70%)",
          filter: "blur(6vw)",
        }}
        animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* very faint top-center cool ambient for contrast */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "-10vh",
          transform: "translateX(-50%)",
          width: "60vw",
          height: "30vh",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)",
          filter: "blur(5vw)",
        }}
      />
    </>
  );
}

/* ---------- expanding grid + horizon ---------- */
function ExpandingGrid() {
  return (
    <>
      {/* horizon red glow, bottom */}
      <motion.div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          bottom: "-20vh",
          height: "55vh",
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(226,92,92,0.18) 0%, transparent 65%)",
          filter: "blur(6vw)",
        }}
        animate={{ opacity: [0.6, 0.95, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* slow expanding grid */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "6vw 6vw",
          maskImage:
            "radial-gradient(ellipse at 50% 70%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 70%, #000 30%, transparent 75%)",
          opacity: 0.12,
        }}
        animate={{ backgroundSize: ["6vw 6vw", "6.6vw 6.6vw", "6vw 6vw"] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* orbital activation points */}
      {[
        { x: "22%", y: "62%", d: 0 },
        { x: "78%", y: "58%", d: 1.8 },
        { x: "46%", y: "78%", d: 3.4 },
        { x: "62%", y: "44%", d: 5.1 },
      ].map((p) => (
        <motion.div
          key={`${p.x}-${p.y}`}
          className="absolute w-[0.35vw] h-[0.35vw] rounded-full"
          style={{
            left: p.x,
            top: p.y,
            background: "rgba(226,92,92,0.75)",
            boxShadow: "0 0 1vw 0.25vw rgba(226,92,92,0.35)",
          }}
          animate={{ opacity: [0.15, 0.7, 0.15] }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.d,
          }}
        />
      ))}
    </>
  );
}
