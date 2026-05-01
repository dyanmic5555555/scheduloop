import { useMemo, useState } from "react";
import { parseLocalDateKey, toLocalDateKey } from "../utils/schedule";

const DAY_TYPE_OPTIONS = [
  { value: "quiet", label: "Quiet" },
  { value: "normal", label: "Normal" },
  { value: "busy", label: "Busy" },
  { value: "event", label: "Event day" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const getDayTypeLabel = (dayType) => {
    const option = DAY_TYPE_OPTIONS.find((item) => item.value === dayType);
    return option ? option.label : dayType;
  };

  return (
    <div className="card calendar-panel">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goPrevMonth}
        >
          &lt;
        </button>
        <div className="calendar-month-label">{monthInfo.monthLabel}</div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={goNextMonth}
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
          const isEventDay = dayType === "event";
          const dotTitle =
            config?.note || (dayType ? getDayTypeLabel(dayType) : undefined);

          return (
            <button
              key={iso}
              type="button"
              className={
                "calendar-day" +
                (isSelected ? " selected" : "") +
                (dayType ? ` calendar-day-${dayType}` : "")
              }
              onClick={() => handleDayClick(dateObj)}
            >
              <span className="calendar-day-number">{dayNum}</span>
              {dayType && (
                <span
                  className={
                    "calendar-day-dot" +
                    (isEventDay ? " calendar-day-dot-event" : "")
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
          <div className="calendar-detail-sub">
            Configure how this specific day behaves.
          </div>
        </div>

        <div className="calendar-daytype-row">
          {DAY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                "daytype-pill" +
                (selectedConfig.dayType === option.value ? " active" : "")
              }
              onClick={() =>
                onDayConfigChange(selectedDate, { dayType: option.value })
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <textarea
          className="calendar-note-input"
          placeholder="Add a note"
          value={selectedConfig.note || ""}
          onChange={(e) =>
            onDayConfigChange(selectedDate, { note: e.target.value })
          }
          rows={3}
        />
      </div>
    </div>
  );
}

export default CalendarPanel;
