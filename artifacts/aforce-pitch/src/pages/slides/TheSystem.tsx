import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// product/acquisition stages (red) flow into OS/retention stages (blue).
const FLOW: Array<{ t: string; k: string; c: "red" | "blue" }> = [
  { t: "Hydration", k: "Product", c: "red" },
  { t: "Daily Use", k: "Habit", c: "red" },
  { t: "Tracking", k: "OS", c: "blue" },
  { t: "Ritual", k: "Behavior", c: "blue" },
  { t: "Subscription", k: "Revenue", c: "blue" },
  { t: "Community", k: "Moat", c: "blue" },
];

export default function TheSystem() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const phone = `${base}aforce-os-phone.png`;
  const phoneBack = `${base}recovery-coach-phone.png`;

  return (
    <SlideFrame slide={8}>
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
                "radial-gradient(closest-side, rgba(47,91,255,0.16), rgba(255,255,255,0.6) 42%, rgba(244,241,234,0) 72%)",
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
            <span className="h-[2px] w-[3vw] bg-blue" />
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-blue font-semibold">
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
            creates <span className="text-blue font-medium">retention.</span>
          </motion.p>

          {/* the loop — product stages flow into OS stages */}
          <div className="relative mt-[5vh] max-w-[34vw]">
            <span
              aria-hidden
              className="absolute top-[1vh] bottom-[1vh] left-[0.35vw] w-px bg-text/15"
            />
            <div className="flex flex-col gap-[2.3vh]">
              {FLOW.map((n, i) => (
                <motion.div
                  key={n.t}
                  className="flex items-center gap-[1.4vw]"
                  initial={reduce ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 0.4, ease: EASE, delay: 0.18 + i * 0.05 }
                  }
                >
                  <span
                    className={`h-[0.7vw] w-[0.7vw] rounded-full shrink-0 z-10 ring-4 ring-bg ${
                      n.c === "red" ? "bg-red" : "bg-blue"
                    }`}
                  />
                  <div className="flex items-baseline gap-[0.9vw]">
                    <span className="font-display font-light text-[1.55vw] leading-none text-text">
                      {n.t}
                    </span>
                    <span className="font-display uppercase tracking-[0.24em] text-[0.62vw] text-text/40 font-semibold">
                      {n.k}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
