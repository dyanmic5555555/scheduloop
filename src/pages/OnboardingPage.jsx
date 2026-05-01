import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessProfile } from "../business/BusinessProfileContext";
import {
  DEFAULT_OPERATING_RULES,
  getBusinessPresetRoles,
  normalizeRolesForAccuracy,
} from "../config/businessPresets";
import { HOURS, isOpeningHoursValid } from "../utils/schedule";
import { normalizeStaffCount } from "../utils/staffing";

const COLOR_OPTIONS = ["#4f8cff", "#3bd68b", "#ff776f", "#facc15", "#a855f7"];
const DEFAULT_CURVE = Array(10).fill(1);

function OnboardingPage() {
  const navigate = useNavigate();
  const { profile, saveProfile } = useBusinessProfile();
  const initialBusinessType = profile?.businessType || "gym";
  const initialRoles =
    profile?.roles && profile.roles.length > 0
      ? normalizeRolesForAccuracy(profile.roles)
      : getBusinessPresetRoles(initialBusinessType);

  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState(initialBusinessType);
  const [roles, setRoles] = useState(initialRoles);
  const [openingHours, setOpeningHours] = useState({
    open: profile?.hours?.open || "09:00",
    close: profile?.hours?.close || "17:00",
  });
  const [busyLevel, setBusyLevel] = useState(profile?.busyLevel || "normal");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState(COLOR_OPTIONS[0]);
  const [peakStaff, setPeakStaff] = useState(profile?.peakStaff || {});
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openingHoursValid = isOpeningHoursValid(openingHours);

  const handleBusinessTypeSelect = (type) => {
    setBusinessType(type);
    const presetRoles = getBusinessPresetRoles(type);
    setRoles(presetRoles);
    const defaults = {};
    presetRoles.forEach((role) => {
      defaults[role.id] = peakStaff[role.id] ?? 1;
    });
    setPeakStaff(defaults);
  };

  const handleAddRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;

    const newRole = {
      id: `${trimmed.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: trimmed,
      color: newRoleColor,
      curve: DEFAULT_CURVE,
      serviceRate: 20,
      minStaff: 0,
      demandWeight: 1,
      requiredDuringOpen: false,
    };

    setRoles((prev) => [...prev, newRole]);
    setPeakStaff((prev) => ({
      ...prev,
      [newRole.id]: 1,
    }));
    setNewRoleName("");
  };

  const handleRemoveRole = (id) => {
    setRoles((prev) => prev.filter((role) => role.id !== id));
    setPeakStaff((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handlePeakStaffChange = (roleId, value) => {
    setPeakStaff((prev) => ({
      ...prev,
      [roleId]: normalizeStaffCount(value),
    }));
  };

  const handleFinish = async () => {
    setSaveError("");
    setIsSaving(true);

    const businessProfile = {
      businessType,
      roles,
      hours: {
        open: openingHours.open,
        close: openingHours.close,
        hoursList: HOURS,
      },
      busyLevel,
      peakStaff,
      operatingRules: profile?.operatingRules || DEFAULT_OPERATING_RULES,
    };

    try {
      await saveProfile(businessProfile);
      navigate("/");
    } catch (err) {
      console.error(err);
      setSaveError("We could not save your business profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const canGoNext =
    (step === 0 && businessType) ||
    (step === 1 && roles.length > 0) ||
    (step === 2 && openingHoursValid) ||
    step === 3 ||
    step === 4;

  const goNext = () => {
    if (step === 4) {
      handleFinish();
    } else if (canGoNext) {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <div className="app auth-screen">
      <div className="auth-card onboarding-card">
        <div className="onboarding-header">
          <h1>Set up your business</h1>
          <p className="subtitle">
            We&apos;ll use these answers to generate your Shape of the Day.
          </p>
        </div>

        <div className="onboarding-steps">
          {["Business", "Roles", "Hours", "Busy level", "Peak staff"].map(
            (label, index) => (
              <div
                key={label}
                className={
                  "onboarding-step" +
                  (index === step ? " active" : "") +
                  (index < step ? " done" : "")
                }
              >
                <div className="onboarding-step-dot" />
                <span className="onboarding-step-label">{label}</span>
              </div>
            )
          )}
        </div>

        <div className="onboarding-body">
          {step === 0 && (
            <div>
              <h2 className="onboarding-title">What type of business is this?</h2>
              <p className="onboarding-text">
                We&apos;ll start you with a default pattern for your industry.
              </p>

              <div className="business-type-grid">
                <button
                  type="button"
                  onClick={() => handleBusinessTypeSelect("gym")}
                  className={
                    "business-type-card" +
                    (businessType === "gym" ? " selected" : "")
                  }
                >
                  <span className="business-type-title">Gym / Fitness</span>
                  <span className="business-type-sub">
                    Check-ins, classes, peak hours.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBusinessTypeSelect("cafe")}
                  className={
                    "business-type-card" +
                    (businessType === "cafe" ? " selected" : "")
                  }
                >
                  <span className="business-type-title">Cafe / Restaurant</span>
                  <span className="business-type-sub">
                    Coffee rushes, lunch and evening service.
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="onboarding-title">Which staff roles do you use?</h2>
              <p className="onboarding-text">
                Start from our suggestion and add or remove roles.
              </p>

              <ul className="roles-list">
                {roles.map((role) => (
                  <li key={role.id} className="role-item">
                    <div className="role-main">
                      <span
                        className="role-color-dot"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="role-name">{role.name}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-role-button"
                      onClick={() => handleRemoveRole(role.id)}
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>

              <div className="add-role-section">
                <h3 className="add-role-title">Add a role</h3>
                <div className="add-role-row">
                  <input
                    type="text"
                    placeholder={
                      businessType === "gym" ? "e.g. Lifeguards" : "e.g. Porter"
                    }
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="add-role-input"
                  />
                  <button
                    type="button"
                    className="add-role-button"
                    onClick={handleAddRole}
                  >
                    Add
                  </button>
                </div>

                <div className="color-picker-label">Colour</div>
                <div className="color-picker">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        "color-swatch" +
                        (newRoleColor === color ? " color-swatch-selected" : "")
                      }
                      style={{ backgroundColor: color }}
                      onClick={() => setNewRoleColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="onboarding-title">What are your opening hours?</h2>
              <p className="onboarding-text">
                We&apos;ll only forecast within these hours.
              </p>

              <div className="hours-row">
                <div className="hours-field">
                  <label className="hours-label">Opens</label>
                  <select
                    className="hours-select"
                    value={openingHours.open}
                    onChange={(e) =>
                      setOpeningHours((prev) => ({
                        ...prev,
                        open: e.target.value,
                      }))
                    }
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hours-field">
                  <label className="hours-label">Closes</label>
                  <select
                    className="hours-select"
                    value={openingHours.close}
                    onChange={(e) =>
                      setOpeningHours((prev) => ({
                        ...prev,
                        close: e.target.value,
                      }))
                    }
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!openingHoursValid && (
                <p className="form-error">
                  Closing time must be later than opening time.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="onboarding-title">How busy is a typical day?</h2>
              <p className="onboarding-text">
                Once you upload CSV data, we&apos;ll use that instead.
              </p>

              <div className="busy-level-grid">
                {[
                  { value: "quiet", label: "Quiet" },
                  { value: "normal", label: "Normal" },
                  { value: "busy", label: "Busy" },
                  { value: "veryBusy", label: "Very busy" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBusyLevel(opt.value)}
                    className={
                      "busy-level-card" +
                      (busyLevel === opt.value ? " selected" : "")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="onboarding-summary">
                <h3>Summary so far</h3>
                <ul>
                  <li>
                    Business type:{" "}
                    <strong>
                      {businessType === "gym"
                        ? "Gym / Fitness"
                        : "Cafe / Restaurant"}
                    </strong>
                  </li>
                  <li>
                    Roles:{" "}
                    <strong>
                      {roles.map((role) => role.name).join(", ") || "None"}
                    </strong>
                  </li>
                  <li>
                    Hours:{" "}
                    <strong>
                      {openingHours.open} - {openingHours.close}
                    </strong>
                  </li>
                  <li>
                    Typical day:{" "}
                    <strong>
                      {busyLevel === "quiet"
                        ? "Quiet"
                        : busyLevel === "normal"
                          ? "Normal"
                          : busyLevel === "busy"
                            ? "Busy"
                            : "Very busy"}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="onboarding-title">
                During your busiest hour, how many of each role do you need?
              </h2>
              <p className="onboarding-text">
                We&apos;ll use this to turn customer demand into staff numbers.
              </p>

              <div className="peak-staff-grid">
                {roles.map((role) => (
                  <div key={role.id} className="peak-staff-row">
                    <div className="peak-staff-label">
                      <span
                        className="role-color-dot"
                        style={{ backgroundColor: role.color }}
                      />
                      <span>{role.name}</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="peak-staff-input"
                      value={peakStaff[role.id] ?? 0}
                      onChange={(e) =>
                        handlePeakStaffChange(role.id, e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>

              <p className="onboarding-text small">
                Example: at your peak, you might need 3 baristas, 2 kitchen
                staff and 4 wait staff.
              </p>
            </div>
          )}
        </div>

        {saveError && <p className="form-error">{saveError}</p>}

        <div className="onboarding-footer">
          <button
            type="button"
            className="onboarding-nav-button secondary"
            onClick={goBack}
            disabled={step === 0 || isSaving}
          >
            Back
          </button>
          <button
            type="button"
            className="onboarding-nav-button primary"
            onClick={goNext}
            disabled={!canGoNext || isSaving}
          >
            {step === 4 ? (isSaving ? "Saving..." : "Finish and generate") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
