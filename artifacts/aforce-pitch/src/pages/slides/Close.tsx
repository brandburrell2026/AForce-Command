import Wordmark from "@/components/Wordmark";

export default function Close() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-black text-white font-body">
      {/* full-bleed cinematic figure */}
      <img
        src={`${base}images/bg/16-silence-hooded3.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 20%" }}
      />

      {/* gradient wash for legibility */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between px-[6vw] py-[7vh]">
        <div className="flex items-start justify-between">
          <Wordmark className="h-[2vw]" />
          <div className="font-body uppercase tracking-[0.22em] text-[0.6vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
            Patent-Protected
          </div>
        </div>

        <div>
          <h1 className="font-display font-light tracking-[-0.025em] text-[4.6vw] leading-[1.0] text-white">
            <div>Performance is</div>
            <div className="text-red font-normal">non-negotiable.</div>
          </h1>
          <div className="mt-[3.5vh] font-body uppercase tracking-[0.42em] text-[0.82vw] text-white/70 font-semibold">
            Pause — Hydrate — Lock In — Perform
          </div>
        </div>
      </div>
    </div>
  );
}
