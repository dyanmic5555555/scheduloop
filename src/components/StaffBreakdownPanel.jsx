// src/components/StaffBreakdownPanel.jsx
import { useState } from "react";
import {
  normalizePositiveNumber,
  normalizeStaffCount,
} from "../utils/staffing";
import { normalizeHourlyWage } from "../utils/labourCost";
import { HOURS } from "../utils/schedule";

const COLOR_OPTIONS = ["#4f8cff", "#3bd68b", "#ff776f", "#facc15", "#a855f7"];

function StaffBreakdownPanel({ roles, peakStaff, onStaffingChange }) {
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState(COLOR_OPTIONS[0]);
  const [newRolePeak, setNewRolePeak] = useState(1);

  const commit = (nextRoles, nextPeakStaff) => {
    onStaffingChange(nextRoles, nextPeakStaff);
  };

  const handleAddRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;

    const id = `${trimmed.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const newRole = {
      id,
      name: trimmed,
      color: newRoleColor,
      curve: Array(HOURS.length).fill(1),
      serviceRate: 20,
      minStaff: 0,
      demandWeight: 1,
      requiredDuringOpen: false,
      hourlyWage: null,
    };

    commit([...roles, newRole], {
      ...peakStaff,
      [id]: normalizeStaffCount(newRolePeak),
    });

    setNewRoleName("");
    setNewRolePeak(1);
  };

  const handleRoleNameChange = (id, name) => {
    commit(
      roles.map((role) => (role.id === id ? { ...role, name } : role)),
      peakStaff
    );
  };

  const handleRoleColorChange = (id, color) => {
    commit(
      roles.map((role) => (role.id === id ? { ...role, color } : role)),
      peakStaff
    );
  };

  const handleRolePeakChange = (id, value) => {
    commit(roles, {
      ...peakStaff,
      [id]: normalizeStaffCount(value),
    });
  };

  const handleRoleAccuracyChange = (id, patch) => {
    commit(
      roles.map((role) => (role.id === id ? { ...role, ...patch } : role)),
      peakStaff
    );
  };

  const handleRemoveRole = (id) => {
    const nextPeakStaff = { ...peakStaff };
    delete nextPeakStaff[id];
    commit(
      roles.filter((role) => role.id !== id),
      nextPeakStaff
    );
  };

  return (
    <div className="card staff-panel">
      <h2 className="card-title">Role setup</h2>
      <p className="card-subtitle">
        Keep the roles, cover levels, and optional wage estimates aligned with
        how the business actually runs.
      </p>

      <div className="staff-role-list">
        {roles.map((role) => (
          <div key={role.id} className="staff-role-row">
            <div className="staff-role-card-header">
              <div className="staff-role-main">
                <span
                  className="staff-role-color-dot"
                  style={{ backgroundColor: role.color }}
                />
                <input
                  className="staff-role-name-input"
                  aria-label={`Role name for ${role.name || "staff role"}`}
                  value={role.name}
                  onChange={(e) =>
                    handleRoleNameChange(role.id, e.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="staff-role-remove"
                onClick={() => handleRemoveRole(role.id)}
                aria-label={`Remove ${role.name}`}
              >
                Remove
              </button>
            </div>

            <div className="staff-role-controls">
              <div className="staff-role-peak">
                <label className="staff-role-peak-label">
                  Peak cover
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="staff-role-peak-input"
                    placeholder="0"
                    value={peakStaff?.[role.id] ?? 0}
                    onChange={(e) =>
                      handleRolePeakChange(role.id, e.target.value)
                    }
                  />
                </label>
              </div>

              <label className="staff-role-peak-label">
                Capacity/hr
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="staff-role-peak-input"
                  placeholder="20"
                  value={role.serviceRate ?? 0}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      serviceRate: normalizePositiveNumber(e.target.value, 0),
                    })
                  }
                />
              </label>

              <label className="staff-role-peak-label">
                Min cover
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="staff-role-peak-input"
                  placeholder="0"
                  value={role.minStaff ?? 0}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      minStaff: normalizeStaffCount(e.target.value),
                    })
                  }
                />
              </label>

              <label className="staff-role-peak-label">
                Demand share %
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="staff-role-peak-input"
                  placeholder="100"
                  value={Math.round((role.demandWeight ?? 1) * 100)}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      demandWeight:
                        normalizePositiveNumber(e.target.value, 0) / 100,
                    })
                  }
                />
              </label>

              <label className="staff-role-peak-label">
                Wage/hr
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="staff-role-peak-input"
                  placeholder="Optional"
                  value={role.hourlyWage ?? ""}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      hourlyWage: normalizeHourlyWage(e.target.value),
                    })
                  }
                />
              </label>

              <label className="staff-role-check">
                <input
                  type="checkbox"
                  checked={!!role.requiredDuringOpen}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      requiredDuringOpen: e.target.checked,
                    })
                  }
                />
                Cover while open
              </label>

              <div className="staff-role-color-picker">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={
                      "staff-color-swatch" +
                      (role.color === color
                        ? " staff-color-swatch-selected"
                        : "")
                    }
                    style={{ backgroundColor: color }}
                    aria-label={`Set ${role.name} colour to ${color}`}
                    aria-pressed={role.color === color}
                    onClick={() => handleRoleColorChange(role.id, color)}
                  />
                ))}
              </div>

              <div className="staff-role-control-note">Busiest time setup</div>
            </div>
          </div>
        ))}

        {roles.length === 0 && (
          <p className="staff-empty-text">
            No roles yet. Add at least one staff role to start planning.
          </p>
        )}
      </div>

      <div className="staff-add-block">
        <h3 className="staff-add-title">Add a role</h3>

        <div className="staff-add-row">
          <input
            type="text"
            className="staff-add-input"
            placeholder="e.g. Supervisor"
            aria-label="New role name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />

          <input
            type="number"
            min="0"
            step="1"
            className="staff-add-peak-input"
            value={newRolePeak}
            onChange={(e) => setNewRolePeak(e.target.value)}
            aria-label="New role max staff at peak"
            title="Max staff at your busiest hour"
          />

          <button
            type="button"
            className="staff-add-button"
            onClick={handleAddRole}
          >
            Add
          </button>
        </div>

        <div className="staff-add-color-row">
          <span className="staff-add-color-label">Colour</span>
          <div className="staff-add-color-picker">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={
                  "staff-color-swatch" +
                  (newRoleColor === color
                    ? " staff-color-swatch-selected"
                    : "")
                }
                style={{ backgroundColor: color }}
                aria-label={`Set new role colour to ${color}`}
                aria-pressed={newRoleColor === color}
                onClick={() => setNewRoleColor(color)}
              />
            ))}
          </div>
        </div>

        <p className="staff-add-hint">
          Scheduloop uses peak cover to scale this role up and down across the
          day.
        </p>
      </div>
    </div>
  );
}

export default StaffBreakdownPanel;
