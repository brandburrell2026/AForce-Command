export default function Model() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">22 — Channels</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">22 / 28</div>
      </div>

      <div className="absolute top-[16vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[6.5vw] leading-[0.95] tracking-tighter text-balance max-w-[75vw]">
          Every place sweat happens.
        </h2>
        <p className="mt-[2vh] font-body text-[1.6vw] text-text/75 max-w-[55vw] leading-snug">
          Four channels. Two formats. Margin compounds.
        </p>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-4 gap-[2vw]">
        <div className="bg-bg-elev rounded-md p-[2.5vw] border-t-2 border-primary">
          <div className="font-display text-[2vw] text-primary mb-[1.5vh]">DTC</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1.5vh]">Subscribe & ship.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">12-pack cans + stick boxes. High-margin, owned customer relationship.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[2.5vw] border-t-2 border-blue">
          <div className="font-display text-[2vw] text-blue mb-[1.5vh]">Retail</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1.5vh]">Premium grocery.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Whole Foods, Erewhon, Sprouts. Cooler-set placement next to category leaders.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[2.5vw] border-t-2 border-accent">
          <div className="font-display text-[2vw] text-accent mb-[1.5vh]">Gyms</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1.5vh]">Sticks at the front desk.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Boutique studios, CrossFit, F45. Single-serve format priced for impulse buy.</div>
        </div>
        <div className="bg-bg-elev rounded-md p-[2.5vw] border-t-2 border-text/40">
          <div className="font-display text-[2vw] text-text">Travel</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1.5vh] mt-[1.5vh]">TSA-friendly sticks.</div>
          <div className="font-body text-[1.5vw] text-text/75 leading-snug">Airport newsstands, hotel minibars, conference giveaways. Sticks travel.</div>
        </div>
      </div>
    </div>
  );
}
