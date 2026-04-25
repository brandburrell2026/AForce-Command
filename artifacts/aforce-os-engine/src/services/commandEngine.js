import { getAvailableProduct } from "./inventoryService.js";

export function generateCommand(state, inventory) {
  const product = getAvailableProduct(inventory);

  if (state === "clear") {
    return "Drink 12 oz of spring water or alkaline water now. You are on pace. Spring water is your best baseline hydration between AForce sessions.";
  }

  if (state === "balanced") {
    if (product === "rtd") return "Drink 1 AForce RTD can now. No mixing required. You are on pace and this keeps you there. Follow with 12 oz of spring water.";
    if (product === "stick") return "Mix 1 AForce stick with 12 oz of spring water or alkaline water now. Maintain your balance.";
    if (product === "canister") return "Mix 1 AForce scoop with 12 oz of spring water now. You are balanced. Hold it.";
    return "Drink 12 oz of spring water or alkaline water now. Your AForce supply is low. Restock before your next session.";
  }

  if (state === "recovery") {
    if (product === "rtd") return "Drink 1 AForce RTD can right now. You are in Recovery. No mixing required. Fastest correction available. Follow with 12 oz of spring water in 20 minutes.";
    if (product === "stick") return "Mix 1 AForce stick with 12 oz of spring water or alkaline water now. You are in Recovery. Recheck in 20 minutes.";
    if (product === "canister") return "Mix 1 AForce scoop with 12 oz of spring water now. Recovery window is open. Recheck in 20 minutes.";
    return "Drink 16 oz of spring water or alkaline water now. You are in Recovery. Order AForce RTD cans. Fastest correction, no mixing required.";
  }

  if (state === "depleted") {
    if (inventory.rtdCans > 0 && inventory.hydrationSticks > 0) {
      return "Drink 1 AForce RTD can now. Follow with 1 AForce stick in 20 minutes. Drink 12 oz of spring water between them. You need all three.";
    }

    if (product === "rtd") return "Drink 1 AForce RTD can immediately. You are Depleted. No mixing required. Open it now. Follow with 16 oz of spring water in the next 30 minutes.";
    if (product === "stick") return "Mix 1 AForce stick with 20 oz of spring water now. Depleted state. Do not wait.";
    if (product === "canister") return "Mix 1 AForce scoop with 20 oz of spring water immediately. You are Depleted. This is urgent.";
    return "Drink 20 oz of spring water or alkaline water immediately. You are Depleted. Reorder AForce RTD cans now. No mixing required, fastest recovery.";
  }

  return "Drink 12 oz of spring water now. Recheck your status shortly.";
}

export function appendAlcoholCompliance(command) {
  return `${command} Estimated only. If you have been drinking, do not drive.`;
}
