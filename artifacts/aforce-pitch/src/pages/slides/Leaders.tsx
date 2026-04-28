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
      bio: "Founder-operator with a background in finance and global business operations, including experience at Morgan Stanley and leadership roles across Southeast Asia. Has built and scaled international businesses in high-performance environments, with a focus on systems, execution, and consistency under pressure. AForce Hydration reflects that philosophy — building a performance system, not just a product.",
    },
    {
      name: "Julius Burrell",
      role: "Co-Founder",
      color: "primary",
      photo: `${base}julius.jpg`,
      bio: "Co-founder and systems builder with experience across product development and international business environments. Leads the development of AForce OS, translating hydration and behavior into structured, scalable performance systems. His work ensures AForce operates as an integrated platform across product, technology, and global growth.",
    },
    {
      name: "Mark Mendel",
      role: "Advisor",
      color: "blue",
      photo: `${base}mark-mendel.jpg`,
      bio: "Biotechnology and life sciences executive with over 30 years of experience across venture capital, product development, and company building. Advises early-stage companies on strategy, fundraising, and scientific validation, and brings deep expertise in translating innovation into scalable businesses.",
    },
    {
      name: "Adam Sobol",
      role: "Advisor",
      color: "blue",
      photo: `${base}adam.jpg`,
      bio: "Senior marketing and customer experience leader with over 20 years of experience driving growth across financial services and global organizations. Leads marketing at BECU and brings deep expertise in acquisition, retention, and business transformation, helping AForce scale its go-to-market and customer growth strategy.",
    },
    {
      name: "Thomas Mastrobuoni",
      role: "Advisor",
      color: "blue",
      photo: `${base}thomas.jpg`,
      bio: "Chief Investment Officer at Big Idea Ventures — Generation Food Rural Partners, New Protein Fund, Global Food Innovation Fund.",
    },
    {
      name: "Kristel van Kleef",
      role: "Advisor",
      color: "blue",
      photo: `${base}kristel.jpg`,
      bio: "20+ years building category-defining brands at global scale. 14 years at Red Bull driving culture-led growth across North America and globally, followed by executive brand leadership at one of the most disruptive performance brands, On. Her work spans brand building, athlete partnerships, and scaling premium performance products across 80+ markets.",
    },
    {
      name: "Peter Ingwersen",
      role: "Advisor",
      color: "blue",
      photo: `${base}peter.jpg`,
      bio: "35+ years building and repositioning global brands through strategic disruption and cultural insight. 20 years at Levi's across multiple leadership roles, including pioneering sustainability initiatives in 2005 with the NOIR concept. In addition, Peter has advised many of the world's leading lifestyle brands, from luxury houses to high street. A recognized thought leader and brand maverick, he specializes in defining clear, differentiated narratives by aligning business strategy with zeitgeist and human behavior.",
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex justify-between items-center z-10">
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-primary font-semibold">23 — Team</div>
        <div className="font-body uppercase tracking-[0.32em] text-[1.5vw] text-muted">23 / 24</div>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-center gap-[1vw]">
        <div className="h-[2px] w-[4vw] bg-primary" />
        <span className="font-body uppercase tracking-[0.32em] text-[1.2vw] text-primary font-semibold">The Team</span>
        <h2 className="font-display text-[1.8vw] leading-none tracking-tight ml-[0.6vw]">
          Our <span className="text-primary">leaders.</span>
        </h2>
      </div>

      <div className="absolute top-[18vh] bottom-[4vh] left-[6vw] right-[6vw] grid grid-cols-3 auto-rows-fr gap-[1.2vw]">
        {leaders.map((l, i) => {
          const isLastOrphan = leaders.length % 3 === 1 && i === leaders.length - 1;
          return (
          <div key={i} className={`bg-bg-elev rounded-lg p-[1vw] border-t-2 ${COLOR_BORDER[l.color]} ${isLastOrphan ? "col-start-2" : ""} flex flex-col min-h-0`}>
            <div className="flex items-center gap-[0.9vw] mb-[0.8vh]">
              <div className={`w-[3.8vw] h-[3.8vw] rounded-full overflow-hidden ring-2 ${COLOR_RING[l.color]} ring-offset-2 ring-offset-bg-elev shrink-0 bg-bg`}>
                <img
                  src={l.photo}
                  alt={l.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[1.25vw] text-text leading-tight truncate">{l.name}</div>
                <div className={`font-body text-[0.78vw] ${COLOR_TEXT[l.color]} uppercase tracking-[0.22em] mt-[0.3vh]`}>{l.role}</div>
              </div>
            </div>
            <div className="h-[1px] bg-divider mb-[0.7vh]" />
            <div className="font-body text-[0.72vw] text-text/70 leading-[1.35] overflow-hidden">{l.bio}</div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
