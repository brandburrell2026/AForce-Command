import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function SoundGate({ onUnlock }: { onUnlock: () => void }) {
  const bypass =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("nogate") === "1";
  const [visible, setVisible] = useState(!bypass);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (bypass) {
      onUnlock();
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          className="fixed inset-0 z-[9999] cursor-pointer bg-bg"
        >
          <div className="absolute top-[4.5vh] left-[5vw] font-display font-extrabold tracking-tight text-red text-[1.4vw] leading-none">
            AForce
            <span className="text-[0.55em] align-super tracking-normal ml-[0.1em] font-medium">™</span>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-display uppercase text-text/45 font-semibold"
              style={{ fontSize: "0.7vw", letterSpacing: "0.32em" }}
            >
              Investor Deck · Phase 1
            </div>

            <div
              className="mt-[3vh] font-display font-black text-text tracking-[-0.04em]"
              style={{ fontSize: "5.6vw", lineHeight: 0.95 }}
            >
              <span className="text-red">Pause.</span>
            </div>

            <div
              className="mt-[6vh] font-display uppercase text-text font-semibold"
              style={{ fontSize: "0.72vw", letterSpacing: "0.32em" }}
            >
              Tap to begin
            </div>
            <div
              className="mt-[1.2vh] font-display uppercase text-text/40 font-medium"
              style={{ fontSize: "0.62vw", letterSpacing: "0.3em" }}
            >
              Sound on · Use arrow keys to navigate
            </div>
          </div>

          <div
            className="absolute bottom-[4vh] left-[5vw] right-[5vw] flex justify-between font-display uppercase text-text/35 font-medium"
            style={{ fontSize: "0.6vw", letterSpacing: "0.28em" }}
          >
            <span>Confidential · For discussion purposes only</span>
            <span className="text-red font-semibold">Patent-Protected</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
