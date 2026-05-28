import EditorialSlide from "@/components/EditorialSlide";

export default function Subscription() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={9}
      eyebrow="The Subscription Ecosystem"
      heroSrc={`${base}images/bg/09-subscription.png`}
      headline={
        <>
          <div>Recurring</div>
          <div>behavior.</div>
          <div className="text-blue font-normal">Recurring revenue.</div>
        </>
      }
      footer={
        <>
          <p>Core — free. The ritual. Daily readiness.</p>
          <p>Professionals Mode — $14.99/mo. Coaching and recovery.</p>
          <p>Professionals Membership — $64.99/mo. Allotment and access.</p>
          <p>Three tiers. One ecosystem. Behavior precedes pricing.</p>
        </>
      }
    />
  );
}
