import SlideFrame from "@/components/SlideFrame";

export default function NonNegotiable() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideFrame slide={1} invert>
      <div className="absolute inset-0">
        <img
          src={`${base}images/bg/15-final.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        {/* cinematic grade — pull the foreground into shadow for white type */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,13,18,0.92) 0%, rgba(11,13,18,0.7) 38%, rgba(11,13,18,0.25) 70%, rgba(11,13,18,0.55) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,13,18,0.55) 0%, rgba(11,13,18,0) 35%, rgba(11,13,18,0.6) 100%)",
          }}
        />

        <div className="absolute left-[5vw] bottom-[18vh] max-w-[68%]">
          <h1 className="font-display font-light tracking-[-0.03em] text-[6vw] leading-[0.98] text-[#F5F4F1]">
            <div>Performance is</div>
            <div className="text-red font-normal">non-negotiable.</div>
          </h1>
        </div>
      </div>
    </SlideFrame>
  );
}
