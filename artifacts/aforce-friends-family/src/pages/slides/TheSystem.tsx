import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// the system surfaces — product/acquisition first, retention after.
const FLOW: Array<{ t: string; k: string; blue?: boolean }> = [
  { t: "Hydration", k: "Product" },
  { t: "Daily Use", k: "Habit" },
  { t: "Ritual", k: "Behavior" },
  { t: "Subscription", k: "Revenue", blue: true },
  { t: "Community", k: "Moat", blue: true },
];

export default function TheSystem() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const phone = `${base}aforce-os-phone.png`;
  const phoneBack = `${base}recovery-coach-phone.png`;

  return (
    <SlideFrame slide={12}>
      <div className="absolute inset-0 overflow-hidden">
        {/* right — the AForce OS, two screens floating */}
        <div className="absolute right-0 top-0 bottom-0 w-[50%] z-10 flex items-center justify-center">
          {/* soft glow behind the devices */}
          <motion.div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: "50%",
              left: "50%",
              width: "66vh",
              height: "66vh",
              transform: "translate(-50%,-52%)",
              background:
                "radial-gradient(closest-side, rgba(26,24,21,0.10), rgba(255,255,255,0.6) 42%, rgba(244,241,234,0) 72%)",
            }}
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: [0.85, 1, 0.85] }}
            transition={
              reduce
                ? undefined
                : { opacity: { duration: 7, repeat: Infinity, ease: "easeInOut" } }
            }
          />

          {/* contact shadow */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              bottom: "6.5vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: "42vh",
              height: "6vh",
              background:
                "radial-gradient(closest-side, rgba(0,0,0,0.22), rgba(0,0,0,0) 72%)",
              filter: "blur(10px)",
            }}
          />

          {/* the two devices, staggered for depth */}
          <div className="relative" style={{ width: "78vh", height: "84vh" }}>
            {/* back device — Recovery Coach */}
            <div
              className="absolute left-1/2 top-1/2"
              style={{ transform: "translate(-50%, -50%) translate(-15vh, -3vh)" }}
            >
              <motion.img
                src={phoneBack}
                alt="AForce OS — Recovery Coach issuing the HYDRATE NOW command"
                className="w-auto object-contain"
                style={{
                  height: "70vh",
                  filter: "drop-shadow(0 26px 44px rgba(0,0,0,0.22))",
                }}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.15 }}
              />
            </div>

            {/* front device — the AI Coach */}
            <div
              className="absolute left-1/2 top-1/2 z-10"
              style={{ transform: "translate(-50%, -50%) translate(15vh, 3vh)" }}
            >
              <motion.img
                src={phone}
                alt="AForce OS — the AI Coach running on mobile"
                className="w-auto object-contain"
                style={{
                  height: "80vh",
                  filter: "drop-shadow(0 32px 54px rgba(0,0,0,0.30))",
                }}
                initial={reduce ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.3 }}
              />
            </div>
          </div>
        </div>

        {/* left — the message + the loop */}
        <div className="absolute inset-y-0 left-0 w-[52%] flex flex-col justify-center px-[5vw] z-20">
          <motion.div
            className="mb-[3.5vh] flex items-center gap-[1vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="h-[2px] w-[3vw] bg-red" />
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-red font-semibold">
              The System
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[4.6vw] leading-[1.0] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.1 }}
          >
            The system.
          </motion.h1>

          <motion.p
            className="mt-[2.4vh] max-w-[40vw] font-body text-[1.25vw] leading-[1.5] text-text/75"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.22 }}
          >
            Products create <span className="text-red font-medium">acquisition.</span> The OS
            powers and measures <span className="text-blue font-medium">retention</span> — culture,
            community, and membership.
          </motion.p>

          {/* the two territories — acquisition vs. controlled focus */}
          <motion.div
            className="mt-[2.8vh] grid grid-cols-2 gap-[1.6vw] max-w-[40vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 }}
          >
            <div className="border-l-2 border-red pl-[1vw]">
              <div className="font-display uppercase tracking-[0.2em] text-[0.6vw] text-red font-semibold">
                Territory 01 · Acquisition
              </div>
              <div className="mt-[0.6vh] font-body text-[0.82vw] leading-[1.4] text-text/65">
                Performance is universal.
              </div>
            </div>
            <div className="border-l-2 border-blue pl-[1vw]">
              <div className="font-display uppercase tracking-[0.2em] text-[0.6vw] text-blue font-semibold">
                Territory 02 · Retention
              </div>
              <div className="mt-[0.6vh] font-body text-[0.82vw] leading-[1.4] text-text/65">
                Controlled focus before execution — culture, community, membership.
              </div>
            </div>
          </motion.div>

          {/* the system as five surfaces — clean grid, no bullets */}
          <div className="mt-[3vh] grid grid-cols-3 gap-[0.7vw] max-w-[40vw]">
            {FLOW.map((n, i) => (
              <motion.div
                key={n.t}
                className="rounded-[4px] border border-text/10 bg-bg-elev px-[1.1vw] py-[1.5vh]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? undefined
                    : { duration: 0.4, ease: EASE, delay: 0.18 + i * 0.05 }
                }
              >
                <div className="font-display font-semibold tracking-[-0.01em] text-[1.3vw] leading-[1.05] text-text">
                  {n.t}
                </div>
                <div
                  className={`mt-[0.6vh] font-display uppercase tracking-[0.24em] text-[0.6vw] font-semibold ${
                    n.blue ? "text-blue" : "text-text/40"
                  }`}
                >
                  {n.k}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
