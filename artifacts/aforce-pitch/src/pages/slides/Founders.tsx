import SlideChrome from "@/components/SlideChrome";

function Founder({
  name,
  role,
  bio,
  src,
}: {
  name: string;
  role: string;
  bio: string;
  src: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="w-full aspect-[4/5] overflow-hidden bg-bg-elev">
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          style={{ filter: "saturate(0.55) contrast(1.05) sepia(0.16)" }}
        />
      </div>
      <div className="mt-[3vh] font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium">
        {role}
      </div>
      <div className="mt-[1.5vh] font-display font-light text-[2.4vw] leading-[1.05] tracking-tight">
        {name}
      </div>
      <p className="mt-[2vh] font-display text-[1.05vw] italic text-text/65 leading-[1.5]">
        {bio}
      </p>
    </div>
  );
}

export default function Founders() {
  const base = import.meta.env.BASE_URL;
  return (
    <SlideChrome slide={11}>
      <div className="absolute inset-0 grid grid-cols-12 gap-x-[4vw] px-[9vw] py-[11vh]">
        <div className="col-span-4 flex flex-col justify-between">
          <div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
              The Founders
            </div>
            <h2 className="font-display font-light text-[3.6vw] leading-[1.05] tracking-tight">
              Lived experience<br />
              <span className="italic text-text/75">under pressure.</span>
            </h2>
            <p className="mt-[4vh] font-display text-[1.2vw] text-text/60 italic leading-[1.5] max-w-[22vw]">
              The product is built by people who have actually had to perform.
            </p>
          </div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium">
            NBA · Wall Street · Operators
          </div>
        </div>

        <div className="col-span-4">
          <Founder
            name="Brandon Burrell"
            role="Co-Founder · Performance"
            bio="Former NBA. Spent a career inside the moment-before-the-moment. Translates locker-room behavior into product."
            src={`${base}images/brandon.jpg`}
          />
        </div>

        <div className="col-span-4">
          <Founder
            name="Julius"
            role="Co-Founder · System"
            bio="Wall Street and entrepreneurship. Built operating systems under capital pressure. Owns the loop and the economics."
            src={`${base}images/julius.jpg`}
          />
        </div>
      </div>
    </SlideChrome>
  );
}
