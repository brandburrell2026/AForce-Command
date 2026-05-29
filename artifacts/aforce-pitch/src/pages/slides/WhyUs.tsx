import SlideFrame from "@/components/SlideFrame";

export default function WhyUs() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideFrame slide={11}>
      <div className="absolute inset-0 flex">
        {/* LEFT — the story */}
        <div className="w-[58%] flex flex-col justify-center px-[5vw]">
          <div className="mb-[4vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              Why Us
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[4vw] leading-[1.02] text-text">
            We lived the <span className="text-red font-normal">gap.</span>
          </h1>

          <div className="mt-[4vh] max-w-[40vw] space-y-[2.4vh] font-body text-[1.05vw] leading-[1.6] text-text/75">
            <p>
              High performers have endless tools for energy and almost none for
              readiness. We spent years in rooms where the margin between good and
              great was composure under pressure — not another stimulant.
            </p>
            <p>
              AForce was built from the inside of that pressure. Not a beverage
              looking for a story, but a behavior looking for a product. The can
              is the entry. The ritual is the point.
            </p>
            <p className="text-text/55 italic">
              We are not selling hydration. We are installing a standard.
            </p>
          </div>
        </div>

        {/* RIGHT — portrait */}
        <div className="w-[42%] relative">
          <img
            src={`${base}images/founder-brandon.png`}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 20%" }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-[12vw] pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(244,241,234,1) 0%, rgba(244,241,234,0) 100%)",
            }}
          />
        </div>
      </div>
    </SlideFrame>
  );
}
