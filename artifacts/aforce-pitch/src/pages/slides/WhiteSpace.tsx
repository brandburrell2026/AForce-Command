import SlideFrame from "@/components/SlideFrame";

const FAINT = [
  { t: "MONSTER", top: "20%", left: "62%", rot: -8 },
  { t: "CELSIUS", top: "72%", left: "60%", rot: 6 },
  { t: "PRIME", top: "30%", left: "86%", rot: 5 },
  { t: "GHOST", top: "62%", left: "88%", rot: -6 },
];

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideFrame slide={6}>
      <div className="absolute inset-0">
        {/* faint competitor noise behind */}
        {FAINT.map((n) => (
          <div
            key={n.t}
            className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
            style={{
              top: n.top,
              left: n.left,
              fontSize: "2.4vw",
              transform: `rotate(${n.rot}deg)`,
              opacity: 0.08,
            }}
          >
            {n.t}
          </div>
        ))}

        {/* the single can — the clarity amid the noise */}
        <img
          src={`${base}images/aforce-can.png`}
          alt="AForce"
          className="absolute right-[16%] top-1/2 -translate-y-1/2 h-[64vh] w-auto object-contain z-10 drop-shadow-[0_40px_50px_rgba(0,0,0,0.16)]"
        />

        {/* the message */}
        <div className="absolute inset-y-0 left-0 w-[50%] flex flex-col justify-center px-[5vw] z-20">
          <div className="mb-[5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              The Opening
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <div>The</div>
            <div className="text-blue font-normal">white space.</div>
          </h1>

          <p className="mt-[4vh] max-w-[30vw] font-body text-[1.15vw] leading-[1.55] text-text/70">
            AForce owns the moment before execution — the one space the category
            left empty.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
