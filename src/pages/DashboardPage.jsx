import { useMemo, useState } from "react";
import ShapeOfDayChart from "../components/ShapeOfDayChart";
import InfoCard from "../components/InfoCard";
import CalendarPanel from "../components/CalendarPanel";
import StaffBreakdownPanel from "../components/StaffBreakdownPanel";
import AccuracySettingsPanel from "../components/AccuracySettingsPanel";
import { useAuth } from "../auth/AuthContext";
import { useBusinessProfile } from "../business/BusinessProfileContext";
import { useTheme } from "../theme/ThemeContext";
import {
  getBusinessPresetRoles,
  normalizeOperatingRules,
  normalizeRolesForAccuracy,
} from "../config/businessPresets";
import {
  getActiveSlotWindow,
  getCoverageWindowFlags,
  getHourIndexForSlot,
  getWeekdayFromDateKey,
  holidayDateKey,
  HOURS,
  toLocalDateKey,
} from "../utils/schedule";
import { assertCsvFileIsSafe, parseCsvDemand } from "../utils/csvDemand";
import {
  applyMinimumTotalStaff,
  calculateBacktestSummary,
  calculateRoleStaff,
} from "../utils/staffing";
import {
  getCsvBlendWeight,
  getDemandConfidence,
  isCurrentCsvDemandModel,
} from "../utils/demandModel";

const DAY_TYPE_SCALE = {
  quiet: 0.8,
  normal: 1.0,
  busy: 1.2,
  event: 1.4,
};

const BUSY_SCALE = {
  quiet: 0.7,
  normal: 1.0,
  busy: 1.3,
  veryBusy: 1.6,
};

const HOLIDAY_DEFINITIONS = [
  { month: 0, day: 1, label: "New Year's Day" },
  { month: 11, day: 25, label: "Christmas Day" },
  { month: 11, day: 26, label: "Boxing Day" },
];

function buildInitialDayConfigs() {
  const base = {};
  const currentYear = new Date().getFullYear();

  [currentYear, currentYear + 1].forEach((year) => {
    HOLIDAY_DEFINITIONS.forEach(({ month, day, label }) => {
      base[holidayDateKey(year, month, day)] = {
        dayType: "event",
        note: label,
      };
    });
  });

  return base;
}

function getInitialRoles(profile) {
  if (profile?.roles && profile.roles.length > 0) {
    return normalizeRolesForAccuracy(profile.roles);
  }
  return getBusinessPresetRoles(profile?.businessType || "gym");
}

