import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import ProjectionDisclaimer from "@/components/ProjectionDisclaimer";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Use-of-funds allocation, aligned exactly to the Credit Memorandum / lender
 * package. Six tranches, summing to 100% / $4,000,000. Colors follow the deck's
 * tri-color brand system: red = commercialization & demand (manufacturing +
 * sales/marketing), blue = product & expansion infrastructure (R&D + AForce OS,
 * distribution), charcoal/neutral = operations & reserve.
 */
const USE = [
  {
    pctLabel: "40%",
    basis: 40,
    amount: "$1,600,000",
    label: "Manufacturing & Production",
    sub: "Commercial inventory production, co-packing, packaging procurement, raw materials, and launch inventory.",
    grad: "linear-gradient(90deg, #e41e2b 0%, #ff5246 100%)",
    glow: "rgba(228,30,43,0.45)",
  },
  {
    pctLabel: "21.25%",
    basis: 21.25,
    amount: "$850,000",
    label: "Operating Expenses",
    sub: "Personnel, insurance, legal, accounting, administration, and corporate infrastructure.",
    grad: "linear-gradient(90deg, #3a352f 0%, #6b645c 100%)",
    glow: "rgba(26,24,19,0.32)",
  },
  {
    pctLabel: "20%",
    basis: 20,
    amount: "$800,000",
    label: "Sales & Marketing",
    sub: "Customer acquisition, influencer campaigns, ambassador programs, experiential marketing, digital advertising, and brand awareness.",
    grad: "linear-gradient(90deg, #ff5a4f 0%, #ff8579 100%)",
    glow: "rgba(255,90,79,0.42)",
  },
  {
    pctLabel: "8.75%",
    basis: 8.75,
    amount: "$350,000",
    label: "Research & Development",
    sub: "Product innovation, AForce OS development, formulation enhancements, testing, and future product expansion.",
    grad: "linear-gradient(90deg, #2f5bff 0%, #6b8bff 100%)",
    glow: "rgba(47,91,255,0.45)",
  },
  {
    pctLabel: "7.5%",
    basis: 7.5,
    amount: "$300,000",
    label: "Distribution & Retail Expansion",
    sub: "Warehousing, logistics, fulfillment, retail onboarding, broker support, and channel development.",
    grad: "linear-gradient(90deg, #5a73c9 0%, #8fa3e0 100%)",
    glow: "rgba(90,115,201,0.40)",
  },
  {
    pctLabel: "2.5%",
    basis: 2.5,
    amount: "$100,000",
    label: "Working Capital Reserve",
    sub: "Liquidity reserve for unforeseen operating needs and growth opportunities.",
    grad: "linear-gradient(90deg, #b3ada3 0%, #d2ccc2 100%)",
    glow: "rgba(150,143,132,0.30)",
  },
];

