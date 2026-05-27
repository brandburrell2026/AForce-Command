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
    const autoDismiss = window.setTimeout(() => dismiss(), 2200);
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
    window.setTimeout(() => setVisible(false), 700);
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
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          onClick={(e) => handleEnter(e)}
          className="fixed inset-0 z-[9999] cursor-pointer"
          style={{ background: "rgba(244,241,234,0.92)" }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 1.0, ease: [0.22, 0.61, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <div
                className="font-body uppercase text-[#2d2a26]/55 font-medium"
                style={{ fontSize: "0.7vw", letterSpacing: "0.32em" }}
              >
                AForce
                <sup className="ml-[0.2em] text-[0.55em] align-super tracking-normal">™</sup>
              </div>

              <div
                className="mt-[3vh] font-display italic font-light text-[#2d2a26]"
                style={{ fontSize: "2.8vw", lineHeight: 1 }}
              >
                Pause.
              </div>

              <div
                className="mt-[7vh] font-body uppercase text-[#2d2a26]/65 font-medium"
                style={{ fontSize: "0.75vw", letterSpacing: "0.32em" }}
              >
                Tap to begin
              </div>
              <div
                className="mt-[1.2vh] font-body uppercase text-[#2d2a26]/40 font-medium"
                style={{ fontSize: "0.62vw", letterSpacing: "0.3em" }}
              >
                Sound on · Use arrow keys to navigate
              </div>
            </motion.div>
          </div>

          <div
            className="absolute bottom-[4.5vh] left-0 right-0 text-center font-body uppercase text-[#2d2a26]/30 font-medium"
            style={{ fontSize: "0.6vw", letterSpacing: "0.32em" }}
          >
            Confidential · For discussion purposes only
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
