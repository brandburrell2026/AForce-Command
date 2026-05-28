import EditorialSlide from "@/components/EditorialSlide";

export default function TheOS() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={7}
      eyebrow="The OS"
      heroSrc={`${base}images/bg/07-os.png`}
      headline={
        <>
          <div>Human first.</div>
          <div className="text-blue font-normal">System second.</div>
        </>
      }
      footer={
        <>
          <p>Human — the OS adapts to the person. Never the reverse.</p>
          <p>Quiet — it reinforces ritual without demanding attention.</p>
          <p>Honest — only completed behavior moves the score.</p>
          <p>Compounding — every cycle strengthens the next.</p>
        </>
      }
    />
  );
}
