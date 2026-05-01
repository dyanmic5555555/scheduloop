// src/components/StaffBreakdownPanel.jsx
import { useState } from "react";
import {
  normalizePositiveNumber,
  normalizeStaffCount,
} from "../utils/staffing";

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
      curve: Array(10).fill(1),
      serviceRate: 20,
      minStaff: 0,
      demandWeight: 1,
      requiredDuringOpen: false,
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
      <h2 className="card-title">Staff breakdown</h2>
      <p className="card-subtitle">
        Adjust your roles and how many of each you need at your busiest hour.
      </p>

      <div className="staff-role-list">
        {roles.map((role) => (
          <div key={role.id} className="staff-role-row">
            <div className="staff-role-main">
              <span
                className="staff-role-color-dot"
                style={{ backgroundColor: role.color }}
              />
              <input
                className="staff-role-name-input"
                value={role.name}
                onChange={(e) => handleRoleNameChange(role.id, e.target.value)}
              />
            </div>

            <div className="staff-role-controls">
              <div className="staff-role-peak">
                <label className="staff-role-peak-label">
                  Max at peak
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="staff-role-peak-input"
                    value={peakStaff?.[role.id] ?? 0}
                    onChange={(e) =>
                      handleRolePeakChange(role.id, e.target.value)
                    }
                  />
                </label>
              </div>

              <label className="staff-role-peak-label">
                Units / hour
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="staff-role-peak-input"
                  value={role.serviceRate ?? 0}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      serviceRate: normalizePositiveNumber(e.target.value, 0),
                    })
                  }
                />
              </label>

              <label className="staff-role-peak-label">
                Min
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="staff-role-peak-input"
                  value={role.minStaff ?? 0}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      minStaff: normalizeStaffCount(e.target.value),
                    })
                  }
                />
              </label>

              <label className="staff-role-peak-label">
                Share %
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="staff-role-peak-input"
                  value={Math.round((role.demandWeight ?? 1) * 100)}
                  onChange={(e) =>
                    handleRoleAccuracyChange(role.id, {
                      demandWeight:
                        normalizePositiveNumber(e.target.value, 0) / 100,
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
                Always cover
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
                    onClick={() => handleRoleColorChange(role.id, color)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="staff-role-remove"
                onClick={() => handleRemoveRole(role.id)}
              >
                x
              </button>
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
                onClick={() => setNewRoleColor(color)}
              />
            ))}
          </div>
        </div>

        <p className="staff-add-hint">
          We&apos;ll use the max staff number to scale this role up and down
          based on how busy each hour is.
        </p>
      </div>
    </div>
  );
}

export default StaffBreakdownPanel;
