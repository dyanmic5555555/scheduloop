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
  runForecastBacktest,
} from "../src/utils/staffing.js";
import {
  CSV_DEMAND_MODEL_VERSION,
  calculateForecastConfidence,
  getCsvBlendWeight,
  getCsvDemandUnitsForRole,
  getCsvTrustWeight,
  getDemandConfidence,
  isCurrentCsvDemandModel,
} from "../src/utils/demandModel.js";
import {
  getAverageFeedbackCorrection,
  getStaffingFeedback,
  saveStaffingFeedback,
} from "../src/utils/staffingFeedback.js";
import {
  calculateContextMultiplier,
  getActiveContextLabels,
  getContextAdjustmentSummary,
  getDefaultDayContext,
  hasActiveDayContext,
  normaliseDayConfigs,
  normaliseDayContext,
} from "../src/utils/dayContext.js";
import {
  detectDemandColumns,
  getDemandColumnForRole,
} from "../src/utils/roleDemand.js";

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

test("CSV demand detects role-specific columns", () => {
  const headers = [
    "timestamp",
    "drink_orders",
    "food_orders",
    "customers",
    "staff",
  ];
  const detected = detectDemandColumns(headers);

  assert.equal(detected.hasRoleSpecificDemand, true);
  assert.equal(
    getDemandColumnForRole({ id: "barista", name: "Barista" }, detected)
      .key,
    "drinkOrders"
  );
  assert.equal(
    getDemandColumnForRole({ id: "kitchen", name: "Kitchen" }, detected).key,
    "foodOrders"
  );
  assert.equal(
    getDemandColumnForRole({ id: "wait", name: "Wait Staff" }, detected).key,
    "customers"
  );
});

