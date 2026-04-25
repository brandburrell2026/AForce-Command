import { calculateHydrationTarget } from "../services/hydrationEngine.js";
import { generateCommand } from "../services/commandEngine.js";
import { decrementInventory, getRestockAlerts } from "../services/inventoryService.js";
import { getSocialState } from "../services/socialModeService.js";
import { julius, femaleTestUser } from "../data/sampleUsers.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`PASSED: ${message}`);
}

const juliusResult = calculateHydrationTarget(julius);
console.log("Julius Result:", juliusResult);

assert(juliusResult.restDayUnits === 13, "Julius rest day target should be approximately 13 units");
assert(juliusResult.trainingDayUnits >= 17, "Julius heavy training day should be approximately 17 units");

const femaleResult = calculateHydrationTarget(femaleTestUser);
console.log("Female Result:", femaleResult);

assert(femaleResult.restDayUnits === 5, "130 lb female rest day should be approximately 5 units");
assert(femaleResult.trainingDayUnits >= 6, "130 lb female active day should be approximately 6 units");

const inventory = {
  rtdCans: 1,
  hydrationSticks: 2,
  canisterScoops: 3,
  fieldBag: true
};

const command = generateCommand("depleted", inventory);
assert(command.includes("AForce RTD"), "Depleted state should prioritize RTD if available");

const updatedInventory = decrementInventory(inventory, "rtd");
assert(updatedInventory.rtdCans === 0, "RTD inventory should decrement to zero");

const restockAlerts = getRestockAlerts(updatedInventory);
assert(restockAlerts.includes("AForce RTD Cans"), "Restock alert should fire when RTD hits zero");

assert(getSocialState(0.04) === "moderate", "BAC 0.04 should be Moderate");
assert(getSocialState(0.09) === "high", "BAC 0.09 should be High");
assert(getSocialState(0.16) === "critical", "BAC 0.16 should be Critical");

console.log("All AForce OS final system tests passed.");
