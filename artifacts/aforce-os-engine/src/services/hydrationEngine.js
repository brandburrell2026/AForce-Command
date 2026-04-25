export function calculateHydrationTarget(profile) {
  const {
    weightLbs,
    heightFeet,
    heightInches,
    biologicalSex,
    age,
    activityType = "rest",
    activeMinutes = 0,
    climateType = "temperate",
    alcoholDrinks = 0,
    heatConditionActive = false
  } = profile;

  const totalHeightInches = heightFeet * 12 + heightInches;

  let dailyOz = weightLbs / 2;

  if (biologicalSex === "male") {
    const maleThreshold = 68;
    dailyOz += totalHeightInches > maleThreshold
      ? (totalHeightInches - maleThreshold) * 4
      : (totalHeightInches - maleThreshold) * 3;
  }

  if (biologicalSex === "female") {
    const femaleThreshold = 64;
    dailyOz += totalHeightInches > femaleThreshold
      ? (totalHeightInches - femaleThreshold) * 4
      : (totalHeightInches - femaleThreshold) * 3;

    dailyOz -= 8;
  }

  if (age > 50) dailyOz += 4;

  let baselineUnits = Math.ceil(dailyOz / 12);

  let activityUnits = 0;

  if (activityType === "light") {
    activityUnits = Math.ceil(activeMinutes / 30) * 1;
  }

  if (activityType === "moderate") {
    activityUnits = Math.ceil(activeMinutes / 30) * 1.5;
  }

  if (activityType === "heavy") {
    activityUnits = Math.ceil(activeMinutes / 30) * 2;
  }

  let environmentalUnits = 0;

  if (climateType === "hot_humid") environmentalUnits += 1;
  if (climateType === "hot_dry") environmentalUnits += 0.5;
  if (climateType === "cold") environmentalUnits -= 0.5;

  if (heatConditionActive) {
    environmentalUnits += 1;
  }

  const alcoholUnits = alcoholDrinks * 0.5;

  const totalUnits = Math.ceil(
    baselineUnits + activityUnits + environmentalUnits + alcoholUnits
  );

  return {
    dailyOz: Math.round(dailyOz),
    baselineUnits,
    activityUnits,
    environmentalUnits,
    alcoholUnits,
    totalUnits,
    restDayUnits: baselineUnits,
    trainingDayUnits: totalUnits
  };
}
