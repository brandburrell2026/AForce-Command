import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SoundGate({ onUnlock }: { onUnlock: () => void }) {
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const dismiss = () => handleEnter();
    const onKey = (e: KeyboardEvent) => {
      if (e.key) dismiss();
    };
    const onPointer = () => dismiss();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("touchstart", onPointer, true);
    window.addEventListener("mousedown", onPointer, true);
    // Failsafe: never block the deck. Auto-dismiss after 2.5s even without input.
    const autoDismiss = window.setTimeout(() => dismiss(), 2500);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("touchstart", onPointer, true);
      window.removeEventListener("mousedown", onPointer, true);
      window.clearTimeout(autoDismiss);
    };
  }, []);

  const handleEnter = (e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (dismissing) return;
    setDismissing(true);
    onUnlock();
    window.setTimeout(() => setVisible(false), 900);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sound-gate"
          role="button"
          tabIndex={0}
          initial={{ opacity: 0 }}
          animate={{ opacity: dismissing ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={(e) => {
            handleEnter(e);
          }}
          className="fixed inset-0 z-[9999] flex cursor-pointer flex-col items-center justify-center bg-black"
          style={{
            background:
              "radial-gradient(ellipse at center, #0a0a0a 0%, #000 65%)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <div
              className="font-bold tracking-tight text-[#E25C5C]"
              style={{ fontSize: "3.6vw", lineHeight: 1 }}
            >
              AForce
              <sup
                className="text-white/40"
                style={{ fontSize: "1.1vw", marginLeft: "0.2vw" }}
              >
                ™
              </sup>
            </div>

            <div
              className="mt-[3vh] text-white/90"
              style={{
                fontSize: "1.05vw",
                letterSpacing: "0.4em",
                fontWeight: 300,
              }}
            >
              INVESTOR DECK
            </div>

            <div className="mt-[7vh] flex flex-col items-center">
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-full bg-[#E25C5C]"
                style={{
                  width: "0.5vw",
                  height: "0.5vw",
                  boxShadow: "0 0 20px rgba(226,92,92,0.6)",
                }}
              />
              <div
                className="mt-[2.2vh] text-white"
                style={{
                  fontSize: "0.95vw",
                  letterSpacing: "0.35em",
                  fontWeight: 400,
                }}
              >
                TAP TO BEGIN
              </div>
              <div
                className="mt-[1vh] text-white/35"
                style={{
                  fontSize: "0.7vw",
                  letterSpacing: "0.3em",
                  fontWeight: 300,
                }}
              >
                SOUND ON · USE ARROW KEYS TO NAVIGATE
              </div>
            </div>
          </motion.div>

          <div
            className="absolute bottom-[5vh] text-white/25"
            style={{
              fontSize: "0.62vw",
              letterSpacing: "0.35em",
              fontWeight: 300,
            }}
          >
            CONFIDENTIAL · FOR DISCUSSION PURPOSES ONLY
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
