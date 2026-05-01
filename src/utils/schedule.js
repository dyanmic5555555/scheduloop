export const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export function parseTimeToMinutes(timeLabel) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(timeLabel));
  if (!match) {
    throw new Error("Invalid time. Expected HH:MM.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time. Expected HH:MM.");
  }

  return hours * 60 + minutes;
}

export function formatMinutesAsTime(totalMinutes) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeIntervalMinutes(value) {
  const num = Number(value);
  return num === 15 || num === 30 || num === 60 ? num : 60;
}

export function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey) {
  const parts = String(dateKey).split("-").map(Number);
  const [year, month, day] = parts;

  if (
    parts.length !== 3 ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error("Invalid date key. Expected YYYY-MM-DD.");
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function getWeekdayFromDateKey(dateKey) {
  return parseLocalDateKey(dateKey).getDay();
}

export function holidayDateKey(year, monthIndex, day) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${month}-${paddedDay}`;
}

export function isOpeningHoursValid(openingHours, allowedHours = HOURS) {
  const openIdx = allowedHours.indexOf(openingHours?.open);
  const closeIdx = allowedHours.indexOf(openingHours?.close);
  return openIdx >= 0 && closeIdx >= 0 && closeIdx > openIdx;
}

export function getActiveHourWindow(openingHours, allowedHours = HOURS) {
  if (!isOpeningHoursValid(openingHours, allowedHours)) {
    return {
      start: 0,
      end: allowedHours.length - 1,
      activeHours: allowedHours,
      isValid: false,
    };
  }

  const start = allowedHours.indexOf(openingHours.open);
  const end = allowedHours.indexOf(openingHours.close);

  return {
    start,
    end,
    activeHours: allowedHours.slice(start, end + 1),
    isValid: true,
  };
}

export function generateTimeSlots(open, close, intervalMinutes = 60) {
  const interval = normalizeIntervalMinutes(intervalMinutes);
  const startMinutes = parseTimeToMinutes(open);
  const endMinutes = parseTimeToMinutes(close);

  if (endMinutes <= startMinutes) {
    return [];
  }

  const slots = [];
  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += interval
  ) {
    slots.push(formatMinutesAsTime(minutes));
  }

  return slots;
}

export function getActiveSlotWindow(openingHours, operatingRules = {}) {
  const intervalMinutes = normalizeIntervalMinutes(
    operatingRules.intervalMinutes
  );

  if (!isOpeningHoursValid(openingHours)) {
    return {
      slotLabels: HOURS,
      intervalMinutes,
      isValid: false,
    };
  }

  return {
    slotLabels: generateTimeSlots(
      openingHours.open,
      openingHours.close,
      intervalMinutes
    ),
    intervalMinutes,
    isValid: true,
  };
}

export function getHourIndexForSlot(slotLabel, allowedHours = HOURS) {
  const minutes = parseTimeToMinutes(slotLabel);
  const hourLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
  const exactIndex = allowedHours.indexOf(hourLabel);

  if (exactIndex !== -1) {
    return exactIndex;
  }

  if (minutes < parseTimeToMinutes(allowedHours[0])) return 0;
  return allowedHours.length - 1;
}

export function getCoverageWindowFlags(index, totalSlots, operatingRules = {}) {
  const intervalMinutes = normalizeIntervalMinutes(
    operatingRules.intervalMinutes
  );
  const prepSlots = Math.ceil(
    Math.max(0, Number(operatingRules.prepMinutes) || 0) / intervalMinutes
  );
  const closeSlots = Math.ceil(
    Math.max(0, Number(operatingRules.closeMinutes) || 0) / intervalMinutes
  );

  return {
    isPrepWindow: prepSlots > 0 && index < prepSlots,
    isCloseWindow: closeSlots > 0 && index >= totalSlots - closeSlots,
  };
}
