import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const photo = `${base}images/bg/16-silence-hooded2.png`;

  return (
    <SlideFrame slide={8}>
      <div className="absolute inset-0">
        {/* RIGHT — full-height portrait, bleeding off the right edge */}
        <motion.div
          className="absolute inset-y-0 right-0 w-[52%]"
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? undefined : { duration: 1.1, ease: EASE }}
        >
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-center"
          />
          {/* soft fade so the photo melts into the grey canvas on the left */}
          <div className="absolute inset-y-0 left-0 w-[32%] bg-gradient-to-r from-[#e7e3db] via-[#e7e3db]/60 to-transparent" />
          {/* bottom scrim keeps the shared footer chrome legible over the dark figure */}
          <div className="absolute inset-x-0 bottom-0 h-[15vh] bg-gradient-to-t from-[#d9d4cb] to-transparent" />
        </motion.div>

        {/* the message — one statement */}
        <div className="absolute inset-y-0 left-0 z-10 flex w-[48%] flex-col justify-center px-[5vw]">
          <motion.div
            className="mb-[5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Opening
            </span>
          </motion.div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.1 }}
            >
              The
            </motion.div>
            <motion.div
              className="text-red font-normal"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.2 }}
            >
              white space.
            </motion.div>
          </h1>

          <motion.p
            className="mt-[4vh] max-w-[28vw] font-body text-[1.15vw] leading-[1.55] text-text/70"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.34 }}
          >
            AForce owns the moment before execution — the one space the category
            left empty.
          </motion.p>
        </div>
      </div>
    </SlideFrame>
  );
}
