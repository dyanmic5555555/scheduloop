export function getCsvBlendWeight({
  hasCsv,
  hasWeekdayData,
  weekdaySampleCount = 0,
  observedDays = 0,
}) {
  if (!hasCsv) return 0;

  if (hasWeekdayData) {
    if (weekdaySampleCount >= 6) return 0.9;
    if (weekdaySampleCount >= 4) return 0.8;
    if (weekdaySampleCount >= 2) return 0.65;
    return 0.5;
  }

  if (observedDays >= 21) return 0.45;
  if (observedDays >= 7) return 0.35;
  return 0.25;
}

export function getDemandConfidence(csvDemand, weekday) {
  if (!csvDemand?.rows) {
    return {
      label: "Preset",
      detail: "No uploaded trading data yet.",
      level: "preset",
      weekdaySampleCount: 0,
      observedDays: 0,
    };
  }

  const weekdaySampleCount = csvDemand.weekdaySampleCounts?.[weekday] || 0;
  const observedDays = csvDemand.observedDays || 0;

  if (weekdaySampleCount >= 6) {
    return {
      label: "High",
      detail: `${weekdaySampleCount} matching weekdays in ${observedDays} observed days.`,
      level: "high",
      weekdaySampleCount,
      observedDays,
    };
  }

  if (weekdaySampleCount >= 3) {
    return {
      label: "Medium",
      detail: `${weekdaySampleCount} matching weekdays; still validate against real rotas.`,
      level: "medium",
      weekdaySampleCount,
      observedDays,
    };
  }

  if (weekdaySampleCount >= 1) {
    return {
      label: "Low",
      detail: `${weekdaySampleCount} matching weekday; using more preset fallback.`,
      level: "low",
      weekdaySampleCount,
      observedDays,
    };
  }

  return {
    label: "Low",
    detail: `${observedDays} observed days, but none match this weekday.`,
    level: "low",
    weekdaySampleCount,
    observedDays,
  };
}
