import EditorialSlide from "@/components/EditorialSlide";

export default function ThePerformanceLoop() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={8}
      eyebrow="The Performance Loop"
      heroSrc={`${base}images/bg/08-loop.png`}
      headline={
        <>
          <div>Every cycle</div>
          <div className="text-blue font-normal">earns the next.</div>
        </>
      }
      footer={
        <>
          <p>Drink — the product enters.</p>
          <p>Ritual — behavior takes hold.</p>
          <p>Reinforcement — the OS returns the moment.</p>
          <p>Retention — habit compounds. The loop is the moat.</p>
        </>
      }
    />
  );
}
