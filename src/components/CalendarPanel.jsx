import { useEffect, useMemo, useState } from "react";
import { parseLocalDateKey, toLocalDateKey } from "../utils/schedule";
import {
  DAY_CONTEXT_TAGS,
  WEATHER_CONDITIONS,
  getActiveContextLabels,
  hasActiveDayContext,
  normaliseDayContext,
} from "../utils/dayContext";

const DAY_TYPE_OPTIONS = [
  { value: "quiet", label: "Quiet", helper: "Lower than usual" },
  { value: "normal", label: "Normal", helper: "Typical day" },
  { value: "busy", label: "Busy", helper: "Higher demand" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WEATHER_LABELS = {
  normal: "Normal",
  rain: "Rain",
  sunny: "Sunny",
  hot: "Hot",
  cold: "Cold",
  windy: "Windy",
};

function CalendarPanel({
  selectedDate,
  onSelectedDateChange,
  dayConfigs,
  onDayConfigChange,
}) {
  const [monthDate, setMonthDate] = useState(() =>
    parseLocalDateKey(selectedDate)
  );

  const monthInfo = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const firstWeekday = first.getDay();
    const nextMonth = new Date(year, month + 1, 1);
    const last = new Date(nextMonth - 1);
    const daysInMonth = last.getDate();
    const days = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(new Date(year, month, day));
    }

    const monthLabel = monthDate.toLocaleString(undefined, {
      month: "long",
      year: "numeric",
    });

    return { days, monthLabel };
  }, [monthDate]);

  const handleDayClick = (dateObj) => {
    if (!dateObj) return;
    onSelectedDateChange(toLocalDateKey(dateObj));
  };

  const goPrevMonth = () => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    setMonthDate(new Date(year, month - 1, 15));
  };

  const goNextMonth = () => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    setMonthDate(new Date(year, month + 1, 15));
  };

  const selectedConfig = dayConfigs[selectedDate] || {};
  const isLegacyEventDay = selectedConfig.dayType === "event";
  const selectedDayType = isLegacyEventDay
    ? "busy"
    : selectedConfig.dayType || "normal";
  const selectedContext = normaliseDayContext(selectedConfig.context);
  const selectedDisplayContext = isLegacyEventDay
    ? normaliseDayContext({ ...selectedContext, localEvent: true })
    : selectedContext;

  useEffect(() => {
    if (!isLegacyEventDay) return;

    onDayConfigChange(selectedDate, {
      dayType: "busy",
      context: normaliseDayContext({
        ...normaliseDayContext(selectedConfig.context),
        localEvent: true,
      }),
    });
  }, [
    isLegacyEventDay,
    onDayConfigChange,
    selectedDate,
    selectedConfig.context,
  ]);

  const getDayTypeLabel = (dayType) => {
    if (dayType === "event") return "Event day";
    const option = DAY_TYPE_OPTIONS.find((item) => item.value === dayType);
    return option ? option.label : dayType;
  };

  const updateSelectedContext = (patch) => {
    const nextContext = normaliseDayContext({
      ...selectedDisplayContext,
      ...patch,
      weather: {
        ...selectedDisplayContext.weather,
        ...(patch.weather || {}),
      },
    });

    onDayConfigChange(selectedDate, { context: nextContext });
  };

  return (
    <div className="card calendar-panel">
      <div className="calendar-title-row">
        <div>
          <h2 className="card-title">Plan by day</h2>
          <p className="calendar-helper">
            Set the overall demand level, then add context for unusual days.
          </p>
        </div>
      </div>

      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goPrevMonth}
          aria-label="Previous month"
        >
          &lt;
        </button>
        <div className="calendar-month-label">{monthInfo.monthLabel}</div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goNextMonth}
          aria-label="Next month"
        >
          &gt;
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {WEEKDAY_LABELS.map((weekday) => (
          <div key={weekday} className="calendar-weekday">
            {weekday}
          </div>
        ))}
      </div>

      <div className="calendar-grid calendar-days">
        {monthInfo.days.map((dateObj, index) => {
          if (!dateObj) {
            return <div key={`blank-${index}`} className="calendar-day empty" />;
          }

          const iso = toLocalDateKey(dateObj);
          const dayNum = dateObj.getDate();
          const isSelected = iso === selectedDate;
          const config = dayConfigs[iso];
          const dayType = config?.dayType;
          const displayDayType = dayType === "event" ? "busy" : dayType;
          const displayContext =
            dayType === "event"
              ? normaliseDayContext({
                  ...normaliseDayContext(config?.context),
                  localEvent: true,
                })
              : config?.context;
          const hasContext = hasActiveDayContext(displayContext);
          const contextLabels = getActiveContextLabels(displayContext);
          const dotTitle =
            config?.note ||
            [
              displayDayType ? getDayTypeLabel(displayDayType) : null,
              ...contextLabels,
            ]
              .filter(Boolean)
              .join(", ") ||
            undefined;
          const ariaContext =
            contextLabels.length > 0
              ? `, context: ${contextLabels.join(", ")}`
              : "";

          return (
            <button
              key={iso}
              type="button"
              className={
                "calendar-day" +
                (isSelected ? " selected" : "") +
                (displayDayType ? ` calendar-day-${displayDayType}` : "")
              }
              onClick={() => handleDayClick(dateObj)}
              aria-label={`${iso}${displayDayType ? `, ${getDayTypeLabel(displayDayType)}` : ""}${ariaContext}`}
            >
              <span className="calendar-day-number">{dayNum}</span>
              {(displayDayType || hasContext) && (
                <span
                  className={
                    "calendar-day-dot" +
                    (hasContext ? " calendar-day-dot-context" : "")
                  }
                  title={dotTitle}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar-detail">
        <div className="calendar-detail-header">
          <div className="calendar-detail-date">
            {parseLocalDateKey(selectedDate).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </div>
          <p className="calendar-guidance">
            Use demand level for the size of the day. Use context factors to
            explain why it may be different.
          </p>
        </div>

        <div className="calendar-demand-section">
          <div className="calendar-section-heading">
            <h3>Day demand level</h3>
            <p>Choose the overall demand level for this date.</p>
          </div>

          <div
            className="calendar-daytype-row"
            role="radiogroup"
            aria-label="Day demand level"
          >
            {DAY_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selectedDayType === option.value}
                className={
                  "daytype-pill" +
                  (selectedDayType === option.value ? " active" : "")
                }
                onClick={() =>
                  onDayConfigChange(selectedDate, { dayType: option.value })
                }
              >
                <span className={`daytype-dot daytype-dot-${option.value}`} />
                <span>{option.label}</span>
                <small>{option.helper}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="calendar-context-block">
          <div className="calendar-section-heading">
            <h3>Context factors</h3>
            <p>Add anything that might explain unusual demand.</p>
          </div>

          <div className="calendar-context-grid">
            {DAY_CONTEXT_TAGS.map((option) => (
              <label key={option.key} className="context-toggle">
                <input
                  type="checkbox"
                  checked={selectedDisplayContext[option.key]}
                  onChange={(event) =>
                    updateSelectedContext({
                      [option.key]: event.target.checked,
                    })
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className="calendar-weather-row">
            <label className="context-toggle context-weather-enabled">
              <input
                type="checkbox"
                checked={selectedDisplayContext.weather.enabled}
                onChange={(event) =>
                  updateSelectedContext({
                    weather: { enabled: event.target.checked },
                  })
                }
              />
              <span>Weather</span>
            </label>

            {selectedDisplayContext.weather.enabled && (
              <div className="calendar-weather-fields">
                <select
                  value={selectedDisplayContext.weather.condition}
                  onChange={(event) =>
                    updateSelectedContext({
                      weather: { condition: event.target.value },
                    })
                  }
                  aria-label="Weather condition"
                >
                  {WEATHER_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {WEATHER_LABELS[condition]}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="C"
                  value={selectedDisplayContext.weather.temperatureC ?? ""}
                  onChange={(event) =>
                    updateSelectedContext({
                      weather: { temperatureC: event.target.value },
                    })
                  }
                  aria-label="Temperature in Celsius"
                />
              </div>
            )}
          </div>
        </div>

        <label className="calendar-note-field">
          <span>Manager note</span>
          <textarea
            className="calendar-note-input"
            placeholder="Add a note, e.g. private booking, local roadworks, school holiday"
            value={selectedConfig.note || ""}
            onChange={(e) =>
              onDayConfigChange(selectedDate, { note: e.target.value })
            }
            rows={3}
          />
        </label>
      </div>
    </div>
  );
}

export default CalendarPanel;
