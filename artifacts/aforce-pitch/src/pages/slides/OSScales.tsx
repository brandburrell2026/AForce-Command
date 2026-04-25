export default function OSScales() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-accent font-semibold">18 — OS Economics</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">18 / 29</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[4vw] bg-accent" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-accent font-semibold">Subscription Software Layer</span>
        </div>
        <h2 className="font-display text-[3.6vw] leading-[1] tracking-tighter text-balance max-w-[80vw]">
          AForce OS scales with <span className="text-accent">software-level economics.</span>
        </h2>
      </div>

      <div className="absolute top-[34vh] bottom-[5vh] left-[6vw] right-[6vw] grid grid-cols-[1.6fr_1fr] gap-[3vw]">
        <div className="bg-bg-elev rounded-lg border border-text/10 overflow-hidden">
          <div className="grid grid-cols-4 px-[1.6vw] py-[1.4vh] border-b border-text/10 font-body uppercase tracking-[0.25em] text-[0.95vw] text-muted">
            <div>Metric</div>
            <div className="text-center text-blue">OS Core</div>
            <div className="text-center text-accent">Athlete Mode</div>
            <div className="text-center text-primary">OS + Bundle</div>
          </div>
          {[
            ["Monthly Price", "$5/mo", "$15/mo", "$50/mo"],
            ["Customer Lifespan", "2.5 yrs", "3 yrs", "3 yrs"],
            ["CLTV", "$150", "$540", "$1,800"],
            ["Gross Profit CLTV", "$135", "$486", "$1,404"],
            ["CAC", "$30", "$40", "$65"],
            ["LTV : CAC", "5:1", "13.5:1", "21:1"],
          ].map(([metric, a, b, c], i) => (
            <div key={i} className={`grid grid-cols-4 px-[1.6vw] py-[1.6vh] font-body text-[1.15vw] ${i === 5 ? "bg-accent/5 font-semibold" : ""} ${i < 5 ? "border-b border-text/5" : ""}`}>
              <div className="text-text/85">{metric}</div>
              <div className="text-center text-text/85">{a}</div>
              <div className="text-center text-text/85">{b}</div>
              <div className={`text-center ${i === 5 ? "text-primary font-display text-[1.4vw]" : "text-text/85"}`}>{c}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[1.4vh]">
          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-accent">
            <div className="font-display text-[3.6vw] leading-none text-accent">90%+</div>
            <div className="font-body text-[1.1vw] text-text/70 mt-[0.8vh]">Digital platform gross margin.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-primary">
            <div className="font-display text-[3.6vw] leading-none text-primary">21:1</div>
            <div className="font-body text-[1.1vw] text-text/70 mt-[0.8vh]">LTV:CAC at the bundle tier.</div>
          </div>
          <div className="bg-bg-elev rounded-md p-[1.4vw] border-t-2 border-blue">
            <div className="font-display text-[3vw] leading-none text-blue">$1,404</div>
            <div className="font-body text-[1.1vw] text-text/70 mt-[0.8vh]">Lifetime profit per bundle customer.</div>
          </div>
          <div className="bg-bg/40 rounded-md p-[1.2vw] border border-text/10">
            <div className="font-body text-[0.95vw] text-muted leading-snug">
              <span className="text-text/85">Typical beverage LTV:CAC: 2–3x.</span> AForce ecosystem: 5–21x. SaaS margins {">"}90% transform AForce into a high-margin platform company.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
