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
  parseLocalDateKey,
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

function getBusinessTypeLabel(businessType) {
  if (businessType === "gym") return "Gym / Fitness";
  if (businessType === "cafe") return "Cafe / Restaurant";
  return businessType;
}

function getDayTypeLabel(dayType) {
  if (dayType === "quiet") return "Quiet day";
  if (dayType === "busy") return "Busy day";
  if (dayType === "event") return "Event day";
  return "Normal day";
}

function getFriendlyConfidence(confidence) {
  if (confidence.label === "Preset") {
    return {
      value: "Starter estimate",
      detail: "Based on your business profile until you upload trading data.",
    };
  }

  return {
    value: confidence.label,
    detail: confidence.detail,
  };
}

function parseSelectedDateLabel(dateKey) {
  return parseLocalDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatStaffHours(hours) {
  const rounded = Math.round((Number(hours) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function MetricIcon({ name }) {
  const icons = {
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16" cy="10" r="2.5" />
        <path d="M4 19c.7-3 2.4-5 5-5s4.3 2 5 5" />
        <path d="M13.5 15.3c2 .4 3.2 1.8 3.8 3.7" />
      </>
    ),
    trend: (
      <>
        <path d="M4 16l5-5 4 3 6-7" />
        <path d="M15 7h4v4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 4l7 3v5c0 4-2.8 6.8-7 8-4.2-1.2-7-4-7-8V7l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    document: (
      <>
        <path d="M7 4h7l4 4v12H7z" />
        <path d="M14 4v5h4" />
        <path d="M9.5 13h5" />
        <path d="M9.5 16h4" />
      </>
    ),
  };

  return (
    <svg
      className="planner-metric-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      {icons[name]}
    </svg>
  );
}

function PlannerMetricCard({
  label,
  value,
  detail,
  tone = "default",
  icon,
  featured = false,
}) {
  return (
    <article
      className={
        `planner-metric-card planner-metric-${tone}` +
        (featured ? " planner-metric-featured" : "")
      }
    >
      <div className="planner-metric-topline">
        <span className="planner-metric-label">{label}</span>
        {icon && <MetricIcon name={icon} />}
      </div>
      <strong className="planner-metric-value">{value}</strong>
      {detail && <p className="planner-metric-detail">{detail}</p>}
    </article>
  );
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
      return { value: "No data", detail: "" };
    }

    const numericDemandUnits = chartData
      .map((point) => point.demandUnits)
      .filter((value) => typeof value === "number" && value > 0);

    if (numericDemandUnits.length > 0) {
      const maxUnits = Math.max(...numericDemandUnits);
      const metric = csvCurves?.demandMetric;
      const isMoney = metric?.type === "money";

      return {
        value: isMoney
          ? `GBP ${Math.round(maxUnits).toLocaleString()}`
          : Math.round(maxUnits).toLocaleString(),
        detail: metric?.column
          ? `Highest forecast block from ${metric.column}.`
          : "Highest forecast block from uploaded data.",
      };
    }

    const maxDemandScore = Math.max(
      ...chartData.map((point) => point.demandScore || 0)
    );

    return {
      value: `${Math.round(maxDemandScore * 100)}%`,
      detail: hasCsv
        ? "Relative to the busiest uploaded pattern."
        : "Relative to your business profile.",
    };
  }, [chartData, csvCurves, hasCsv]);

  const friendlyConfidence = getFriendlyConfidence(demandConfidence);
  const selectedDateLabel = parseSelectedDateLabel(selectedDate);
  const staffHoursLabel = formatStaffHours(totalStaffHours);
  const forecastBasis = hasCsv
    ? `Uploaded ${csvCurves.rows.toLocaleString()} rows across ${
        csvCurves.observedDays || "several"
      } observed days.`
    : "Based on your business profile and busiest-time role settings.";

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
          <p className="subtitle">Today&apos;s staffing plan, built for the way your day changes.</p>

          <p className="business-type-label">
            Profile for: <strong>{getBusinessTypeLabel(businessType)}</strong>
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
            {selectedDate} /{" "}
            {hasCsv ? "Based on uploaded data" : "Based on your business profile"} /{" "}
            {getDayTypeLabel(dayType)}
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

      {dashboardError && (
        <div className="banner banner-error">{dashboardError}</div>
      )}

      {activeView === "planner" ? (
        <main className="planner-view">
          <section className="planner-heading">
            <div>
              <p className="section-kicker">Planner View</p>
              <h2>Today&apos;s staffing plan</h2>
              <p>
                {selectedDateLabel} is set as a{" "}
                {getDayTypeLabel(dayType).toLowerCase()}. Forecasts improve as
                more history is added.
              </p>
            </div>
          </section>

          <section className="planner-recommendation-panel">
            <div className="planner-recommendation-copy">
              <span className="planner-recommendation-label">
                Key recommendation
              </span>
              <h3>
                Plan for {staffHoursLabel} staff hours today.
              </h3>
              <p>
                Heaviest cover is expected around {peakHoursLabel}. Use this as
                a rota starting point, then adjust for local context you know
                about.
              </p>
            </div>
            <div className="planner-recommendation-stats">
              <div>
                <span>Busiest period</span>
                <strong>{peakHoursLabel}</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{friendlyConfidence.value}</strong>
              </div>
            </div>
          </section>

          <section className="planner-metrics" aria-label="Staffing plan summary">
            <PlannerMetricCard
              label="Peak demand"
              value={peakDemandSummary.value}
              detail={peakDemandSummary.detail}
              icon="trend"
              tone="amber"
            />
            <PlannerMetricCard
              label="Forecast confidence"
              value={friendlyConfidence.value}
              detail={friendlyConfidence.detail}
              tone={friendlyConfidence.value === "High" ? "success" : "default"}
              icon="shield"
            />
            <PlannerMetricCard
              label="Forecast based on"
              value={hasCsv ? "Uploaded data" : "Business profile"}
              detail={forecastBasis}
              icon="document"
            />
          </section>

          <section className="planner-workspace">
            <div className="planner-chart">
              <ShapeOfDayChart roles={roles} data={chartData} />
            </div>

            <div className="planner-calendar">
              <CalendarPanel
                selectedDate={selectedDate}
                onSelectedDateChange={setSelectedDate}
                dayConfigs={dayConfigs}
                onDayConfigChange={handleDayConfigChange}
              />
            </div>
          </section>
        </main>
      ) : (
        <main className="setup-view">
          <section className="setup-heading">
            <p className="section-kicker">Setup View</p>
            <h2>Business setup</h2>
            <p>
              Keep the profile, data upload, and role assumptions up to date so
              the planner stays useful.
            </p>
          </section>

          <section className="setup-layout">
            <div className="setup-left">
              <InfoCard
                title="Business profile"
                subtitle="These basics decide the starter forecast before you upload data."
                className="setup-card"
              >
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

              <InfoCard
                title="Data upload"
                subtitle="Upload trading data to replace the starter estimate with your real pattern."
                className="setup-card"
              >
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
                    {uploadInfo.intervalMinutes !==
                    operatingRules.intervalMinutes
                      ? " Re-upload after changing block size."
                      : ""}
                  </p>
                )}
                {!uploadInfo && !uploadError && (
                  <p className="upload-info">
                    Upload trading data later to replace this starter estimate.
                    CSV needs a time, timestamp, date, or datetime column.
                  </p>
                )}

                <div className="setup-inline-status">
                  <span>Staffing history check</span>
                  <p>
                    {backtestSummary
                      ? `Average difference: ${backtestSummary.meanAbsoluteError.toFixed(
                          1
                        )} staff per block.`
                      : "Upload staff counts to compare the forecast with past rotas."}
                  </p>
                </div>
              </InfoCard>

              <AccuracySettingsPanel
                operatingRules={operatingRules}
                onOperatingRulesChange={handleOperatingRulesChange}
              />
            </div>

            <div className="setup-right">
              <StaffBreakdownPanel
                roles={roles}
                peakStaff={peakStaff}
                onStaffingChange={handleStaffingChange}
              />
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default DashboardPage;
