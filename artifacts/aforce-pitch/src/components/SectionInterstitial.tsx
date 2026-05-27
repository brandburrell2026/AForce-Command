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
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(244,241,234,0.96)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative font-display italic font-light text-[#2d2a26]"
            style={{ fontSize: "2.4vw" }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
