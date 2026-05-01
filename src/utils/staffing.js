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
  role,
  absoluteIndex,
  peak,
  intervalMinutes = 60,
  operatingRules = {},
  forceMinimum = false,
}) {
  const safeDemand = Math.min(Math.max(Number(demand) || 0, 0), 1.5);
  const peakCount = normalizeStaffCount(peak);
  const minStaff = normalizeStaffCount(role?.minStaff);
  const serviceRate = normalizePositiveNumber(role?.serviceRate, 0);
  const demandWeight = normalizePositiveNumber(role?.demandWeight, 1);
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

  if (demandUnits !== null && serviceRate > 0) {
    const capacityPerStaffSlot = serviceRate * slotHours;
    const weightedDemand =
      normalizePositiveNumber(demandUnits, 0) *
      demandWeight *
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

  if ((forceMinimum || value > 0) && minStaff > 0) {
    value = Math.max(value, minStaff);
  }

  if (peakCount > 0) {
    value = Math.min(value, Math.max(peakCount, minStaff));
  }

  return value;
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
