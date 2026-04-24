export default function Model() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">12 — Model</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">12 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          Two recurring streams. One ecosystem.
        </h2>
      </div>

      <div className="absolute top-[44vh] bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-[4vw]">
        <div className="bg-bg-elev/60 border border-divider rounded-sm p-[3.5vh] flex flex-col">
          <div className="h-[3px] w-[3vw] bg-primary mb-[2vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Stream 01</div>
          <div className="font-display text-[2.6vw] text-text mb-[2vh] leading-tight">Drink — DTC + retail</div>
          <p className="font-body text-[1.5vw] font-light text-text/75 text-pretty leading-relaxed">
            Premium can pricing. Subscribe-and-save flagship. Margins typical of premium beverage. Retail follows DTC traction.
          </p>
        </div>
        <div className="bg-bg-elev/60 border border-divider rounded-sm p-[3.5vh] flex flex-col">
          <div className="h-[3px] w-[3vw] bg-accent mb-[2vh]" />
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-muted mb-[1vh]">Stream 02</div>
          <div className="font-display text-[2.6vw] text-text mb-[2vh] leading-tight">AForce OS — subscription</div>
          <p className="font-body text-[1.5vw] font-light text-text/75 text-pretty leading-relaxed">
            "Become AForce" tier unlocks the full OS, social mode, and AI routing. Software margins. Compounds with drink loyalty.
          </p>
        </div>
      </div>

      <div className="absolute bottom-[3vh] left-[6vw] right-[6vw] text-center">
        <p className="font-body text-[1.5vw] text-muted">Plus: Phantom Band hardware — one-time purchase plus accessory ecosystem.</p>
      </div>
    </div>
  );
}
