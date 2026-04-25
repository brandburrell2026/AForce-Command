const COLOR_BORDER: Record<string, string> = {
  primary: "border-primary",
  blue: "border-blue",
  accent: "border-accent",
};
const COLOR_TEXT: Record<string, string> = {
  primary: "text-primary",
  blue: "text-blue",
  accent: "text-accent",
};
const COLOR_RING: Record<string, string> = {
  primary: "ring-primary/60",
  blue: "ring-blue/60",
  accent: "ring-accent/60",
};

export default function Leaders() {
  const base = import.meta.env.BASE_URL;
  const leaders = [
    {
      name: "Brandon Burrell",
      role: "Founder",
      color: "primary",
      photo: `${base}brandon.jpg`,
      bio: "18+ years of global business leadership. Started his career in finance at Morgan Stanley before leading international operations across Southeast Asia in hospitality and food.",
    },
    {
      name: "Julius Burrell",
      role: "Co-Founder",
      color: "primary",
      photo: `${base}julius.jpg`,
      bio: "Powerhouse in operations and logistics with a proven ability to scale production and supply chains from the ground up — overseeing high-volume distribution and operational execution.",
    },
    {
      name: "Mark Mendel",
      role: "Advisor",
      color: "blue",
      photo: `${base}mark-mendel.jpg`,
      bio: "30 years across biotech, life sciences, and medical devices. Seasoned Managing Director, Venture Partner, and Biomedical Engineer with a PhD from the University of Pennsylvania.",
    },
    {
      name: "Adam Sobol",
      role: "Advisor",
      color: "blue",
      photo: `${base}adam.jpg`,
      bio: "SVP, Head of Marketing at BECU. Transformational marketing leader across fintech, financial services, business and social impact. Advisor, speaker, and board member.",
    },
    {
      name: "Thomas Mastrobuoni",
      role: "Advisor",
      color: "blue",
      photo: `${base}thomas.jpg`,
      bio: "Chief Investment Officer at Big Idea Ventures — Generation Food Rural Partners, New Protein Fund, Global Food Innovation Fund.",
    },
    {
      name: "Mark Satterfield",
      role: "Chief Scientist",
      color: "accent",
      photo: `${base}mark-satterfield.png`,
      bio: "35+ years creating top beverage companies in the world, including formative work at Starbucks. Chief product mind behind AForce's alkaline platform.",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">21 — Our Leaders</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">21 / 22</div>
      </div>

      <div className="absolute top-[13vh] left-[6vw] right-[6vw]">
        <div className="flex items-center gap-[1.2vw] mb-[1.6vh]">
          <div className="h-[2px] w-[5vw] bg-primary" />
          <span className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">The Team</span>
        </div>
        <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter text-balance">
          Our <span className="text-primary">leaders.</span>
        </h2>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] grid grid-cols-3 gap-[1.6vw]">
        {leaders.map((l, i) => (
          <div key={i} className={`bg-bg-elev rounded-lg p-[1.4vw] border-t-2 ${COLOR_BORDER[l.color]}`}>
            <div className="flex items-center gap-[1.2vw] mb-[1.2vh]">
              <div className={`w-[5.6vw] h-[5.6vw] rounded-full overflow-hidden ring-2 ${COLOR_RING[l.color]} ring-offset-2 ring-offset-bg-elev shrink-0 bg-bg`}>
                <img
                  src={l.photo}
                  alt={l.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[1.5vw] text-text leading-tight truncate">{l.name}</div>
                <div className={`font-body text-[0.95vw] ${COLOR_TEXT[l.color]} uppercase tracking-[0.22em] mt-[0.4vh]`}>{l.role}</div>
              </div>
            </div>
            <div className="h-[1px] bg-divider mb-[1vh]" />
            <div className="font-body text-[0.95vw] text-text/70 leading-snug">{l.bio}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
