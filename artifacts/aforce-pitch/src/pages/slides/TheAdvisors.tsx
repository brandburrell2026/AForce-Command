import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Advisor = {
  name: string;
  title: string;
  area: string;
  src: string;
  position: string;
};

export default function TheAdvisors() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;

  const ADVISORS: Advisor[] = [
    {
      name: "Peter Ingwersen",
      title: "Former CEO, Denham · Advisor, Levi's",
      area: "Brand strategy and premium positioning",
      src: `${base}peter.jpg`,
      position: "center 22%",
    },
    {
      name: "Kristel van Kleef",
      title: "Brand Advisor · On Running",
      area: "Brand strategy and ecosystem design",
      src: `${base}kristel.jpg`,
      position: "center 22%",
    },
    {
      name: "Mark Mendel",
      title: "Investment Banker · Finalis",
      area: "Capital strategy and investment banking",
      src: `${base}mark-mendel.jpg`,
      position: "center 22%",
    },
    {
      name: "Thomas Masterbouni",
      title: "Chief Investment Officer · Big Idea Ventures",
      area: "Investment strategy and venture growth",
      src: `${base}thomas.jpg`,
      position: "center 22%",
    },
  ];

  return (
    <SlideFrame slide={5}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        {/* header */}
        <motion.div
          className="mb-[3vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Advisors
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.6vw] leading-[1.02] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          The people behind the{" "}
          <span className="text-red font-normal">people.</span>
        </motion.h1>

        <motion.p
          className="mt-[2.2vh] max-w-[48vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          AForce is supported by operators who have built, scaled, and exited at
          the highest level.
        </motion.p>

        {/* advisor cards */}
        <div className="mt-[4vh] grid grid-cols-4 gap-[1.6vw]">
          {ADVISORS.map((a, i) => (
            <motion.div
              key={a.name}
              className="flex flex-col"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.25 + i * 0.07 }
              }
            >
              <div
                className="relative w-full overflow-hidden rounded-[3px]"
                style={{ aspectRatio: "4 / 5", boxShadow: "0 20px 40px rgba(0,0,0,0.14)" }}
              >
                <img
                  src={a.src}
                  alt={`${a.name}, ${a.title}`}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: a.position, filter: "grayscale(1) contrast(1.03)" }}
                />
                {/* subtle bottom fade */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%]"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(228,224,216,0.9) 0%, rgba(228,224,216,0) 100%)",
                  }}
                />
              </div>

              <span className="mt-[1.8vh] h-[2px] w-[2vw] bg-red" />

              <div className="mt-[1.4vh] font-display text-[1.2vw] font-normal leading-[1.1] text-text">
                {a.name}
              </div>
              <div className="mt-[0.9vh] font-display text-[0.8vw] font-semibold leading-[1.35] text-red">
                {a.title}
              </div>
              <div className="mt-[0.9vh] font-body text-[0.8vw] leading-[1.5] text-text/55">
                {a.area}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
