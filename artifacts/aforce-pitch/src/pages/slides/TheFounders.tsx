import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import brandon from "@assets/BrandonBB_1780089392262.jpeg";
import julius from "@assets/JuliusB_1780089406464.jpg";

const EASE = [0.16, 1, 0.3, 1] as const;

type Founder = {
  name: string;
  role: string;
  src: string;
  position: string;
  accent: string;
};

const FOUNDERS: Founder[] = [
  {
    name: "Brandon",
    role: "Founder",
    src: brandon,
    position: "center 24%",
    accent: "bg-red",
  },
  {
    name: "Julius",
    role: "Co-Founder",
    src: julius,
    position: "center 16%",
    accent: "bg-red",
  },
];

export default function TheFounders() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={3}>
      <div className="absolute inset-0 flex items-stretch pt-[13vh] pb-[11vh] pl-[5vw] pr-[4vw] gap-[3vw]">
        {/* LEFT — lived conviction */}
        <div className="flex w-[52%] flex-col justify-center">
          <motion.div
            className="mb-[4vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Founders
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[4.2vw] leading-[1.0] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            We lived the <span className="text-red font-normal">gap.</span>
          </motion.h1>

          <motion.div
            className="mt-[3.4vh] max-w-[35vw] space-y-[1.4vh] font-body text-[0.92vw] leading-[1.5]"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
          >
            <p className="text-text">
              <span className="font-medium">Brandon Burrell</span> built his career
              across Wall Street, global hospitality, and entrepreneurship —
              environments where preparation and execution determined outcomes.
            </p>
            <p className="text-text">
              <span className="font-medium">Julius Burrell</span> competed as a
              collegiate baseball player and went on to build businesses
              internationally — arenas where performance was measured daily and
              discipline was non-negotiable.
            </p>
            <p className="text-text/65">
              Across business, sport, and life they recognized the same truth: the
              highest performers all face the same challenge — showing up ready when
              it matters most. AForce was built to help people prepare before
              execution.
            </p>
          </motion.div>

          <motion.div
            className="mt-[3.2vh] flex items-center gap-[1vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.3 }}
          >
            <span className="h-[2px] w-[3vw] bg-red" />
            <span className="font-display uppercase tracking-[0.24em] text-[1.18vw] text-text font-semibold">
              Performance begins before the moment.
            </span>
          </motion.div>
        </div>

        {/* RIGHT — the two founders */}
        <div className="flex w-[48%] items-stretch gap-[1.6vw]">
          {FOUNDERS.map((f, i) => (
            <motion.div
              key={f.name}
              className="flex flex-1 flex-col"
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.3 + i * 0.12 }
              }
            >
              <div
                className="relative w-full flex-1 overflow-hidden rounded-[3px]"
                style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.16)" }}
              >
                <img
                  src={f.src}
                  alt={`${f.name}, ${f.role} of AForce`}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: f.position, filter: "grayscale(1) contrast(1.03)" }}
                />
                {/* subtle bottom fade for the name plate to sit on */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%]"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(228,224,216,0.92) 0%, rgba(228,224,216,0) 100%)",
                  }}
                />
              </div>

              {/* name plate */}
              <div className="mt-[1.8vh] flex items-center gap-[0.7vw]">
                <span className={`h-[2px] w-[1.4vw] ${f.accent}`} />
                <div className="leading-none">
                  <div className="font-display text-[1.3vw] font-normal text-text leading-none">
                    {f.name}
                  </div>
                  <div className="mt-[0.7vh] font-display uppercase tracking-[0.26em] text-[0.6vw] text-text/45 font-semibold">
                    {f.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
