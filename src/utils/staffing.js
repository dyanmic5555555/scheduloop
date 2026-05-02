import { getHourIndexForSlot } from "./schedule.js";

export function normalizeStaffCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

export function normalizePositiveNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function getRoleShapeFactor(role, absoluteIndex) {
  const curve = Array.isArray(role?.curve) ? role.curve : [];
  const numericCurve = curve.map((value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : 0;
  });
  const rawShapeVal = numericCurve[absoluteIndex] ?? 0;
  const maxRoleCurve = Math.max(...numericCurve, 0);
  const shapeFraction = maxRoleCurve > 0 ? rawShapeVal / maxRoleCurve : 1;

  return {
    rawShapeVal,
    roleShapeFactor: 0.5 + 0.5 * shapeFraction,
  };
}

export function calculateRoleStaff({
  demand,
  demandUnits = null,
  roleDemandUnits = null,
  role,
  absoluteIndex,
  peak,
  roleCount = 1,
  intervalMinutes = 60,
  operatingRules = {},
  forceMinimum = false,
  feedbackCorrection = 0,
}) {
  const safeDemand = Math.min(Math.max(Number(demand) || 0, 0), 1.5);
  const peakCount = normalizeStaffCount(peak);
  const configuredMin =
    role?.minStaff === undefined && role?.requiredDuringOpen
      ? 1
      : role?.minStaff;
  const minStaff = normalizeStaffCount(configuredMin);
  const maxStaff =
    normalizeStaffCount(role?.maxStaff) || peakCount || Math.max(minStaff, 5);
  const serviceRate = normalizePositiveNumber(
    role?.productivityPerHour ?? role?.serviceRate,
    25
  );
  const demandWeight = normalizePositiveNumber(role?.demandWeight, 1);
  const defaultDemandShare =
    role?.demandWeight === undefined ? 1 / Math.max(1, roleCount) : 1;
  const demandShare = normalizePositiveNumber(
    role?.demandShare,
    defaultDemandShare
  );
  const slotHours = Math.max(0.25, Number(intervalMinutes) / 60 || 1);
  const demandBuffer =
    normalizePositiveNumber(operatingRules.demandBufferPercent, 0) / 100;
  const breakAllowance =
    normalizePositiveNumber(operatingRules.breakAllowancePercent, 0) / 100;
  const bufferMultiplier = 1 + demandBuffer + breakAllowance;
  const { rawShapeVal, roleShapeFactor } = getRoleShapeFactor(
    role,
    absoluteIndex
  );

  let value = 0;
  const sourceDemandUnits =
    roleDemandUnits !== null && roleDemandUnits !== undefined
      ? roleDemandUnits
      : demandUnits;

  if (sourceDemandUnits !== null && serviceRate > 0) {
    const capacityPerStaffSlot = serviceRate * slotHours;
    // Absolute CSV demand is easiest to explain: expected units divided by the
    // number this role can handle in the selected time block.
    const weightedDemand =
      normalizePositiveNumber(sourceDemandUnits, 0) *
      demandWeight *
      demandShare *
      roleShapeFactor *
      bufferMultiplier;
    value =
      weightedDemand <= 0 ? 0 : Math.max(1, Math.ceil(weightedDemand / capacityPerStaffSlot));
  } else if (safeDemand >= 0.01 && peakCount > 0) {
    const raw = safeDemand * peakCount * roleShapeFactor * bufferMultiplier;
    value = raw <= 0 ? 0 : Math.max(1, Math.round(raw));
  } else if (safeDemand >= 0.01) {
    const fallback = safeDemand * rawShapeVal * bufferMultiplier;
    value = fallback <= 0 ? 0 : Math.max(1, Math.round(fallback));
  }

  if (
    (forceMinimum || value > 0 || (role?.requiredDuringOpen && safeDemand > 0)) &&
    minStaff > 0
  ) {
    value = Math.max(value, minStaff);
  }

  const correctionValue = Number(feedbackCorrection);
  const correction = Number.isFinite(correctionValue)
    ? Math.round(correctionValue)
    : 0;
  if (correction !== 0 && (value > 0 || correction > 0)) {
    value += correction;
  }

  return Math.max(0, Math.min(Math.max(maxStaff, minStaff), value));
}

export function applyMinimumTotalStaff(point, roles, minimumTotal) {
  const minTotal = normalizeStaffCount(minimumTotal);
  if (minTotal <= 0 || point.total >= minTotal || roles.length === 0) {
    return point;
  }

  const preferredRole =
    roles.find((role) => role.requiredDuringOpen) || roles[0];
  const gap = minTotal - point.total;

  return {
    ...point,
    [preferredRole.id]: (point[preferredRole.id] || 0) + gap,
    total: minTotal,
  };
}