export default function TheAsk() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const photo = `${base}images/bg/17-ask.png`;

  const reveal = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 } as const,
    transition: reduce ? undefined : { duration: 0.55, ease: EASE, delay },
  });

  return (
    <SlideFrame slide={23}>
      {/* closing backdrop — a lone figure facing a vast dawn horizon: the scale
          ahead. Held far behind the numbers by an even legibility veil so the
          allocation table reads crisp across the full width. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <motion.img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full origin-center scale-[1.04] object-cover object-center"
          initial={reduce ? false : { opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1.04 }}
          transition={reduce ? undefined : { duration: 1.4, ease: EASE }}
        />
        <div className="absolute inset-0 bg-[#eceae4]/55" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(135% 110% at 50% 40%, rgba(236,234,228,0.97) 0%, rgba(236,234,228,0.95) 60%, rgba(236,234,228,0.86) 88%, rgba(236,234,228,0.62) 100%)",
          }}
        />
      </div>

      {/* hero glow behind the figure — red energy, upper-left */}
      <motion.div
        aria-hidden
        className="absolute left-[2vw] top-[16vh] h-[40vh] w-[40vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.14) 0%, rgba(228,30,43,0) 68%)",
          filter: "blur(8px)",
        }}
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? undefined : { duration: 1.4, ease: EASE }}
      />
      {/* cool OS-blue accent halo, lower-right */}
      <div
        aria-hidden
        className="absolute right-[-6vw] bottom-[2vh] h-[40vh] w-[40vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 70%)",
          filter: "blur(8px)",
        }}
      />

      <div className="absolute inset-0 flex items-stretch gap-[3.6vw] px-[5.5vw] pt-[12vh] pb-[12vh]">
        {/* LEFT — narrative / the facility */}
        <div className="flex w-[35%] shrink-0 flex-col justify-between text-left">
          <div>
            <motion.span
              className="block font-display uppercase tracking-[0.34em] text-[0.82vw] text-red font-semibold"
              {...reveal(0)}
            >
              The Ask
            </motion.span>

            <motion.div
              className="mt-[2vh] font-display font-normal tracking-[0.005em] text-[4.6vw] leading-[0.92] text-text"
              {...reveal(0.08)}
            >
              $4 <span className="text-red">Million</span>
            </motion.div>

            <motion.div
              className="mt-[1.4vh] font-display uppercase tracking-[0.16em] text-[1.34vw] leading-[1.3] text-text font-semibold"
              {...reveal(0.16)}
            >
              Growth Capital Facility
            </motion.div>

            <motion.p
              className="mt-[2.4vh] max-w-[26vw] font-body text-[0.92vw] leading-[1.6] text-text/65"
              {...reveal(0.24)}
            >
              Capital to support commercialization, inventory build, national
              launch preparation, customer acquisition, and operational scale.
            </motion.p>
          </div>

          {/* disciplined-capital statement — anchors the column */}
          <motion.div className="max-w-[27vw]" {...reveal(0.9)}>
            <span className="block h-[2px] w-[3vw] rounded-full bg-red mb-[1.6vh]" />
            <p className="font-display text-[1.12vw] leading-[1.4] text-text font-medium tracking-[-0.01em]">
              A disciplined capital deployment strategy designed to support
              commercialization, operational execution, and{" "}
              <span className="text-red">scalable growth.</span>
            </p>
          </motion.div>
        </div>

        {/* RIGHT — use-of-funds allocation table */}
        <div className="flex flex-1 flex-col justify-center">
          <motion.div
            className="mb-[1.8vh] flex items-end justify-between"
            {...reveal(0.3)}
          >
            <span className="font-display uppercase tracking-[0.24em] text-[0.74vw] text-text/55 font-semibold border-b-2 border-red pb-[0.6vh]">
              Use of Funds Allocation
            </span>
            <span className="font-display uppercase tracking-[0.2em] text-[0.74vw] text-text/40 font-semibold tabular-nums">
              $4,000,000 Total
            </span>
          </motion.div>

          {/* single proportional stacked bar */}
          <motion.div
            className="flex w-full h-[2.6vh] gap-[3px] rounded-full overflow-hidden"
            style={{ transformOrigin: "left" }}
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.85, ease: EASE, delay: 0.36 }}
          >
            {USE.map((u) => (
              <div
                key={u.label}
                className="h-full"
                style={{
                  flexBasis: `${u.basis}%`,
                  background: u.grad,
                  boxShadow: `0 0 16px -4px ${u.glow}`,
                }}
              />
            ))}
          </motion.div>

          {/* itemized breakdown — one row per tranche, credit-memo style */}
          <div className="mt-[2.6vh] flex flex-col">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                className={`flex items-center gap-[1.3vw] py-[1.35vh] ${
                  i > 0 ? "border-t border-text/10" : ""
                }`}
                {...reveal(0.46 + i * 0.07)}
              >
                <span
                  aria-hidden
                  className="block w-[4px] self-stretch rounded-full"
                  style={{ background: u.grad }}
                />
                <div className="flex w-[8.5vw] shrink-0 items-baseline gap-[0.5vw]">
                  <span className="font-display text-[1.9vw] font-normal text-text tabular-nums leading-none">
                    {u.pctLabel}
                  </span>
                </div>
                <div className="w-[7vw] shrink-0">
                  <span className="font-display text-[1.02vw] text-text/70 font-normal tabular-nums">
                    {u.amount}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display uppercase tracking-[0.12em] text-[0.92vw] text-text font-semibold leading-[1.2]">
                    {u.label}
                  </div>
                  <div className="mt-[0.5vh] font-body text-[0.74vw] leading-[1.4] text-text/50">
                    {u.sub}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <ProjectionDisclaimer className="absolute bottom-[7.5vh] left-0 right-0 mx-auto max-w-[72vw] text-center z-10" />
    </SlideFrame>
  );
}
