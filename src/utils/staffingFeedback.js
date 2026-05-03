import { getWeekdayFromDateKey } from "./schedule.js";

export const TOTAL_FEEDBACK_ROLE_ID = "total";

const FEEDBACK_OPTIONS = {
  overstaffed: -1,
  right: 0,
  understaffed: 1,
};

export function getStaffingFeedback(profile) {
  return Array.isArray(profile?.staffingFeedback)
    ? profile.staffingFeedback.filter(
        (entry) => entry && typeof entry === "object"
      )
    : [];
}

export function saveStaffingFeedback(existingFeedback = [], feedback) {
  const normalized = normalizeFeedback(feedback);
  const safeExistingFeedback = Array.isArray(existingFeedback)
    ? existingFeedback.filter((entry) => entry && typeof entry === "object")
    : [];

  if (!normalized) return safeExistingFeedback;

  const withoutDuplicate = safeExistingFeedback.filter(
    (entry) =>
      !(
        entry.date === normalized.date &&
        entry.hour === normalized.hour &&
        (entry.roleId || TOTAL_FEEDBACK_ROLE_ID) === normalized.roleId
      )
  );

  return [...withoutDuplicate, normalized].slice(-500);
}

export function getFeedbackCorrectionForHour({
  date,
  hour,
  roleId = TOTAL_FEEDBACK_ROLE_ID,
  feedbackEntries = [],
}) {
  const safeFeedbackEntries = Array.isArray(feedbackEntries)
    ? feedbackEntries
    : [];
  const match = safeFeedbackEntries.find(
    (entry) =>
      entry?.date === date &&
      entry.hour === hour &&
      (entry.roleId || TOTAL_FEEDBACK_ROLE_ID) === roleId
  );

  return safeCorrection(match?.correction);
}

export function getAverageFeedbackCorrection({
  weekday,
  hour,
  roleId = TOTAL_FEEDBACK_ROLE_ID,
  feedbackEntries = [],
}) {
  const safeFeedbackEntries = Array.isArray(feedbackEntries)
    ? feedbackEntries
    : [];
  const corrections = safeFeedbackEntries
    .filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (entry.hour !== hour) return false;
      if ((entry.roleId || TOTAL_FEEDBACK_ROLE_ID) !== roleId) return false;
      try {
        return getWeekdayFromDateKey(entry.date) === weekday;
      } catch {
        return false;
      }
    })
    .map((entry) => safeCorrection(entry.correction));

  if (corrections.length === 0) return 0;

  const average =
    corrections.reduce((sum, value) => sum + value, 0) / corrections.length;
  return Math.min(Math.max(average, -1), 1);
}

function normalizeFeedback(feedback) {
  if (!feedback?.date || !feedback?.hour) return null;

  const feedbackValue = feedback.feedback;
  if (!(feedbackValue in FEEDBACK_OPTIONS)) return null;

  const predictedStaff = safeStaffNumber(feedback.predictedStaff);
  const actualStaff = safeStaffNumber(feedback.actualStaff);
  const correction =
    feedback.correction === undefined
      ? FEEDBACK_OPTIONS[feedbackValue]
      : safeCorrection(feedback.correction);

  return {
    date: feedback.date,
    hour: feedback.hour,
    roleId: feedback.roleId || TOTAL_FEEDBACK_ROLE_ID,
    predictedStaff,
    actualStaff,
    feedback: feedbackValue,
    correction,
    updatedAt: new Date().toISOString(),
  };
}

function safeCorrection(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(Math.max(Math.round(num), -1), 1);
}

function safeStaffNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}
