import EditorialSlide from "@/components/EditorialSlide";

export default function Founders() {
  const base = import.meta.env.BASE_URL;
  return (
    <EditorialSlide
      slide={11}
      eyebrow="The Founders"
      heroSrc={`${base}images/bg/11-founders.png`}
      headline={
        <>
          <div>Lived</div>
          <div>experience</div>
          <div className="text-blue font-normal">under pressure.</div>
        </>
      }
      footer={
        <>
          <p>Brandon Burrell — former NBA. Inside the moment-before-the-moment.</p>
          <p>Julius — Wall Street and entrepreneurship. Built systems under capital pressure.</p>
          <p>The product is built by people who have actually had to perform.</p>
          <p>NBA · Wall Street · Operators.</p>
        </>
      }
    />
  );
}
