import { normalizeOperatingRules } from "../config/businessPresets";
import {
  normalizePositiveNumber,
  normalizeStaffCount,
} from "../utils/staffing";
import { normalizeHourlyWage } from "../utils/labourCost";

function AccuracySettingsPanel({ operatingRules, onOperatingRulesChange }) {
  const rules = normalizeOperatingRules(operatingRules);

  const patchRules = (patch) => {
    onOperatingRulesChange({
      ...rules,
      ...patch,
    });
  };

  return (
    <div className="card accuracy-panel">
      <details className="advanced-settings">
        <summary>
          <span>Forecast tuning</span>
          <small>
            Most businesses can leave this alone. Use these settings when you
            want the plan to be more cautious.
          </small>
        </summary>

        <div className="accuracy-grid">
          <label className="accuracy-field">
            <span className="accuracy-field-label">Block size</span>
            <small>Smaller blocks show more detail.</small>
            <select
              value={rules.intervalMinutes}
              onChange={(e) =>
                patchRules({ intervalMinutes: Number(e.target.value) })
              }
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Demand buffer %</span>
            <small>Add a small cushion above forecast demand.</small>
            <input
              type="number"
              min="0"
              step="1"
              value={rules.demandBufferPercent}
              onChange={(e) =>
                patchRules({
                  demandBufferPercent: normalizePositiveNumber(
                    e.target.value,
                    0
                  ),
                })
              }
            />
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Break allowance %</span>
            <small>Allow extra cover for breaks.</small>
            <input
              type="number"
              min="0"
              step="1"
              value={rules.breakAllowancePercent}
              onChange={(e) =>
                patchRules({
                  breakAllowancePercent: normalizePositiveNumber(
                    e.target.value,
                    0
                  ),
                })
              }
            />
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Minimum total staff</span>
            <small>Keep at least this many people on.</small>
            <input
              type="number"
              min="0"
              step="1"
              value={rules.minTotalStaff}
              onChange={(e) =>
                patchRules({
                  minTotalStaff: normalizeStaffCount(e.target.value),
                })
              }
            />
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Average hourly wage</span>
            <small>Optional estimate, not payroll.</small>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rules.averageHourlyWage ?? ""}
              placeholder="Optional"
              onChange={(e) =>
                patchRules({
                  averageHourlyWage: normalizeHourlyWage(e.target.value),
                })
              }
            />
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Opening prep</span>
            <small>Cover before trading starts.</small>
            <input
              type="number"
              min="0"
              step="15"
              value={rules.prepMinutes}
              onChange={(e) =>
                patchRules({
                  prepMinutes: normalizePositiveNumber(e.target.value, 0),
                })
              }
            />
          </label>

          <label className="accuracy-field">
            <span className="accuracy-field-label">Closing cover</span>
            <small>Cover after the final trading block.</small>
            <input
              type="number"
              min="0"
              step="15"
              value={rules.closeMinutes}
              onChange={(e) =>
                patchRules({
                  closeMinutes: normalizePositiveNumber(e.target.value, 0),
                })
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}

export default AccuracySettingsPanel;
