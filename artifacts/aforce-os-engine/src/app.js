import { calculateHydrationTarget } from "./services/hydrationEngine.js";
import { generateCommand } from "./services/commandEngine.js";
import { onboardingCalculation } from "./services/aiCoachService.js";
import { julius } from "./data/sampleUsers.js";

const inventory = {
  rtdCans: 2,
  hydrationSticks: 10,
  canisterScoops: 20,
  fieldBag: true
};

console.log("AForce OS started.");

const target = calculateHydrationTarget(julius);
console.log("Hydration Target:", target);

const command = generateCommand("recovery", inventory);
console.log("AI Coach Command:", command);

const onboarding = onboardingCalculation(julius);
console.log("Onboarding Calculation:", onboarding);
