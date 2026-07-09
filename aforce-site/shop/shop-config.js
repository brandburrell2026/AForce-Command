/* =====================================================================
   AFORCE — SHOP CONFIGURATION  (the "CMS")
   ---------------------------------------------------------------------
   MARKETING EDITS THIS FILE. Change copy, prices, CTAs, flavor text,
   recommendation defaults, and Delight-Moment strings here — no
   engineering required, no UI logic to touch. The shop page renders
   entirely from this object on load.

   RULES BAKED INTO THIS FILE (do not violate when editing):
   • Section 0 headline is LOCKED: "What are you preparing for?"
   • Protocol "why" overlays: lifestyle fit only. NEVER compare prices
     between tiers, never say one is cheaper / better value.
   • Flavor copy: positioning only. NEVER claim a flavor detects, treats,
     repairs, cures, or corrects anything. "Heat Guard optimized" and
     "Built for…" are the approved framing.
   • Checkout uses "Personalized Hydration Intelligence" verbatim.
   • No discounts, countdowns, urgency, or social-proof language anywhere
     in the purchase flow.
   ===================================================================== */
window.AFORCE_SHOP_CONFIG = {

  /* ---------- SECTION 0 — PRE-PROTOCOL INTENT ---------- */
  intent: {
    headlineLead: "What are you",              // locked lead
    headlineEm:   "preparing for?",            // locked emphasis
    subline: "Nobody here is buying a flavor. Choose the demand — the protocol answers.",
    // Each option pre-highlights a protocol + flavor in Sections A and C.
    // Pre-highlight only — never forces the choice.
    options: [
      { id:"training",    label:"Training",    protocol:"performance", flavor:"blue",  line:"Training points to the <b>Performance Protocol</b> and <b>Berry Blast</b>. Adjust anything — this is a suggestion, not a lock." },
      { id:"recovery",    label:"Recovery",    protocol:"performance", flavor:"green", line:"Recovery points to the <b>Performance Protocol</b> and <b>Soursop Edge</b>. Adjust anything — this is a suggestion, not a lock." },
      { id:"deepwork",    label:"Deep Work",   protocol:"performance", flavor:"blue",  line:"Deep Work points to the <b>Performance Protocol</b> and <b>Berry Blast</b>. Adjust anything — this is a suggestion, not a lock." },
      { id:"travel",      label:"Travel",      protocol:"autopilot",   flavor:"green", line:"Travel points to <b>AutoPilot</b> and <b>Soursop Edge</b>. Adjust anything — this is a suggestion, not a lock." },
      { id:"competition", label:"Competition", protocol:"performance", flavor:"red",   line:"Competition points to the <b>Performance Protocol</b> and <b>Watermelon Surge</b>. Adjust anything — this is a suggestion, not a lock." },
      { id:"heat",        label:"Heat",        protocol:"performance", flavor:"red",   line:"Heat points to the <b>Performance Protocol</b> and <b>Watermelon Surge</b>. Adjust anything — this is a suggestion, not a lock." }
    ]
  },

  /* ---------- BRAND SHOWCASE (below hero) — visual only, NOT a purchase path ----------
     Renders the three formulations (same as Section C) as large cinematic can
     renders. A brand section; buying always happens through the guided flow. */
  showcase: {
    heading: "The Formulations",
    subline: "Three formulations, one standard. This is the product — choose yours inside the flow below."
  },

  /* Representative can shown on each Protocol card, tying each pack to the
     physical product. Per-protocol `cardImage` overrides this default. */
  signatureCan: "/assets/can-blue.png",

  /* ---------- SECTION A — PROTOCOL SELECTION ---------- */
  protocolsHeading: "Choose Your Performance Protocol",
  protocols: [
    {
      id:"trial",
      name:"Trial Protocol",
      pack:"6-Pack",
      cardImage:"/assets/stick-red.png",   // mix drinks + sticks across the cards
      lines:["Experience AFORCE."],
      price:32.99,
      priceNote:"",
      cardCta:"Begin",                 // card-level select CTA
      purchaseCta:"Begin the Ritual",  // final Section D button
      why:"For your first experience. Try AFORCE before committing to a full routine. No subscription, no obligation. Just your first ritual."
    },
    {
      id:"performance",
      name:"Performance Protocol",
      pack:"12-Pack",
      cardImage:"/assets/can-blue.png",   // hero can stays on the most-chosen card
      lines:["Most chosen.","Built for daily execution."],
      price:59.99,
      priceNote:"",
      cardCta:"Choose Protocol",
      purchaseCta:"Continue",
      why:"Built for people who want hydration to become part of a consistent performance routine. Includes AFORCE OS access and is designed to support a daily ritual rather than occasional use."
    },
    {
      id:"autopilot",
      name:"AutoPilot",
      pack:"12-Pack Subscription",
      cardImage:"/assets/stick-green.png",   // mix drinks + sticks across the cards
      lines:["Ships every 30 days.","Includes AFORCE OS."],
      price:54.99,
      priceNote:"per 30 days",
      cardCta:"Activate AutoPilot",
      purchaseCta:"Activate My Protocol",
      why:"For people who have decided. Ships every 30 days so you never break your ritual. Includes full AFORCE OS access. Your performance system runs itself."
    }
  ],
  whyLinkLabel: "Why this protocol?",

  /* ---------- SECTION B — COMMITMENT (replaces quantity) ---------- */
  commitment: {
    question:"How many months should we prepare?",
    options:[
      { value:1, label:"One Month" },
      { value:2, label:"Two Months" },
      { value:3, label:"Three Months" }
    ]
  },

  /* ---------- SECTION C — FLAVOR SELECTION ---------- */
  flavorsHeading: "Select Your Formulation",
  flavors: [
    { id:"red",   name:"Watermelon Surge", desc:"Heat Guard optimized. Built for high heat and high activity days.", img:"/assets/can-red.png" },
    { id:"blue",  name:"Berry Blast",      desc:"Daily performance. Your consistent foundation.",                   img:"/assets/can-blue.png" },
    { id:"green", name:"Soursop Edge",     desc:"Recovery. Built for your hardest recovery days.",                  img:"/assets/can-green.png" }
  ],

  /* ---------- BRAND SHOWCASE — STICKS (below the cans, visual only) ----------
     The travel format of the same three formulations. Visual brand section,
     mirrors "The Formulations"; buying still happens in the guided flow. */
  sticksShowcase: {
    heading: "The Sticks",
    subline: "The same formulations, portable. Drop a stick into any water and the ritual travels with you."
  },
  sticks: [
    { id:"red",   name:"Watermelon Surge", desc:"Heat Guard optimized. For high heat and high activity — anywhere.", img:"/assets/stick-red.png" },
    { id:"blue",  name:"Berry Blast",      desc:"Daily performance. Your consistent foundation, on the move.",       img:"/assets/stick-blue.png" },
    { id:"green", name:"Soursop Edge",     desc:"Recovery. For your hardest recovery days, on the road.",            img:"/assets/stick-green.png" }
  ],

  /* ---------- SECTION D — PURCHASE ---------- */
  purchase: {
    // Per-protocol CTA labels live on each protocol (purchaseCta).
    // Fallback if a protocol has none:
    fallbackCta:"Begin the Ritual",
    // Shown under the button — confidence, never urgency.
    reassurance:"AFORCE OS activates the moment your Performance Profile is initialized."
  },

  /* ---------- SECTION I — DELIGHT MOMENTS (copy the flow uses) ---------- */
  delight: {
    recommendedRibbon:"Recommended",
    intentPrompt:"Selected. Your protocol and formulation are pre-highlighted below.",
    changeableNote:"Everything stays changeable."
  }
};
