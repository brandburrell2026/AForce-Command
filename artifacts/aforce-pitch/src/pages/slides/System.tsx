export default function System() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute -top-[20vh] -left-[15vw] w-[60vw] h-[60vw] rounded-full bg-blue/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute top-[15vh] -right-[20vw] w-[55vw] h-[55vw] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[25vh] left-[22vw] w-[60vw] h-[60vw] rounded-full bg-accent/[0.07] blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/0 via-bg/40 to-bg/80 pointer-events-none" />

      <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">06 — Product</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">06 / 24</div>
      </div>

      <div className="absolute top-[11vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1vh]">
          <div className="h-px w-[4vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.95vw] text-primary font-semibold">The Lineup</div>
        </div>
        <h1 className="font-display leading-[0.9] tracking-tighter text-balance text-[4.4vw]">
          <span className="text-text">Three flavors. </span>
          <span className="text-accent">Two formats.</span>
          <span className="text-text"> One </span>
          <span className="text-primary">system.</span>
        </h1>
        <div className="font-body text-[1vw] text-text/60 mt-[1.2vh] max-w-[78vw] leading-tight">
          A complete hydration system — ready to ship.{" "}
          <span className="text-text/85">Three signature flavors, each cut with a sea-grown botanical, available in cans for the cooler and sticks for the road.</span>
        </div>
      </div>

      <div className="absolute top-[33vh] bottom-[19vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.6vw] z-10">

        <div className="relative rounded-2xl bg-gradient-to-b from-blue/[0.14] via-blue/[0.04] to-transparent border border-blue/30 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-blue" />
          <div className="flex items-end justify-center gap-[0.4vw] h-[27vh] mb-[1.2vh]">
            <img src={`${base}can-berry.png`} alt="" className="h-[27vh] object-contain drop-shadow-2xl" />
            <img src={`${base}stick-berry.png`} alt="" className="h-[25vh] object-contain drop-shadow-2xl" />
          </div>
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-blue font-semibold mb-[0.6vh]">Flavor 01</div>
          <div className="font-display text-[1.8vw] leading-[1] tracking-tight text-text mb-[0.3vh]">Berry Blast</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.8vw] text-blue mb-[0.8vh]">+ Dulse</div>
          <div className="font-body text-[0.8vw] text-text/65 leading-snug mb-auto">Antioxidants and trace minerals from a sea vegetable rich in iodine, iron, and potassium.</div>
          <div className="pt-[1vh] border-t border-blue/20 mt-[1vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">325ml Can · 14g Stick</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-primary/[0.14] via-primary/[0.04] to-transparent border border-primary/30 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-primary" />
          <div className="flex items-end justify-center gap-[0.4vw] h-[27vh] mb-[1.2vh]">
            <img src={`${base}can-watermelon.png`} alt="" className="h-[27vh] object-contain drop-shadow-2xl" />
            <img src={`${base}stick-watermelon.png?v=5`} alt="" className="h-[25vh] object-contain drop-shadow-2xl" />
          </div>
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-primary font-semibold mb-[0.6vh]">Flavor 02</div>
          <div className="font-display text-[1.8vw] leading-[1] tracking-tight text-text mb-[0.3vh]">Watermelon Surge</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.8vw] text-primary mb-[0.8vh]">+ Chlorella</div>
          <div className="font-body text-[0.8vw] text-text/65 leading-snug mb-auto">Natural electrolytes and L-citrulline paired with a green-algae superfood for clean output.</div>
          <div className="pt-[1vh] border-t border-primary/20 mt-[1vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">325ml Can · 14g Stick</div>
          </div>
        </div>

        <div className="relative rounded-2xl bg-gradient-to-b from-accent/[0.16] via-accent/[0.05] to-transparent border border-accent/35 p-[1.6vw] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[0.5vh] bg-accent" />
          <div className="flex items-end justify-center gap-[0.4vw] h-[27vh] mb-[1.2vh]">
            <img src={`${base}can-soursop.png`} alt="" className="h-[27vh] object-contain drop-shadow-2xl" />
            <img src={`${base}stick-soursop.png`} alt="" className="h-[25vh] object-contain drop-shadow-2xl" />
          </div>
          <div className="font-body uppercase tracking-[0.28em] text-[0.7vw] text-accent font-semibold mb-[0.6vh]">Flavor 03</div>
          <div className="font-display text-[1.8vw] leading-[1] tracking-tight text-text mb-[0.3vh]">Soursop Edge</div>
          <div className="font-body uppercase tracking-[0.22em] text-[0.8vw] text-accent mb-[0.8vh]">+ Sea Moss</div>
          <div className="font-body text-[0.8vw] text-text/65 leading-snug mb-auto">92 minerals from one ocean-grown botanical — iodine, magnesium, zinc, and selenium in a single plant.</div>
          <div className="pt-[1vh] border-t border-accent/20 mt-[1vh]">
            <div className="font-body text-[0.7vw] text-text/55 uppercase tracking-[0.2em]">325ml Can · 14g Stick</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] z-10">
        <div className="flex items-center gap-[1vw] mb-[1.2vh]">
          <div className="h-px w-[3vw] bg-primary" />
          <div className="font-body uppercase tracking-[0.32em] text-[0.85vw] text-primary font-semibold">pH 8.8 · Zero Sugar</div>
        </div>
        <div className="border-t border-text/10 pt-[1.6vh] grid grid-cols-[1.4fr_1fr] gap-[2vw] items-baseline">
          <h3 className="font-display text-[2.1vw] leading-[1.05] tracking-tight text-text/95 text-balance">
            One <span className="text-primary">system.</span> Three <span className="text-accent">signature</span> flavors. Two <span className="text-blue">travel-ready</span> formats.
          </h3>
          <div className="font-body text-[0.85vw] text-text/55 uppercase tracking-[0.22em] text-right whitespace-nowrap leading-snug">
            Spring 2026 launch<br/>
            Cans + sticks · day one
          </div>
        </div>
      </div>
    </div>
  );
}
