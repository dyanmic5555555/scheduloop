import {
  formatMinutesAsTime,
  generateTimeSlots,
  HOURS,
  normalizeIntervalMinutes,
} from "./schedule.js";

export const MAX_CSV_BYTES = 1024 * 1024;

const DEMAND_COLUMN_PATTERNS = [
  {
    type: "count",
    unitLabel: "demand units",
    patterns: [
      /^orders?$/,
      /^order[_\s-]?count$/,
      /^transactions?$/,
      /^sales[_\s-]?count$/,
      /^covers?$/,
      /^check[_\s-]?ins?$/,
      /^bookings?$/,
      /^appointments?$/,
      /^customers?$/,
      /^guests?$/,
      /^items?$/,
      /^quantity$/,
      /^qty$/,
      /^units?$/,
    ],
  },
  {
    type: "money",
    unitLabel: "revenue units",
    patterns: [/^revenue$/, /^sales$/, /^amount$/, /^total$/, /^price$/],
  },
  {
    type: "duration",
    unitLabel: "minutes",
    patterns: [/^duration$/, /^minutes?$/, /^service[_\s-]?minutes$/],
  },
];

const ACTUAL_STAFF_PATTERNS = [
  /^staff$/,
  /^staff[_\s-]?count$/,
  /^scheduled[_\s-]?staff$/,
  /^team[_\s-]?size$/,
  /^people[_\s-]?on[_\s-]?shift$/,
  /^employees?$/,
];

export function assertCsvFileIsSafe(file, maxBytes = MAX_CSV_BYTES) {
  if (!file) {
    throw new Error("Choose a CSV file to upload.");
  }

  if (file.size > maxBytes) {
    throw new Error("CSV file is too large. Use a file under 1 MB.");
  }
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unterminated quoted field.");
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function findTimestampColumn(headers) {
  return headers.findIndex((header) =>
    /^(time|timestamp|date|datetime|created_at|created at)$/.test(
      normalizeHeader(header)
    )
  );
}

function findActualStaffColumn(headers) {
  return headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return ACTUAL_STAFF_PATTERNS.some((pattern) => pattern.test(normalized));
  });
}

function findDemandMetric(headers) {
  for (const candidate of DEMAND_COLUMN_PATTERNS) {
    const index = headers.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return candidate.patterns.some((pattern) => pattern.test(normalized));
    });

    if (index !== -1) {
      return {
        index,
        column: headers[index],
        type: candidate.type,
        unitLabel: candidate.unitLabel,
      };
    }
  }

  return {
    index: -1,
    column: null,
    type: "events",
    unitLabel: "events",
  };
}

function parsePositiveNumber(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getSlotIndex(date, slotLabels, intervalMinutes) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const slotMinutes =
    Math.floor(minutes / intervalMinutes) * intervalMinutes;
  const slotLabel = formatMinutesAsTime(slotMinutes);
  return slotLabels.indexOf(slotLabel);
}

function normalizeCounts(counts) {
  const max = Math.max(...counts);
  if (max <= 0) return counts.map(() => 0);
  return counts.map((count) => count / max);
}

function buildActualAverages(sumRows, countRows) {
  return sumRows.map((sum, index) =>
    countRows[index] > 0 ? sum / countRows[index] : null
  );
}

export function parseCsvDemand(
  text,
  {
    openingHours = { open: HOURS[0], close: HOURS[HOURS.length - 1] },
    intervalMinutes = 60,
    now = () => new Date(),
  } = {}
) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("The CSV looks empty.");
  }

  const interval = normalizeIntervalMinutes(intervalMinutes);
  const slotLabels = generateTimeSlots(
    openingHours.open,
    openingHours.close,
    interval
  );

  if (slotLabels.length === 0) {
    throw new Error("Opening hours are invalid.");
  }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("The CSV looks empty or has no data rows.");
  }

  const headers = rows[0];
  const timeIdx = findTimestampColumn(headers);

  if (timeIdx === -1) {
    throw new Error(
      "Could not find a time, timestamp, date, or datetime column."
    );
  }

  const demandMetric = findDemandMetric(headers);
  const actualStaffIdx = findActualStaffColumn(headers);
  const demandUnitsOverall = Array(slotLabels.length).fill(0);
  const weekdayDemandUnits = Array.from({ length: 7 }, () =>
    Array(slotLabels.length).fill(0)
  );
  const actualStaffOverallSums = Array(slotLabels.length).fill(0);
  const actualStaffOverallCounts = Array(slotLabels.length).fill(0);
  const weekdayActualStaffSums = Array.from({ length: 7 }, () =>
    Array(slotLabels.length).fill(0)
  );
  const weekdayActualStaffCounts = Array.from({ length: 7 }, () =>
    Array(slotLabels.length).fill(0)
  );

  const invalidRows = [];
  let matchedRows = 0;
  let outOfHoursRows = 0;
  let actualStaffRows = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const cols = rows[i];
    const rowNumber = i + 1;

    if (cols.length <= timeIdx) {
      invalidRows.push({ row: rowNumber, reason: "Missing timestamp" });
      continue;
    }

    const rawTs = cols[timeIdx].trim();
    const parsed = new Date(rawTs);

    if (!rawTs || Number.isNaN(parsed.getTime())) {
      invalidRows.push({ row: rowNumber, reason: "Invalid timestamp" });
      continue;
    }

    const slotIndex = getSlotIndex(parsed, slotLabels, interval);
    if (slotIndex === -1) {
      outOfHoursRows += 1;
      continue;
    }

    const demandUnits =
      demandMetric.index === -1
        ? 1
        : parsePositiveNumber(cols[demandMetric.index]);

    if (!demandUnits) {
      invalidRows.push({ row: rowNumber, reason: "Invalid demand value" });
      continue;
    }

    const weekday = parsed.getDay();
    demandUnitsOverall[slotIndex] += demandUnits;
    weekdayDemandUnits[weekday][slotIndex] += demandUnits;
    matchedRows += 1;

    if (actualStaffIdx !== -1 && cols.length > actualStaffIdx) {
      const actualStaff = parsePositiveNumber(cols[actualStaffIdx]);
      if (actualStaff) {
        actualStaffOverallSums[slotIndex] += actualStaff;
        actualStaffOverallCounts[slotIndex] += 1;
        weekdayActualStaffSums[weekday][slotIndex] += actualStaff;
        weekdayActualStaffCounts[weekday][slotIndex] += 1;
        actualStaffRows += 1;
      }
    }
  }

  if (matchedRows === 0) {
    throw new Error(
      `No valid rows matched opening hours ${openingHours.open}-${openingHours.close}.`
    );
  }

  return {
    slotLabels,
    intervalMinutes: interval,
    fallback: normalizeCounts(demandUnitsOverall),
    byWeekday: weekdayDemandUnits.map(normalizeCounts),
    fallbackUnits: demandUnitsOverall,
    byWeekdayUnits: weekdayDemandUnits,
    actualStaffFallback: buildActualAverages(
      actualStaffOverallSums,
      actualStaffOverallCounts
    ),
    actualStaffByWeekday: weekdayActualStaffSums.map((sums, weekday) =>
      buildActualAverages(sums, weekdayActualStaffCounts[weekday])
    ),
    demandMetric,
    rows: matchedRows,
    totalRows: rows.length - 1,
    skippedRows: invalidRows.length + outOfHoursRows,
    invalidRows: invalidRows.slice(0, 5),
    outOfHoursRows,
    actualStaffRows,
    lastUpdated: now().toISOString(),
  };
}
