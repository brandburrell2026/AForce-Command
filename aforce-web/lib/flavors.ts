export type Flavor = {
  id: string;
  name: string;
  botanical: string;
  color: string;
  can: string;
  stick: string;
  alt: string;
};

// Silver signals the brand; color signals the flavor. Locked to v2.1.0.
export const FLAVORS: Flavor[] = [
  {
    id: "soursop",
    name: "Soursop Edge",
    botanical: "Seamoss",
    color: "#1FA35A",
    can: "/cans/soursop.png",
    stick: "/sticks/soursop.png",
    alt: "AForce Soursop Edge & Seamoss alkaline pH 8.8 silver can, front view.",
  },
  {
    id: "watermelon",
    name: "Watermelon Surge",
    botanical: "Chlorella",
    color: "#C1281B",
    can: "/cans/watermelon.png",
    stick: "/sticks/watermelon.png",
    alt: "AForce Watermelon Surge & Chlorella alkaline pH 8.8 silver can, front view.",
  },
  {
    id: "berry",
    name: "Berry Blast",
    botanical: "Dulse",
    color: "#1E5BFF",
    can: "/cans/berry.png",
    stick: "/sticks/berry.png",
    alt: "AForce Berry Blast & Dulse alkaline pH 8.8 silver can, front view.",
  },
];
