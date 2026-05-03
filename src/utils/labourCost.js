export function normalizeHourlyWage(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;

  return Math.round(num * 100) / 100;
}

function getSlotHours(intervalMinutes) {
  const minutes = Number(intervalMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return 1;
  return minutes / 60;
}

export function calculateLabourCostEstimate({
  chartData = [],
  roles = [],
  intervalMinutes = 60,
  averageHourlyWage = null,
}) {
  const slotHours = getSlotHours(intervalMinutes);
  const fallbackWage = normalizeHourlyWage(averageHourlyWage);
  const totalStaffHours =
    chartData.reduce((sum, point) => sum + (Number(point.total) || 0), 0) *
    slotHours;
  let estimatedCost = 0;
  let coveredStaffHours = 0;
  let uncoveredStaffHours = 0;
  let rolesWithWages = 0;

  roles.forEach((role) => {
    const roleHours =
      chartData.reduce((sum, point) => sum + (Number(point[role.id]) || 0), 0) *
      slotHours;
    const roleWage = normalizeHourlyWage(role.hourlyWage);
    const wage = roleWage ?? fallbackWage;

    if (roleWage !== null) {
      rolesWithWages += 1;
    }

    if (wage === null) {
      uncoveredStaffHours += roleHours;
      return;
    }

    coveredStaffHours += roleHours;
    estimatedCost += roleHours * wage;
  });

  const hasWage = fallbackWage !== null || rolesWithWages > 0;

  return {
    hasWage,
    estimatedCost: hasWage ? Math.round(estimatedCost * 100) / 100 : null,
    totalStaffHours: Math.round(totalStaffHours * 100) / 100,
    coveredStaffHours: Math.round(coveredStaffHours * 100) / 100,
    uncoveredStaffHours: Math.round(uncoveredStaffHours * 100) / 100,
    averageHourlyWage: fallbackWage,
    rolesWithWages,
    usesRoleWages: rolesWithWages > 0,
  };
}

export function formatCurrencyGBP(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "£0";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: Number.isInteger(num) ? 0 : 2,
  }).format(num);
}

export function getLabourCostDetail(estimate) {
  if (!estimate?.hasWage) {
    return "Add an hourly wage to estimate labour cost.";
  }

  const hours = estimate.coveredStaffHours || estimate.totalStaffHours || 0;

  if (estimate.uncoveredStaffHours > 0) {
    return `Partial estimate from ${hours} staff hours. Add a default wage for the remaining roles.`;
  }

  if (estimate.usesRoleWages && estimate.averageHourlyWage !== null) {
    return `Based on ${hours} staff hours, using role wages where set and the average wage for the rest.`;
  }

  if (estimate.usesRoleWages) {
    return `Based on ${hours} staff hours and role-level wages.`;
  }

  return `Based on ${hours} staff hours at ${formatCurrencyGBP(
    estimate.averageHourlyWage
  )}/hour.`;
}
