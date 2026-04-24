const base = import.meta.env.BASE_URL;

export default function Band() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">08 — Band</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">08 / 15</div>
      </div>

      <div className="absolute inset-0 grid grid-cols-2">
        <div className="flex flex-col justify-center px-[5vw]">
          <div className="h-[2px] w-[4vw] bg-primary mb-[3vh]" />
          <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance">
            The Band.
          </h2>
          <p className="mt-[4vh] font-body text-[1.6vw] font-light text-text/85 text-pretty leading-relaxed max-w-[35vw]">
            Phantom Band. An LED-driven wearable that mirrors your state. Feedback you can feel without looking.
          </p>
          <div className="mt-[5vh] flex flex-col gap-[2vh] max-w-[35vw]">
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-accent mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">Lime when you are peaking.</div>
            </div>
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-primary mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">Red when the system needs you.</div>
            </div>
            <div className="flex items-start gap-[1.5vw]">
              <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-text/70 mt-[0.6vh] shrink-0" />
              <div className="font-body text-[1.5vw] text-text/85 text-pretty leading-snug">Closes the loop. Body, drink, OS, band.</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <img
            src={`${base}band-hero.png`}
            crossOrigin="anonymous"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-bg/70" />
        </div>
      </div>
    </div>
  );
}
