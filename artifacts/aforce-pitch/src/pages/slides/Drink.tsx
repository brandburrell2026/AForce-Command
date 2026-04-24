const base = import.meta.env.BASE_URL;

export default function Drink() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">06 — Drink</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">06 / 15</div>
      </div>

      <div className="absolute inset-0 grid grid-cols-2">
        <div className="relative overflow-hidden">
          <img
            src={`${base}drink-hero.png`}
            crossOrigin="anonymous"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-bg/70" />
        </div>
        <div className="flex flex-col justify-center px-[5vw]">
          <div className="h-[2px] w-[4vw] bg-primary mb-[3vh]" />
          <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter text-balance">
            The Drink.
          </h2>
          <p className="mt-[4vh] font-body text-[1.6vw] font-light text-text/85 text-pretty leading-relaxed max-w-[35vw]">
            Performance hydration with a clean formula. No sugar bombs. Four flavors built for output.
          </p>
          <div className="mt-[5vh] grid grid-cols-2 gap-y-[1.5vh] gap-x-[3vw] max-w-[30vw]">
            <div className="font-body text-[1.5vw] text-text/75">Watermelon</div>
            <div className="font-body text-[1.5vw] text-text/75">Berry</div>
            <div className="font-body text-[1.5vw] text-text/75">Soursop</div>
            <div className="font-body text-[1.5vw] text-text/75">Unflavored</div>
          </div>
          <div className="mt-[5vh] font-display text-[1.8vw] text-accent">
            Clean AF. Effective AF.
          </div>
        </div>
      </div>
    </div>
  );
}