export function calculateBacktestSummary(chartData, csvDemand, weekday) {
  if (!csvDemand?.slotLabels || !chartData?.length) {
    return null;
  }

  const weekdayActual = csvDemand.actualStaffByWeekday?.[weekday] || [];
  const fallbackActual = csvDemand.actualStaffFallback || [];
  const comparisons = [];

  chartData.forEach((point) => {
    const slotIndex = csvDemand.slotLabels.indexOf(point.hour);
    if (slotIndex === -1) return;

    const actual =
      weekdayActual[slotIndex] !== null && weekdayActual[slotIndex] !== undefined
        ? weekdayActual[slotIndex]
        : fallbackActual[slotIndex];

    if (actual === null || actual === undefined) return;

    comparisons.push({
      predicted: point.total || 0,
      actual,
      error: (point.total || 0) - actual,
    });
  });

  if (comparisons.length === 0) return null;

  const absoluteError = comparisons.reduce(
    (sum, item) => sum + Math.abs(item.error),
    0
  );
  const underStaffedBlocks = comparisons.filter(
    (item) => item.error < -0.5
  ).length;
  const overStaffedBlocks = comparisons.filter((item) => item.error > 0.5)
    .length;

  return {
    blocksCompared: comparisons.length,
    meanAbsoluteError: absoluteError / comparisons.length,
    underStaffedBlocks,
    overStaffedBlocks,
  };
}

function averageSlotDemand(days, slotIndex, weekday) {
  const matchingWeekdayDays = days.filter((day) => day.weekday === weekday);
  const trainingDays =
    matchingWeekdayDays.length > 0 ? matchingWeekdayDays : days;
  const values = trainingDays
    .map((day) => day.demandUnits?.[slotIndex])
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateTotalStaffForDemand({
  demandUnits,
  maxTrainingDemand,
  roles,
  slotLabel,
  intervalMinutes,
  operatingRules,
  peakStaff,
}) {
  const demandScore =
    maxTrainingDemand > 0 ? Math.min(demandUnits / maxTrainingDemand, 1.5) : 0;

  return roles.reduce((sum, role) => {
    const roleStaff = calculateRoleStaff({
      demand: demandScore,
      demandUnits,
      role,
      absoluteIndex: getHourIndexForSlot(slotLabel),
      peak: peakStaff?.[role.id],
      roleCount: roles.length,
      intervalMinutes,
      operatingRules,
      forceMinimum: !!role.requiredDuringOpen && demandScore > 0,
    });

    return sum + roleStaff;
  }, 0);
}

export function runForecastBacktest({
  historicalData,
  roles = [],
  businessProfile = {},
} = {}) {
  const dailyDemandByDate = historicalData?.dailyDemandByDate || {};
  const days = Object.entries(dailyDemandByDate)
    .map(([date, day]) => ({ date, ...day }))
    .filter((day) => Array.isArray(day.demandUnits))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (days.length < 7 || roles.length === 0) {
    return {
      status: "not_enough_data",
      summary: "Backtest needs at least 7 observed days of CSV data.",
      sampleSize: days.length,
    };
  }

  const splitIndex = Math.max(1, Math.floor(days.length * 0.75));
  const trainingDays = days.slice(0, splitIndex);
  const testDays = days.slice(splitIndex);
  const slotLabels = historicalData.slotLabels || [];
  const intervalMinutes = historicalData.intervalMinutes || 60;
  const operatingRules = businessProfile.operatingRules || {};
  const peakStaff = businessProfile.peakStaff || {};
  const maxTrainingDemand = trainingDays.reduce((max, day) => {
    const dayMax = (day.demandUnits || [])
      .filter((value) => Number.isFinite(value))
      .reduce((innerMax, value) => Math.max(innerMax, value), 0);
    return Math.max(max, dayMax);
  }, 0);

  const demandErrors = [];
  const staffErrors = [];
  const peakStaffErrors = [];
  let understaffed = 0;
  let overstaffed = 0;

  testDays.forEach((day) => {
    slotLabels.forEach((slotLabel, slotIndex) => {
      const actualDemand = day.demandUnits?.[slotIndex];
      if (!Number.isFinite(actualDemand)) return;

      const predictedDemand = averageSlotDemand(
        trainingDays,
        slotIndex,
        day.weekday
      );
      demandErrors.push(Math.abs(predictedDemand - actualDemand));

      const actualStaff = day.actualStaff?.[slotIndex];
      if (!Number.isFinite(actualStaff)) return;

      const predictedStaff = estimateTotalStaffForDemand({
        demandUnits: predictedDemand,
        maxTrainingDemand,
        roles,
        slotLabel,
        intervalMinutes,
        operatingRules,
        peakStaff,
      });
      const staffError = predictedStaff - actualStaff;
      staffErrors.push(Math.abs(staffError));

      if (actualDemand >= maxTrainingDemand * 0.7) {
        peakStaffErrors.push(Math.abs(staffError));
      }

      if (staffError < -0.5) understaffed += 1;
      if (staffError > 0.5) overstaffed += 1;
    });
  });

  if (demandErrors.length === 0) {
    return {
      status: "not_enough_data",
      summary: "Backtest needs usable demand rows in the test period.",
      sampleSize: days.length,
    };
  }

  const average = (values) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const staffSampleSize = staffErrors.length;
  const averageStaffError = average(staffErrors);

  return {
    status: "ready",
    averageDemandError: average(demandErrors),
    averageStaffError,
    peakHourStaffError: average(peakStaffErrors),
    understaffingRisk: staffSampleSize ? understaffed / staffSampleSize : null,
    overstaffingRisk: staffSampleSize ? overstaffed / staffSampleSize : null,
    sampleSize: days.length,
    summary:
      averageStaffError === null
        ? `Backtest compared demand across ${days.length} observed days.`
        : `Backtest: usually within ${averageStaffError.toFixed(
            1
          )} staff per hour based on ${days.length} observed days.`,
  };
}