test("CSV demand stores role-specific demand curves", () => {
  const csv = [
    "timestamp,drink_orders,food_orders,customers,staff",
    "2026-01-02T09:00:00,10,4,12,2",
    "2026-01-02T09:30:00,20,8,18,3",
  ].join("\n");

  const demand = parseCsvDemand(csv, {
    openingHours: { open: "09:00", close: "10:00" },
    intervalMinutes: 30,
    now: () => new Date("2026-01-02T12:00:00Z"),
  });

  assert.equal(demand.hasRoleSpecificDemand, true);
  assert.equal(demand.demandSources.drinkOrders.fallbackUnits[0], 10);
  assert.equal(
    getCsvDemandUnitsForRole({
      csvDemand: demand,
      role: { id: "barista", name: "Barista" },
      weekday: 5,
      slotIndex: 1,
      useWeekdayData: true,
    }),
    20
  );
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

test("day context defaults and invalid values stay safe", () => {
  const defaultContext = getDefaultDayContext();
  assert.equal(hasActiveDayContext(defaultContext), false);
  assert.equal(calculateContextMultiplier(defaultContext), 1);

  const context = normaliseDayContext({
    promotion: "yes",
    payday: true,
    weather: {
      enabled: true,
      condition: "hail",
      temperatureC: "not a number",
    },
  });

  assert.equal(context.promotion, false);
  assert.equal(context.payday, true);
  assert.equal(context.weather.condition, "normal");
  assert.equal(context.weather.temperatureC, null);
  assert.equal(hasActiveDayContext(context), true);
});

test("day context multipliers compound and clamp", () => {
  assert.equal(
    calculateContextMultiplier({
      payday: true,
      localEvent: true,
    }),
    1.296
  );

  assert.equal(
    calculateContextMultiplier({
      promotion: true,
      localEvent: true,
      sportEvent: true,
      payday: true,
      bankHoliday: true,
      weather: { enabled: true, condition: "hot" },
    }),
    1.5
  );
});

test("day context summaries explain active assumptions", () => {
  const summary = getContextAdjustmentSummary({
    roadworks: true,
    weather: { enabled: true, condition: "rain" },
  });

  assert.equal(summary.multiplier, 0.855);
  assert.equal(summary.percentChange, -15);
  assert.deepEqual(summary.labels, ["Roadworks nearby: -10%", "Rain: -5%"]);
  assert.deepEqual(getActiveContextLabels({ bankHoliday: true }), [
    "Bank holiday",
  ]);
});

test("day config normalization preserves old day type-only entries", () => {
  const configs = normaliseDayConfigs({
    "2026-05-01": { dayType: "busy" },
    "2026-05-02": { dayType: "event", context: { payday: true } },
  });

  assert.equal(configs["2026-05-01"].dayType, "busy");
  assert.equal("context" in configs["2026-05-01"], false);
  assert.equal(configs["2026-05-02"].context.payday, true);
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

test("manager feedback stores and averages corrections", () => {
  const feedback = saveStaffingFeedback([null], {
    date: "2026-01-02",
    hour: "09:00",
    roleId: "barista",
    predictedStaff: 2,
    actualStaff: 3,
    feedback: "understaffed",
  });

  assert.equal(feedback.length, 1);
  assert.equal(
    getAverageFeedbackCorrection({
      weekday: 5,
      hour: "09:00",
      roleId: "barista",
      feedbackEntries: feedback,
    }),
    1
  );

  const neutralFeedback = saveStaffingFeedback(feedback, {
    date: "2026-01-09",
    hour: "09:00",
    roleId: "barista",
    predictedStaff: 2,
    actualStaff: 2,
    feedback: "right",
  });

  assert.equal(getStaffingFeedback({ staffingFeedback: [null] }).length, 0);
  assert.equal(
    getAverageFeedbackCorrection({
      weekday: 5,
      hour: "09:00",
      roleId: "barista",
      feedbackEntries: [null, ...neutralFeedback, { date: "not-a-date" }],
    }),
    0.5
  );
});

test("forecast backtest returns a safe accuracy summary", () => {
  const dailyDemandByDate = {};

  for (let day = 1; day <= 8; day += 1) {
    const date = `2026-01-${String(day).padStart(2, "0")}`;
    dailyDemandByDate[date] = {
      weekday: new Date(`${date}T12:00:00`).getDay(),
      demandUnits: day === 8 ? [Number.NaN, 20 + day] : [10 + day, 20 + day],
      actualStaff: day === 8 ? [Number.NaN, 2] : [1, 2],
    };
  }

  const result = runForecastBacktest({
    historicalData: {
      slotLabels: ["09:00", "09:30"],
      intervalMinutes: 30,
      dailyDemandByDate,
    },
    roles: [
      {
        id: "barista",
        name: "Barista",
        curve: [1, 1],
        serviceRate: 20,
        minStaff: 1,
        demandWeight: 1,
        requiredDuringOpen: true,
      },
    ],
    businessProfile: { peakStaff: { barista: 3 } },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.sampleSize, 8);
});

test("CSV trust weight increases with usable history", () => {
  assert.equal(getCsvTrustWeight({ usableCsvDays: 0, totalRows: 0 }), 0);
  assert.equal(
    getCsvTrustWeight({
      usableCsvDays: 3,
      weekdaySampleSize: 1,
      totalRows: 20,
      hasWeekdayData: true,
    }),
    0.25
  );
  assert.equal(
    getCsvTrustWeight({
      usableCsvDays: 12,
      weekdaySampleSize: 2,
      totalRows: 80,
      hasWeekdayData: true,
    }),
    0.5
  );
  assert.equal(
    getCsvTrustWeight({
      usableCsvDays: 45,
      weekdaySampleSize: 6,
      totalRows: 500,
      hasWeekdayData: true,
    }),
    0.75
  );
  assert.equal(
    getCsvTrustWeight({
      usableCsvDays: 120,
      weekdaySampleSize: 12,
      totalRows: 1000,
      hasWeekdayData: true,
    }),
    0.9
  );
});

test("CSV blend weight falls back safely without weekday data", () => {
  assert.equal(
    getCsvBlendWeight({
      hasCsv: true,
      hasWeekdayData: false,
      weekdaySampleCount: 0,
      observedDays: 12,
      totalRows: 80,
    }),
    0.35
  );
  assert.equal(
    getCsvBlendWeight({
      hasCsv: true,
      hasWeekdayData: false,
      weekdaySampleCount: 0,
      observedDays: 120,
      totalRows: 1000,
    }),
    0.6
  );
});

test("demand confidence labels weak and strong uploaded data", () => {
  assert.equal(getDemandConfidence(null, 5).label, "Low");
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
    "Medium"
  );
  assert.equal(
    getDemandConfidence(
      {
        rows: 100,
        observedDays: 30,
        weekdaySampleCounts: [0, 0, 0, 0, 0, 6],
        hasRoleSpecificDemand: true,
      },
      5
    ).label,
    "High"
  );
});

test("forecast confidence explains the signal quality", () => {
  const confidence = calculateForecastConfidence({
    usableCsvDays: 30,
    weekdaySampleSize: 5,
    hasRoleSpecificDemand: true,
    hasStaffHistory: true,
    hasManagerFeedback: false,
  });

  assert.equal(confidence.level, "High");
  assert.equal(confidence.reasons.some((reason) => reason.includes("30")), true);
});

test("forecast confidence mentions context without increasing score", () => {
  const withoutContext = calculateForecastConfidence({
    usableCsvDays: 7,
    weekdaySampleSize: 2,
  });
  const withContext = calculateForecastConfidence({
    usableCsvDays: 7,
    weekdaySampleSize: 2,
    hasDayContext: true,
  });

  assert.equal(withContext.score, withoutContext.score);
  assert.equal(
    withContext.reasons.includes(
      "Context tags included using default assumptions"
    ),
    true
  );
  assert.match(
    getDemandConfidence(null, 5, { hasDayContext: true }).detail,
    /Context tags use default assumptions/
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