function DashboardPage() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile, saveProfile, saveCsvDemand } = useBusinessProfile();
  const storedCsvDemand = isCurrentCsvDemandModel(profile?.csvDemand)
    ? profile.csvDemand
    : null;
  const hasOutdatedCsvDemand = Boolean(profile?.csvDemand && !storedCsvDemand);

  const [businessType, setBusinessType] = useState(
    profile?.businessType || "gym"
  );
  const [roles, setRoles] = useState(() => getInitialRoles(profile));
  const [operatingRules, setOperatingRules] = useState(() =>
    normalizeOperatingRules(profile?.operatingRules)
  );
  const [openingHours] = useState({
    open: profile?.hours?.open || "08:00",
    close: profile?.hours?.close || "17:00",
  });
  const [busyLevel] = useState(profile?.busyLevel || "normal");
  const [peakStaff, setPeakStaff] = useState(profile?.peakStaff || {});
  const [selectedDate, setSelectedDate] = useState(() =>
    toLocalDateKey(new Date())
  );
  const [dayConfigs, setDayConfigs] = useState(() =>
    profile?.dayConfigs || buildInitialDayConfigs()
  );
  const [csvCurves, setCsvCurves] = useState(storedCsvDemand);
  const [uploadError, setUploadError] = useState(() =>
    hasOutdatedCsvDemand
      ? "Re-upload your CSV so the improved demand model can rebuild this profile."
      : ""
  );
  const [uploadInfo, setUploadInfo] = useState(() =>
    storedCsvDemand ? { ...storedCsvDemand } : null
  );
  const [dashboardError, setDashboardError] = useState("");
  const [activeView, setActiveView] = useState("planner");

  const hasCsv = !!(csvCurves && csvCurves.rows > 0);
  const busyScale = hasCsv ? 1 : BUSY_SCALE[busyLevel] ?? 1.0;
  const currentDayConfig = dayConfigs[selectedDate];
  const dayType = currentDayConfig?.dayType || "normal";
  const dayScale = DAY_TYPE_SCALE[dayType] ?? 1.0;

  const persistProfilePatch = async (patch) => {
    try {
      await saveProfile(patch);
      setDashboardError("");
    } catch (err) {
      console.error(err);
      setDashboardError("Your latest change could not be saved.");
    }
  };

  const handleBusinessTypeChange = (e) => {
    const nextType = e.target.value;
    setBusinessType(nextType);
    persistProfilePatch({ businessType: nextType });
  };

  const handleCsvChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploadInfo(null);

    try {
      assertCsvFileIsSafe(file);
    } catch (err) {
      setUploadError(err.message || "CSV file cannot be uploaded.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const demandModel = parseCsvDemand(event.target.result, {
          openingHours,
          intervalMinutes: operatingRules.intervalMinutes,
        });
        await saveCsvDemand(demandModel);
        setCsvCurves(demandModel);
        setUploadInfo(demandModel);
        setUploadError("");
      } catch (err) {
        console.error(err);
        setUploadError(err.message || "Failed to read CSV file.");
        setCsvCurves(null);
      }
    };

    reader.onerror = () => {
      setUploadError("Error reading the file.");
      setCsvCurves(null);
    };

    reader.readAsText(file);
  };

  const presetShape = useMemo(() => {
    const totals = Array(HOURS.length).fill(0);

    roles.forEach((role) => {
      (role.curve || []).forEach((value, index) => {
        const num = Number(value);
        if (Number.isFinite(num) && index < totals.length) {
          totals[index] += num;
        }
      });
    });

    const max = Math.max(...totals);
    if (!max || max <= 0) {
      return totals.map(() => 0);
    }

    return totals.map((total) => total / max);
  }, [roles]);

  const chartData = useMemo(() => {
    const selectedWeekday = getWeekdayFromDateKey(selectedDate);
    const weekdaySampleCount =
      csvCurves?.weekdaySampleCounts?.[selectedWeekday] || 0;
    const observedDays = csvCurves?.observedDays || 0;
    const { slotLabels, intervalMinutes } = getActiveSlotWindow(
      openingHours,
      operatingRules
    );

    return slotLabels.map((slotLabel, slotIndex) => {
      const absoluteIndex = getHourIndexForSlot(slotLabel);
      const point = { hour: slotLabel };
      const preset = presetShape[absoluteIndex] ?? 0;
      const csvSlotIndex = csvCurves?.slotLabels?.indexOf(slotLabel) ?? -1;
      const weekdayCurve = csvCurves?.byWeekday?.[selectedWeekday] || null;
      const weekdayUnits = csvCurves?.byWeekdayUnits?.[selectedWeekday] || null;
      const hasWeekdayData =
        weekdaySampleCount > 0 &&
        weekdayCurve &&
        weekdayCurve.some((value) => (value || 0) > 0);
      const csvWeight = getCsvBlendWeight({
        hasCsv,
        hasWeekdayData,
        weekdaySampleCount,
        observedDays,
      });
      const csvDemand =
        hasCsv && csvSlotIndex !== -1
          ? (hasWeekdayData
              ? weekdayCurve?.[csvSlotIndex]
              : csvCurves?.fallback?.[csvSlotIndex]) ?? 0
          : null;
      const demandUnits =
        hasCsv && csvSlotIndex !== -1
          ? (hasWeekdayData
              ? weekdayUnits?.[csvSlotIndex]
              : csvCurves?.fallbackUnits?.[csvSlotIndex]) ?? null
          : null;
      const baseDemand =
        csvDemand !== null
          ? csvWeight * csvDemand + (1 - csvWeight) * preset
          : preset;
      const demand = Math.min(
        Math.max(baseDemand * busyScale * dayScale, 0),
        1.5
      );
      point.demandScore = demand;
      point.demandUnits = demandUnits;
      const coverageFlags = getCoverageWindowFlags(
        slotIndex,
        slotLabels.length,
        operatingRules
      );
      const forceMinimum =
        coverageFlags.isPrepWindow || coverageFlags.isCloseWindow;

      let total = 0;
      roles.forEach((role) => {
        const value = calculateRoleStaff({
          demand,
          demandUnits,
          role,
          absoluteIndex,
          peak: peakStaff[role.id],
          intervalMinutes,
          operatingRules,
          forceMinimum: forceMinimum && role.requiredDuringOpen,
        });
        point[role.id] = value;
        total += value;
      });

      point.total = total;
      return applyMinimumTotalStaff(
        point,
        roles,
        forceMinimum
          ? Math.max(operatingRules.minTotalStaff || 0, 1)
          : operatingRules.minTotalStaff
      );
    });
  }, [
    roles,
    peakStaff,
    openingHours,
    operatingRules,
    selectedDate,
    busyScale,
    dayScale,
    hasCsv,
    csvCurves,
    presetShape,
  ]);

  const totalStaffHours = useMemo(
    () =>
      chartData.reduce(
        (sum, point) =>
          sum + (point.total || 0) * (operatingRules.intervalMinutes / 60),
        0
      ),
    [chartData, operatingRules.intervalMinutes]
  );

  const selectedWeekday = getWeekdayFromDateKey(selectedDate);
  const demandConfidence = useMemo(
    () => getDemandConfidence(csvCurves, selectedWeekday),
    [csvCurves, selectedWeekday]
  );
  const backtestSummary = useMemo(
    () => calculateBacktestSummary(chartData, csvCurves, selectedWeekday),
    [chartData, csvCurves, selectedWeekday]
  );

  const peakDemandSummary = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { title: "Peak Demand", value: "No data", detail: "" };
    }

    const numericDemandUnits = chartData
      .map((point) => point.demandUnits)
      .filter((value) => typeof value === "number" && value > 0);

    if (numericDemandUnits.length > 0) {
      const maxUnits = Math.max(...numericDemandUnits);
      const metric = csvCurves?.demandMetric;
      const isMoney = metric?.type === "money";

      return {
        title: isMoney ? "Max Predicted Sales" : "Max Predicted Demand",
        value: isMoney
          ? `GBP ${Math.round(maxUnits).toLocaleString()}`
          : Math.round(maxUnits).toLocaleString(),
        detail: metric?.column ? `From ${metric.column}` : "From uploaded data",
      };
    }

    const maxDemandScore = Math.max(
      ...chartData.map((point) => point.demandScore || 0)
    );

    return {
      title: "Max Demand Score",
      value: `${Math.round(maxDemandScore * 100)}%`,
      detail: hasCsv ? "Blended with uploaded data" : "Pattern based",
    };
  }, [chartData, csvCurves, hasCsv]);

  const handleDayConfigChange = (date, partialConfig) => {
    const nextConfigs = {
      ...dayConfigs,
      [date]: {
        ...(dayConfigs[date] || {}),
        ...partialConfig,
      },
    };

    setDayConfigs(nextConfigs);
    persistProfilePatch({ dayConfigs: nextConfigs });
  };

  const handleStaffingChange = (nextRoles, nextPeakStaff) => {
    setRoles(nextRoles);
    setPeakStaff(nextPeakStaff);
    persistProfilePatch({ roles: nextRoles, peakStaff: nextPeakStaff });
  };

  const handleOperatingRulesChange = (nextRules) => {
    const normalizedRules = normalizeOperatingRules(nextRules);
    setOperatingRules(normalizedRules);
    persistProfilePatch({ operatingRules: normalizedRules });
  };

  const peakHoursLabel = useMemo(() => {
    if (!chartData || chartData.length === 0) return "No data for today";

    const totals = chartData.map((point) => point.total || 0);
    const maxTotal = Math.max(...totals);
    if (maxTotal <= 0) return "No clear peaks";

    const threshold = maxTotal * 0.8;
    const ranges = [];
    let currentStart = null;
    let currentEnd = null;

    chartData.forEach((point) => {
      const isPeak = (point.total || 0) >= threshold;

      if (isPeak) {
        if (currentStart === null) {
          currentStart = point.hour;
        }
        currentEnd = point.hour;
      } else if (currentStart !== null) {
        ranges.push({ start: currentStart, end: currentEnd });
        currentStart = null;
        currentEnd = null;
      }
    });

    if (currentStart !== null) {
      ranges.push({ start: currentStart, end: currentEnd });
    }

    if (ranges.length === 0) return "No clear peaks";

    return ranges
      .map((range) =>
        range.start === range.end ? range.start : `${range.start}-${range.end}`
      )
      .join(" / ");
  }, [chartData]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Scheduloop</h1>
          <p className="subtitle">Shape your day. Staff smarter.</p>

          <p className="business-type-label">
            Profile for:{" "}
            <strong>
              {businessType === "gym"
                ? "Gym / Fitness"
                : businessType === "cafe"
                  ? "Cafe / Restaurant"
                  : businessType}
            </strong>
          </p>
        </div>

        <div className="header-controls">
          <div className="view-tabs" role="tablist" aria-label="Dashboard views">
            <button
              type="button"
              className={
                "view-tab" + (activeView === "planner" ? " active" : "")
              }
              onClick={() => setActiveView("planner")}
            >
              Planner View
            </button>
            <button
              type="button"
              className={"view-tab" + (activeView === "setup" ? " active" : "")}
              onClick={() => setActiveView("setup")}
            >
              Setup View
            </button>
          </div>
          <div className="date-pill">
            {selectedDate} / {hasCsv ? "Data-driven" : "Pattern-based"} /{" "}
            {dayType === "normal"
              ? "Normal day"
              : dayType === "quiet"
                ? "Quiet day"
                : dayType === "busy"
                  ? "Busy day"
                  : "Event day"}
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>
          <button className="logout-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {dashboardError && <div className="banner banner-error">{dashboardError}</div>}

      {activeView === "planner" ? (
        <main className="planner-view">
          <section className="planner-hero">
            <div className="planner-chart">
              <ShapeOfDayChart roles={roles} data={chartData} />
            </div>

            <div className="planner-summary">
              <InfoCard title="Peak Hours">
                <p>{peakHoursLabel}</p>
              </InfoCard>

              <InfoCard title="Staff Hours Needed">
                <p className="big-number">{totalStaffHours.toFixed(1)}</p>
              </InfoCard>

              <InfoCard title={peakDemandSummary.title}>
                <p className="big-number">{peakDemandSummary.value}</p>
                {peakDemandSummary.detail && (
                  <p className="upload-info">{peakDemandSummary.detail}</p>
                )}
              </InfoCard>

              <InfoCard title="Demand Confidence">
                <p className="big-number">{demandConfidence.label}</p>
                <p className="upload-info">{demandConfidence.detail}</p>
              </InfoCard>

              <InfoCard title="Accuracy Check">
                {backtestSummary ? (
                  <p className="upload-info">
                    Avg error {backtestSummary.meanAbsoluteError.toFixed(1)}{" "}
                    staff / block. Under: {backtestSummary.underStaffedBlocks}.
                    Over: {backtestSummary.overStaffedBlocks}.
                  </p>
                ) : (
                  <p className="upload-info">No staffing history uploaded yet.</p>
                )}
              </InfoCard>
            </div>
          </section>

          <section className="planner-calendar">
            <CalendarPanel
              selectedDate={selectedDate}
              onSelectedDateChange={setSelectedDate}
              dayConfigs={dayConfigs}
              onDayConfigChange={handleDayConfigChange}
            />
          </section>
        </main>
      ) : (
        <main className="setup-view">
          <section className="setup-left">
            <InfoCard title="Business Profile">
              <label className="setup-field">
                Business type
                <select
                  value={businessType}
                  onChange={handleBusinessTypeChange}
                  className="business-select setup-select"
                >
                  <option value="gym">Gym / Fitness</option>
                  <option value="cafe">Cafe / Restaurant</option>
                </select>
              </label>
              <p className="upload-info">
                Opening hours: {openingHours.open} - {openingHours.close}
              </p>
            </InfoCard>

            <InfoCard title="Upload CSV data">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvChange}
                className="csv-input"
              />
              {uploadError && <p className="upload-error">{uploadError}</p>}
              {uploadInfo && !uploadError && (
                <p className="upload-info">
                  Loaded <strong>{uploadInfo.rows}</strong> rows
                  {uploadInfo.skippedRows > 0
                    ? `; skipped ${uploadInfo.skippedRows} invalid or out-of-hours rows`
                    : ""}
                  . Metric: {uploadInfo.demandMetric?.column || "row count"}.
                  {uploadInfo.observedDays
                    ? ` Observed days: ${uploadInfo.observedDays}.`
                    : ""}
                  {uploadInfo.actualStaffRows > 0
                    ? ` Actual staffing rows: ${uploadInfo.actualStaffRows}.`
                    : ""}
                  {uploadInfo.intervalMinutes !== operatingRules.intervalMinutes
                    ? " Re-upload after changing block size."
                    : ""}
                </p>
              )}
              {!uploadInfo && !uploadError && (
                <p className="upload-info">
                  CSV needs a time, timestamp, date, or datetime column.
                </p>
              )}
            </InfoCard>

            <InfoCard title="Accuracy Check">
              {backtestSummary ? (
                <p className="upload-info">
                  Avg error {backtestSummary.meanAbsoluteError.toFixed(1)} staff
                  / block. Under: {backtestSummary.underStaffedBlocks}. Over:{" "}
                  {backtestSummary.overStaffedBlocks}.
                </p>
              ) : (
                <p className="upload-info">Upload a CSV with staff counts.</p>
              )}
            </InfoCard>
          </section>

          <section className="setup-right">
            <AccuracySettingsPanel
              operatingRules={operatingRules}
              onOperatingRulesChange={handleOperatingRulesChange}
            />
            <StaffBreakdownPanel
              roles={roles}
              peakStaff={peakStaff}
              onStaffingChange={handleStaffingChange}
            />
          </section>
        </main>
      )}
    </div>
  );
}

export default DashboardPage;
