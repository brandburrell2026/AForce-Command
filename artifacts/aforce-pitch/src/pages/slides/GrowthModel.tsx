import SlideChrome from "@/components/SlideChrome";

export default function PathTo32M() {
  return (
    <SlideChrome slide={22}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Path to $3.2M
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.92] tracking-tighter max-w-[80vw]">
          <span className="text-primary">60,000</span> orders.
          <br />
          <span className="text-text/45">Operator-driven.</span>
        </h2>

        <div className="mt-[8vh] grid grid-cols-2 gap-[4vw] max-w-[78vw]">
          <div className="border-t border-text/20 pt-[2.5vh]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold mb-[1.5vh]">
              Acquisition Engine
            </div>
            <div className="space-y-[1vh] font-body text-[0.95vw] text-text/75 leading-[1.55]">
              <div>— Meta + Google paid social.</div>
              <div>— Founder-led content & referral.</div>
              <div>— High-conviction event activation.</div>
              <div>— Founder access in Brickell density.</div>
            </div>
          </div>
          <div className="border-t border-text/20 pt-[2.5vh]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold mb-[1.5vh]">
              Retention Engine
            </div>
            <div className="space-y-[1vh] font-body text-[0.95vw] text-text/75 leading-[1.55]">
              <div>— Subscription bundles, ritual onboarding.</div>
              <div>— OS reinforcement (Score / Command).</div>
              <div>— Streaks, habit, identity.</div>
              <div>— Free-to-paid ecosystem conversion.</div>
            </div>
          </div>
        </div>

        <div className="mt-[7vh] grid grid-cols-3 gap-[2vw] max-w-[70vw]">
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">60k</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-text/45 mt-[0.6vh] font-semibold">Orders target</div>
          </div>
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">$53</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-text/45 mt-[0.6vh] font-semibold">Avg basket</div>
          </div>
          <div className="border-t border-text/15 pt-[1.5vh]">
            <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">$3.2M</div>
            <div className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-text/45 mt-[0.6vh] font-semibold">Revenue path</div>
          </div>
        </div>

        <div className="mt-[5vh] font-body text-[0.85vw] text-text/40 max-w-[60vw] leading-[1.6]">
          Simple. Believable. Two engines, one ritual.
        </div>
      </div>
    </SlideChrome>
  );
}
