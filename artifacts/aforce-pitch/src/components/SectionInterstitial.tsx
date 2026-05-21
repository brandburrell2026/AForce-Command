import { AnimatePresence, motion } from "framer-motion";

interface Props {
  label: string | null;
  token: number;
}

export default function SectionInterstitial({ label, token }: Props) {
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          key={token}
          className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, letterSpacing: "0.4em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.6em" }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="relative font-body uppercase text-[1.1vw] font-semibold text-white/70"
            style={{ letterSpacing: "0.5em" }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
