import { normalizeOperatingRules } from "../config/businessPresets";
import {
  normalizePositiveNumber,
  normalizeStaffCount,
} from "../utils/staffing";

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
      <h2 className="card-title">Accuracy settings</h2>

      <div className="accuracy-grid">
        <label className="accuracy-field">
          Block size
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
          Demand buffer %
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
          Break allowance %
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
          Min total staff
          <input
            type="number"
            min="0"
            step="1"
            value={rules.minTotalStaff}
            onChange={(e) =>
              patchRules({ minTotalStaff: normalizeStaffCount(e.target.value) })
            }
          />
        </label>

        <label className="accuracy-field">
          Prep minutes
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
          Close minutes
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
    </div>
  );
}

export default AccuracySettingsPanel;
