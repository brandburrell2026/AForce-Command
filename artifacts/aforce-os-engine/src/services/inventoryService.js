export function decrementInventory(inventory, productType) {
  const updated = { ...inventory };

  if (productType === "rtd" && updated.rtdCans > 0) updated.rtdCans -= 1;
  if (productType === "stick" && updated.hydrationSticks > 0) updated.hydrationSticks -= 1;
  if (productType === "canister" && updated.canisterScoops > 0) updated.canisterScoops -= 1;

  return updated;
}

export function getAvailableProduct(inventory) {
  if (inventory.rtdCans > 0) return "rtd";
  if (inventory.hydrationSticks > 0) return "stick";
  if (inventory.canisterScoops > 0) return "canister";
  return "water_only";
}

export function getRestockAlerts(inventory) {
  const alerts = [];

  if (inventory.rtdCans === 0) alerts.push("AForce RTD Cans");
  if (inventory.hydrationSticks === 0) alerts.push("AForce Hydration Sticks");
  if (inventory.canisterScoops === 0) alerts.push("AForce Canister");

  return alerts;
}
