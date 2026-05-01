import assert from "node:assert/strict";
import {
  getActiveHourWindow,
  generateTimeSlots,
  getActiveSlotWindow,
  getWeekdayFromDateKey,
  HOURS,
  isOpeningHoursValid,
  toLocalDateKey,
} from "../src/utils/schedule.js";
import { parseCsv, parseCsvDemand } from "../src/utils/csvDemand.js";
import {
  calculateRoleStaff,
  applyMinimumTotalStaff,
  calculateBacktestSummary,
  normalizeStaffCount,
} from "../src/utils/staffing.js";
import {
  CSV_DEMAND_MODEL_VERSION,
  getCsvBlendWeight,
  getDemandConfidence,
  isCurrentCsvDemandModel,
} from "../src/utils/demandModel.js";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function hasUnsupportedNestedArray(value) {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(
      (item) => Array.isArray(item) || hasUnsupportedNestedArray(item)
    );
  }

  return Object.values(value).some(hasUnsupportedNestedArray);
}

test("opening hours must close after they open", () => {
  assert.equal(
    isOpeningHoursValid({ open: "09:00", close: "17:00" }),
    true
  );
  assert.equal(
    isOpeningHoursValid({ open: "17:00", close: "09:00" }),
    false
  );
  assert.equal(
    isOpeningHoursValid({ open: "09:00", close: "09:00" }),
    false
  );
});

test("active hour window slices expected hours", () => {
  const window = getActiveHourWindow({ open: "09:00", close: "12:00" });
  assert.deepEqual(window.activeHours, ["09:00", "10:00", "11:00", "12:00"]);
  assert.equal(window.start, 1);
  assert.equal(window.end, 4);
  assert.equal(window.isValid, true);
});

test("active slot window supports 30 minute blocks", () => {
  const window = getActiveSlotWindow(
    { open: "09:00", close: "10:00" },
    { intervalMinutes: 30 }
  );
  assert.deepEqual(window.slotLabels, ["09:00", "09:30"]);
  assert.equal(window.intervalMinutes, 30);
});

test("time slot generation supports 15 minute blocks", () => {
  assert.deepEqual(generateTimeSlots("09:00", "09:30", 15), [
    "09:00",
    "09:15",
  ]);
});

test("invalid active hour window falls back without crashing", () => {
  const window = getActiveHourWindow({ open: "18:00", close: "09:00" });
  assert.deepEqual(window.activeHours, HOURS);
  assert.equal(window.isValid, false);
});

test("local date keys do not use UTC conversion", () => {
  const date = new Date(2026, 0, 2, 1, 30);
  assert.equal(toLocalDateKey(date), "2026-01-02");
});

test("weekday is calculated from local date key", () => {
  assert.equal(getWeekdayFromDateKey("2026-01-02"), 5);
});

test("CSV parser supports quoted commas", () => {
  const rows = parseCsv('timestamp,note\n"2026-01-02T09:15:00","hello, world"');
  assert.deepEqual(rows, [
    ["timestamp", "note"],
    ["2026-01-02T09:15:00", "hello, world"],
  ]);
});

test("CSV demand reports skipped rows", () => {
  const csv = [
    "timestamp,note",
    "2026-01-02T09:15:00,one",
    "2026-01-02T09:45:00,two",
    "bad timestamp,bad",
    "2026-01-02T23:15:00,outside",
  ].join("\n");

  const demand = parseCsvDemand(csv, {
    now: () => new Date("2026-01-02T12:00:00Z"),
  });

  assert.equal(demand.rows, 2);
  assert.equal(demand.totalRows, 4);
  assert.equal(demand.skippedRows, 2);
  assert.equal(demand.invalidRows[0].reason, "Invalid timestamp");
  assert.equal(demand.fallback[1], 1);
});

test("CSV demand uses weighted demand columns and actual staff", () => {
  const csv = [
    "timestamp,orders,staff_count",
    "2026-01-02T09:15:00,10,2",
    "2026-01-02T09:45:00,20,3",
  ].join("\n");

  const demand = parseCsvDemand(csv, {
    openingHours: { open: "09:00", close: "10:00" },
    intervalMinutes: 30,
    now: () => new Date("2026-01-02T12:00:00Z"),
  });

  assert.equal(demand.rows, 2);
  assert.equal(demand.demandMetric.column, "orders");
  assert.deepEqual(demand.slotLabels, ["09:00", "09:30"]);
  assert.equal(demand.fallbackUnits[0], 10);
  assert.equal(demand.fallbackUnits[1], 20);
  assert.equal(demand.actualStaffRows, 2);
  assert.equal(demand.actualStaffFallback[0], 2);
  assert.equal(demand.actualStaffFallback[1], 3);
});

test("CSV demand averages units by observed business day", () => {
  const csv = [
    "timestamp,orders,staff_count",
    "2026-01-02T09:05:00,5,2",
    "2026-01-02T09:10:00,5,4",
    "2026-01-09T09:05:00,20,6",
  ].join("\n");

  const demand = parseCsvDemand(csv, {
    openingHours: { open: "09:00", close: "09:30" },
    intervalMinutes: 30,
    now: () => new Date("2026-01-10T12:00:00Z"),
  });

  assert.equal(demand.observedDays, 2);
  assert.equal(demand.modelVersion, CSV_DEMAND_MODEL_VERSION);
  assert.equal(Array.isArray(demand.byWeekday), false);
  assert.equal(demand.weekdaySampleCounts[5], 2);
  assert.equal(demand.fallbackUnits[0], 15);
  assert.equal(demand.byWeekdayUnits[5][0], 15);
  assert.equal(demand.actualStaffFallback[0], 4.5);
  assert.equal(demand.actualStaffByWeekday[5][0], 4.5);
});

