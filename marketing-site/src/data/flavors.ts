export type Flavor = {
  id: string;
  name: string;
  botanical: string;
  /** Brand-system accent for flavor coding. */
  color: string;
  can: string;
  canAlt: string;
  stick: string;
  stickAlt: string;
};

// Flavor coding: silver signals the brand, color signals the flavor.
// Colors are locked to the AForce Brand System v2.1.0.
// Two formats per flavor: 11 fl oz can + 8 g single-serve stick.
export const FLAVORS: Flavor[] = [
  {
    id: "soursop",
    name: "Soursop Edge",
    botanical: "Seamoss",
    color: "#1FA35A", // Soursop green
    can: "/cans/soursop.png",
    canAlt: "AForce Soursop Edge & Seamoss alkaline pH 8.8 silver can, front view.",
    stick: "/sticks/soursop.png",
    stickAlt: "AForce Soursop Edge & Seamoss single-serve silver stick pack, front view.",
  },
  {
    id: "watermelon",
    name: "Watermelon Surge",
    botanical: "Chlorella",
    color: "#C1281B", // Signal Red
    can: "/cans/watermelon.png",
    canAlt: "AForce Watermelon Surge & Chlorella alkaline pH 8.8 silver can, front view.",
    stick: "/sticks/watermelon.png",
    stickAlt: "AForce Watermelon Surge & Chlorella single-serve silver stick pack, front view.",
  },
  {
    id: "berry",
    name: "Berry Blast",
    botanical: "Dulse",
    color: "#1E5BFF", // Berry blue
    can: "/cans/berry.png",
    canAlt: "AForce Berry Blast & Dulse alkaline pH 8.8 silver can, front view.",
    stick: "/sticks/berry.png",
    stickAlt: "AForce Berry Blast & Dulse single-serve silver stick pack, front view.",
  },
];
