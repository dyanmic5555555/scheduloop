import { useMemo, useState } from "react";
import { TOTAL_FEEDBACK_ROLE_ID } from "../utils/staffingFeedback";

const FEEDBACK_BUTTONS = [
  { value: "overstaffed", label: "Overstaffed" },
  { value: "right", label: "Right" },
  { value: "understaffed", label: "Understaffed" },
];

function ForecastFeedbackPanel({
  selectedDate,
  chartData = [],
  roles = [],
  feedbackEntries = [],
  onFeedbackSave,
}) {
  const firstHour = chartData?.[0]?.hour || "";
  const [selectedHour, setSelectedHour] = useState(firstHour);
  const [selectedRoleId, setSelectedRoleId] = useState(TOTAL_FEEDBACK_ROLE_ID);
  const [actualStaff, setActualStaff] = useState("");

  const selectedPoint = useMemo(() => {
    const matchingPoint = chartData.find((point) => point.hour === selectedHour);
    return matchingPoint || chartData[0] || null;
  }, [chartData, selectedHour]);
  const safeSelectedRoleId =
    selectedRoleId === TOTAL_FEEDBACK_ROLE_ID ||
    roles.some((role) => role.id === selectedRoleId)
      ? selectedRoleId
      : TOTAL_FEEDBACK_ROLE_ID;

  if (!selectedPoint) return null;

  const safeSelectedHour = selectedPoint.hour;
  const predictedStaff =
    safeSelectedRoleId === TOTAL_FEEDBACK_ROLE_ID
      ? selectedPoint.total
      : selectedPoint[safeSelectedRoleId];
  const existingFeedback = feedbackEntries.find(
    (entry) =>
      entry?.date === selectedDate &&
      entry.hour === safeSelectedHour &&
      (entry.roleId || TOTAL_FEEDBACK_ROLE_ID) === safeSelectedRoleId
  );

  const handleSave = (feedback) => {
    onFeedbackSave({
      date: selectedDate,
      hour: safeSelectedHour,
      roleId: safeSelectedRoleId,
      predictedStaff,
      actualStaff: actualStaff === "" ? predictedStaff : Number(actualStaff),
      feedback,
    });
  };

  return (
    <div className="forecast-feedback-panel">
      <div>
        <h3>Forecast review</h3>
        <p>
          After a shift, mark one hour as overstaffed, right, or understaffed so
          future similar days can adjust gently.
        </p>
      </div>

      <div className="forecast-feedback-controls">
        <label>
          Hour
          <select
            value={safeSelectedHour}
            onChange={(event) => setSelectedHour(event.target.value)}
          >
            {chartData.map((point) => (
              <option key={point.hour} value={point.hour}>
                {point.hour}
              </option>
            ))}
          </select>
        </label>

        <label>
          Area
          <select
            value={safeSelectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
          >
            <option value={TOTAL_FEEDBACK_ROLE_ID}>Total staff</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Actual staff
          <input
            type="number"
            min="0"
            step="1"
            placeholder={String(predictedStaff ?? 0)}
            value={actualStaff}
            onChange={(event) => setActualStaff(event.target.value)}
          />
        </label>
      </div>

      <div className="forecast-feedback-actions">
        {FEEDBACK_BUTTONS.map((button) => (
          <button
            key={button.value}
            type="button"
            className={existingFeedback?.feedback === button.value ? "active" : ""}
            onClick={() => handleSave(button.value)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ForecastFeedbackPanel;