test("CSV demand model is safe to store in Firestore", () => {
  const csv = [
    "timestamp,orders,staff_count",
    "2026-01-02T09:00:00,10,2",
    "2026-01-09T09:00:00,20,3",
  ].join("\n");

  const demand = parseCsvDemand(csv, {
    openingHours: { open: "09:00", close: "09:30" },
    intervalMinutes: 30,
    now: () => new Date("2026-01-10T12:00:00Z"),
  });

  assert.equal(hasUnsupportedNestedArray(demand), false);
});

test("stale CSV demand models are rejected", () => {
  assert.equal(isCurrentCsvDemandModel({ rows: 10 }), false);
  assert.equal(
    isCurrentCsvDemandModel({ rows: 10, modelVersion: CSV_DEMAND_MODEL_VERSION }),
    true
  );
});

test("CSV demand rejects files without timestamp columns", () => {
  assert.throws(
    () => parseCsvDemand("name,count\nAlice,1"),
    /Could not find/
  );
});

test("CSV demand rejects files with no usable rows", () => {
  assert.throws(
    () => parseCsvDemand("timestamp\n2026-01-02T23:15:00"),
    /No valid rows matched/
  );
});

const role = {
  id: "barista",
  curve: [1, 2, 4, 2],
};

test("staff count normalization rejects invalid and negative counts", () => {
  assert.equal(normalizeStaffCount(""), 0);
  assert.equal(normalizeStaffCount("-2"), 0);
  assert.equal(normalizeStaffCount("2.4"), 2);
});

test("staffing returns zero for near-zero demand", () => {
  assert.equal(
    calculateRoleStaff({ demand: 0, role, absoluteIndex: 2, peak: 4 }),
    0
  );
});

test("staffing caps staffing at peak", () => {
  assert.equal(
    calculateRoleStaff({ demand: 1.5, role, absoluteIndex: 2, peak: 3 }),
    3
  );
});

test("staffing uses service rate for weighted CSV demand", () => {
  assert.equal(
    calculateRoleStaff({
      demand: 1,
      demandUnits: 90,
      role: { ...role, serviceRate: 30, demandWeight: 1 },
      absoluteIndex: 2,
      peak: 5,
      intervalMinutes: 60,
      operatingRules: { demandBufferPercent: 0, breakAllowancePercent: 0 },
    }),
    3
  );
});

test("staffing handles missing peak with role curve fallback", () => {
  assert.equal(
    calculateRoleStaff({ demand: 0.75, role, absoluteIndex: 2, peak: 0 }),
    3
  );
});

test("minimum total staff fills a required role", () => {
  const adjusted = applyMinimumTotalStaff(
    { hour: "09:00", barista: 1, total: 1 },
    [{ id: "barista", requiredDuringOpen: true }],
    2
  );
  assert.equal(adjusted.barista, 2);
  assert.equal(adjusted.total, 2);
});

test("backtest summary compares predictions with actual staff", () => {
  const summary = calculateBacktestSummary(
    [
      { hour: "09:00", total: 2 },
      { hour: "09:30", total: 4 },
    ],
    {
      slotLabels: ["09:00", "09:30"],
      actualStaffFallback: [3, 3],
      actualStaffByWeekday: Array.from({ length: 7 }, () => [null, null]),
    },
    5
  );

  assert.equal(summary.blocksCompared, 2);
  assert.equal(summary.meanAbsoluteError, 1);
  assert.equal(summary.underStaffedBlocks, 1);
  assert.equal(summary.overStaffedBlocks, 1);
});

test("CSV blend weight trusts stronger weekday samples more", () => {
  assert.equal(
    getCsvBlendWeight({
      hasCsv: true,
      hasWeekdayData: true,
      weekdaySampleCount: 6,
      observedDays: 20,
    }),
    0.9
  );
  assert.equal(
    getCsvBlendWeight({
      hasCsv: true,
      hasWeekdayData: true,
      weekdaySampleCount: 1,
      observedDays: 20,
    }),
    0.5
  );
  assert.equal(
    getCsvBlendWeight({
      hasCsv: true,
      hasWeekdayData: false,
      weekdaySampleCount: 0,
      observedDays: 7,
    }),
    0.35
  );
});

test("demand confidence labels weak and strong uploaded data", () => {
  assert.equal(getDemandConfidence(null, 5).label, "Preset");
  assert.equal(
    getDemandConfidence({ rows: 20, observedDays: 3, weekdaySampleCounts: [] }, 5)
      .label,
    "Low"
  );
  assert.equal(
    getDemandConfidence(
      { rows: 100, observedDays: 30, weekdaySampleCounts: [0, 0, 0, 0, 0, 6] },
      5
    ).label,
    "High"
  );
});

let failed = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(err);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`${tests.length} tests passed`);
}
