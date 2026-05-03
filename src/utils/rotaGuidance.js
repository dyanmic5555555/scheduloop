function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutes(value) {
  const dayMinutes = 24 * 60;
  const wrapped = ((value % dayMinutes) + dayMinutes) % dayMinutes;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

export function formatSlotRange(startHour, endHour, intervalMinutes = 60) {
  const start = parseTimeToMinutes(startHour);
  const endStart = parseTimeToMinutes(endHour);
  const interval = Number(intervalMinutes) || 60;

  if (start === null || endStart === null) return startHour || "No clear time";

  return `${formatMinutes(start)}-${formatMinutes(endStart + interval)}`;
}

function getRanges(points, predicate, intervalMinutes) {
  const ranges = [];
  let startIndex = null;

  points.forEach((point, index) => {
    if (predicate(point, index)) {
      if (startIndex === null) startIndex = index;
      return;
    }

    if (startIndex !== null) {
      ranges.push({
        startIndex,
        endIndex: index - 1,
        label: formatSlotRange(
          points[startIndex].hour,
          points[index - 1].hour,
          intervalMinutes
        ),
      });
      startIndex = null;
    }
  });

  if (startIndex !== null) {
    ranges.push({
      startIndex,
      endIndex: points.length - 1,
      label: formatSlotRange(
        points[startIndex].hour,
        points[points.length - 1].hour,
        intervalMinutes
      ),
    });
  }

  return ranges;
}

function pickLongestRange(ranges) {
  return ranges.reduce((best, range) => {
    if (!best) return range;
    const bestLength = best.endIndex - best.startIndex;
    const rangeLength = range.endIndex - range.startIndex;
    return rangeLength > bestLength ? range : best;
  }, null);
}

export function calculateRotaGuidance({
  chartData = [],
  roles = [],
  intervalMinutes = 60,
  minTotalStaff = 0,
}) {
  const points = chartData.filter((point) => point?.hour);

  if (points.length === 0) {
    return {
      hasGuidance: false,
      summary: "Add forecast data to generate rota guidance.",
      strongestCoverLabel: "No data",
      quietCoverLabel: "No data",
      roleAdvice: [],
      warnings: [],
    };
  }

  const totals = points.map((point) => Math.max(0, Number(point.total) || 0));
  const maxTotal = Math.max(...totals);
  const minObservedTotal = Math.min(...totals);

  if (maxTotal <= 0) {
    return {
      hasGuidance: false,
      summary: "No staffing need is currently forecast for this day.",
      strongestCoverLabel: "No clear peak",
      quietCoverLabel: "No clear quiet period",
      roleAdvice: [],
      warnings: [],
    };
  }

  const peakThreshold = Math.max(maxTotal * 0.8, maxTotal - 1);
  const strongestRange = pickLongestRange(
    getRanges(
      points,
      (point) => (Number(point.total) || 0) >= peakThreshold,
      intervalMinutes
    )
  );
  const quietThreshold = Math.max(
    Number(minTotalStaff) || 0,
    Math.min(minObservedTotal + 1, maxTotal * 0.55)
  );
  const quietRange = pickLongestRange(
    getRanges(
      points,
      (point) =>
        (Number(point.total) || 0) <= quietThreshold &&
        (Number(point.total) || 0) < maxTotal,
      intervalMinutes
    )
  );
  const strongestCoverLabel = strongestRange?.label || "No clear peak";
  const quietCoverLabel = quietRange?.label || "No clear quiet period";
  const roleAdvice = roles
    .map((role) => {
      const roleValues = points.map((point) =>
        Math.max(0, Number(point[role.id]) || 0)
      );
      const maxRoleStaff = Math.max(...roleValues);
      if (maxRoleStaff <= 0) return null;

      const roleRanges = getRanges(
        points,
        (point) => (Number(point[role.id]) || 0) === maxRoleStaff,
        intervalMinutes
      );
      const rolePeak = pickLongestRange(roleRanges);
      const staffLabel = maxRoleStaff === 1 ? "1 staff member" : `${maxRoleStaff} staff`;

      return `${role.name} demand peaks at ${staffLabel} around ${
        rolePeak?.label || strongestCoverLabel
      }.`;
    })
    .filter(Boolean);
  const warnings = [];
  const sharpJumpThreshold = Math.max(2, Math.ceil(maxTotal * 0.35));

  for (let index = 1; index < points.length; index += 1) {
    const previous = Number(points[index - 1].total) || 0;
    const current = Number(points[index].total) || 0;
    const jump = current - previous;

    if (jump >= sharpJumpThreshold) {
      warnings.push(
        `Watch the ramp from ${points[index - 1].hour} to ${
          points[index].hour
        }: staffing rises by ${jump} people.`
      );
    }
  }

  const quietSentence =
    quietRange && quietCoverLabel !== strongestCoverLabel
      ? `${quietCoverLabel} can stay closer to minimum cover.`
      : "There is no obvious quiet window, so keep cover steady.";

  return {
    hasGuidance: true,
    summary: `Schedule strongest cover around ${strongestCoverLabel}. ${quietSentence}`,
    strongestCoverLabel,
    quietCoverLabel,
    roleAdvice,
    warnings,
  };
}
