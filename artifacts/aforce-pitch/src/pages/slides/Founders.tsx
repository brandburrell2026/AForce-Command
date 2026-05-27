import SlideChrome from "@/components/SlideChrome";

function Founder({ name, role, bio, src, accent }: { name: string; role: string; bio: string; src: string; accent?: "red" | "blue" }) {
  const color = accent === "red" ? "text-red" : accent === "blue" ? "text-blue" : "text-text";
  return (
    <div className="flex flex-col">
      <div className="w-full aspect-[4/5] overflow-hidden bg-bg-elev">
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          style={{ filter: "saturate(0.6) contrast(1.05)" }}
        />
      </div>
      <div className="mt-[2.5vh] font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45">
        {role}
      </div>
      <div className={`mt-[1.2vh] font-display font-black text-[2.4vw] leading-[1] tracking-[-0.03em] ${color}`}>
        {name}
      </div>
      <p className="mt-[1.8vh] font-display text-[1vw] text-text/70 leading-[1.5] font-medium">
        {bio}
      </p>
    </div>
  );
}

export default function Founders() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-0 grid grid-cols-12 gap-x-[3vw] px-[5vw] pt-[15vh] pb-[12vh]">
        <div className="col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-[1vw] mb-[3.5vh]">
              <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
                The Founders
              </span>
              <span className="block h-[2px] w-[3vw] bg-red" />
            </div>
            <h2 className="font-display font-black tracking-[-0.035em] text-[4vw] leading-[0.95] text-text">
              Lived experience<br />
              <span className="text-red">under pressure.</span>
            </h2>
            <p className="mt-[4vh] font-display text-[1.1vw] text-text/70 leading-[1.5] font-medium max-w-[22vw]">
              The product is built by people who have actually had to perform.
            </p>
          </div>
          <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45">
            NBA · Wall Street · Operators
          </div>
        </div>

        <div className="col-span-4">
          <Founder
            name="Brandon Burrell"
            role="Co-Founder · Performance"
            bio="Former NBA. Spent a career inside the moment-before-the-moment. Translates locker-room behavior into product."
            src={`${base}images/founder-brandon.png`}
            accent="red"
          />
        </div>

        <div className="col-span-4">
          <Founder
            name="Julius"
            role="Co-Founder · System"
            bio="Wall Street and entrepreneurship. Built operating systems under capital pressure. Owns the loop and the economics."
            src={`${base}images/founder-julius.png`}
            accent="blue"
          />
        </div>
      </div>
    </SlideChrome>
  );
}
