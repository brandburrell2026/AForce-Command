export default function Tailwinds() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">10 — Tailwinds</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">10 / 15</div>
      </div>

      <div className="absolute top-[20vh] left-[6vw] right-[6vw]">
        <h2 className="font-display text-[5.5vw] leading-[0.95] tracking-tighter text-balance max-w-[80vw]">
          The category is moving toward us.
        </h2>
      </div>

      <div className="absolute bottom-[10vh] left-[6vw] right-[6vw] grid grid-cols-2 gap-x-[5vw] gap-y-[4vh]">
        <div className="border-t border-divider pt-[2.5vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1vh]">Cultural</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1vh] text-balance">Recovery is the new fitness.</div>
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Sleep, hydration, and parasympathetic recovery moved from niche to mainstream.</p>
        </div>
        <div className="border-t border-divider pt-[2.5vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1vh]">Hardware</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1vh] text-balance">Wearables hit ubiquity.</div>
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Whoop, Oura, Apple Watch normalized 24/7 biometric awareness.</p>
        </div>
        <div className="border-t border-divider pt-[2.5vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1vh]">AI</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1vh] text-balance">AI coaching is consumer-ready.</div>
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">Personalized routing of action used to require a coach. Now it does not.</p>
        </div>
        <div className="border-t border-divider pt-[2.5vh]">
          <div className="font-body uppercase tracking-[0.3em] text-[1.5vw] text-accent mb-[1vh]">Demand</div>
          <div className="font-display text-[2.4vw] leading-tight text-text mb-[1vh] text-balance">Gen Z rejects sugar.</div>
          <p className="font-body text-[1.5vw] font-light text-text/65 text-pretty leading-snug">The legacy energy-drink playbook is not the playbook for the next decade.</p>
        </div>
      </div>
    </div>
  );
}
