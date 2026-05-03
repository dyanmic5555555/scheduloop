import { getDemandColumnForRole } from "./roleDemand.js";

export const CSV_DEMAND_MODEL_VERSION = 2;

export function isCurrentCsvDemandModel(csvDemand) {
  return csvDemand?.modelVersion === CSV_DEMAND_MODEL_VERSION;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampWeight(value) {
  const num = safeNumber(value, 0);
  return Math.min(Math.max(num, 0), 0.9);
}

export function getCsvTrustWeight({
  usableCsvDays = 0,
  weekdaySampleSize = 0,
  totalRows = 0,
  hasWeekdayData = false,
} = {}) {
  const days = Math.max(0, safeNumber(usableCsvDays, 0));
  const weekdaySamples = Math.max(0, safeNumber(weekdaySampleSize, 0));
  const rows = Math.max(0, safeNumber(totalRows, 0));

  if (days <= 0 || rows <= 0) return 0;

  let weight = 0.25;
  if (days >= 90) {
    weight = 0.9;
  } else if (days >= 30) {
    weight = 0.75;
  } else if (days >= 7) {
    weight = 0.5;
  }

  if (weekdaySamples >= 6) {
    weight = Math.max(weight, 0.65);
  }

  if (!hasWeekdayData || weekdaySamples === 0) {
    weight = days >= 30 ? Math.min(weight, 0.6) : Math.min(weight, 0.35);
  }

  return clampWeight(weight);
}

export function getCsvBlendWeight({
  hasCsv,
  hasWeekdayData,
  weekdaySampleCount = 0,
  observedDays = 0,
  totalRows = 0,
}) {
  if (!hasCsv) return 0;
  return getCsvTrustWeight({
    usableCsvDays: observedDays,
    weekdaySampleSize: weekdaySampleCount,
    totalRows,
    hasWeekdayData,
  });
}

export function getCsvDemandUnitsForRole({
  csvDemand,
  role,
  weekday,
  slotIndex,
  useWeekdayData = false,
}) {
  if (!csvDemand?.demandSources || slotIndex < 0) return null;

  const source = getDemandColumnForRole(role, csvDemand.demandColumns);
  const sourceData = source?.key ? csvDemand.demandSources[source.key] : null;

  if (!sourceData?.fallbackUnits) return null;

  if (useWeekdayData) {
    const weekdayValue = sourceData.byWeekdayUnits?.[weekday]?.[slotIndex];
    if (typeof weekdayValue === "number") return weekdayValue;
  }

  const fallbackValue = sourceData.fallbackUnits?.[slotIndex];
  return typeof fallbackValue === "number" ? fallbackValue : null;
}

export function hasRoleSpecificDemandForRoles(csvDemand, roles = []) {
  if (!csvDemand?.demandColumns?.sources) return false;

  return roles.some((role) => {
    const source = getDemandColumnForRole(role, csvDemand.demandColumns);
    return !!source?.roleSpecific;
  });
}

export function calculateForecastConfidence({
  usableCsvDays = 0,
  weekdaySampleSize = 0,
  hasRoleSpecificDemand = false,
  hasStaffHistory = false,
  hasManagerFeedback = false,
  hasDayContext = false,
} = {}) {
  const days = Math.max(0, safeNumber(usableCsvDays, 0));
  const weekdaySamples = Math.max(0, safeNumber(weekdaySampleSize, 0));
  const reasons = [];

  let score = 15;

  if (days === 0) {
    reasons.push("No uploaded trading data yet");
  } else {
    score += Math.min(45, days >= 90 ? 45 : days >= 30 ? 35 : days >= 7 ? 22 : 10);
    reasons.push(`Based on ${days} observed day${days === 1 ? "" : "s"}`);
  }

  if (weekdaySamples > 0) {
    score += Math.min(20, weekdaySamples >= 6 ? 20 : weekdaySamples >= 3 ? 14 : 8);
    reasons.push(
      `Includes ${weekdaySamples} matching weekday sample${
        weekdaySamples === 1 ? "" : "s"
      }`
    );
  } else {
    reasons.push("No matching weekday samples yet");
  }

  if (hasRoleSpecificDemand) {
    score += 12;
    reasons.push("Includes role-specific demand columns");
  } else {
    reasons.push("No role-specific demand columns yet");
  }

  if (hasStaffHistory) {
    score += 8;
    reasons.push("Includes actual staffing history");
  }

  if (hasManagerFeedback) {
    score += 10;
    reasons.push("Includes manager feedback");
  } else {
    reasons.push("No manager feedback yet");
  }

  if (hasDayContext) {
    reasons.push("Context tags included using default assumptions");
  }

  const boundedScore = Math.min(100, Math.max(0, Math.round(score)));
  const level =
    days >= 30 &&
    weekdaySamples >= 4 &&
    (hasRoleSpecificDemand || hasStaffHistory || hasManagerFeedback)
      ? "High"
      : days >= 7
        ? "Medium"
        : "Low";

  return {
    level,
    score: boundedScore,
    reasons,
  };
}

export function getDemandConfidence(
  csvDemand,
  weekday,
  { hasManagerFeedback = false, hasDayContext = false } = {}
) {
  const weekdaySampleCount = csvDemand?.weekdaySampleCounts?.[weekday] || 0;
  const observedDays = csvDemand?.observedDays || 0;
  const confidence = calculateForecastConfidence({
    usableCsvDays: observedDays,
    weekdaySampleSize: weekdaySampleCount,
    hasRoleSpecificDemand: !!csvDemand?.hasRoleSpecificDemand,
    hasStaffHistory: (csvDemand?.actualStaffRows || 0) > 0,
    hasManagerFeedback,
    hasDayContext,
  });
  const contextReason = "Context tags included using default assumptions";

  if (!csvDemand?.rows) {
    return {
      label: confidence.level,
      detail: hasDayContext
        ? "Starter estimate based on your business profile. Context tags use default assumptions."
        : "Starter estimate based on your business profile.",
      level: confidence.level.toLowerCase(),
      score: confidence.score,
      reasons: confidence.reasons,
      weekdaySampleCount,
      observedDays,
    };
  }

  const detailReasons = confidence.reasons.slice(0, 2);
  if (hasDayContext && !detailReasons.includes(contextReason)) {
    detailReasons.push(contextReason);
  }

  return {
    label: confidence.level,
    detail: detailReasons.join(". ") + ".",
    level: confidence.level.toLowerCase(),
    score: confidence.score,
    reasons: confidence.reasons,
    weekdaySampleCount,
    observedDays,
  };
}
