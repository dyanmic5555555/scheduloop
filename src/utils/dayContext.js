export const WEATHER_CONDITIONS = [
  "normal",
  "rain",
  "sunny",
  "hot",
  "cold",
  "windy",
];

export const DAY_CONTEXT_TAGS = [
  { key: "promotion", label: "Promotion" },
  { key: "localEvent", label: "Local event nearby" },
  { key: "roadworks", label: "Roadworks nearby" },
  { key: "sportEvent", label: "Sport event nearby" },
  { key: "schoolHoliday", label: "School holiday" },
  { key: "studentTerm", label: "Student term time" },
  { key: "payday", label: "Payday period" },
  { key: "bankHoliday", label: "Bank holiday" },
];

// Conservative starting assumptions. Future versions should learn these per
// business instead of treating the defaults as universal truth.
export const DEFAULT_CONTEXT_MULTIPLIERS = {
  promotion: 1.15,
  localEvent: 1.2,
  roadworks: 0.9,
  sportEvent: 1.15,
  schoolHoliday: 1.05,
  studentTerm: 1.08,
  payday: 1.08,
  bankHoliday: 1.1,
  weather: {
    rain: 0.95,
    sunny: 1.05,
    hot: 1.08,
    cold: 1.03,
    windy: 0.97,
    normal: 1,
  },
};

const CONTEXT_KEYS = DAY_CONTEXT_TAGS.map((tag) => tag.key);
const MIN_CONTEXT_MULTIPLIER = 0.7;
const MAX_CONTEXT_MULTIPLIER = 1.5;

export function getDefaultDayContext() {
  return {
    promotion: false,
    localEvent: false,
    roadworks: false,
    sportEvent: false,
    schoolHoliday: false,
    studentTerm: false,
    payday: false,
    bankHoliday: false,
    weather: {
      enabled: false,
      condition: "normal",
      temperatureC: null,
    },
  };
}

function normaliseTemperatureC(value) {
  if (value === "" || value === null || value === undefined) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  return Math.round(Math.min(Math.max(num, -50), 60) * 10) / 10;
}

export function normaliseDayContext(context) {
  const source =
    context && typeof context === "object" && !Array.isArray(context)
      ? context
      : {};
  const defaultContext = getDefaultDayContext();
  const weather =
    source.weather &&
    typeof source.weather === "object" &&
    !Array.isArray(source.weather)
      ? source.weather
      : {};
  const condition = WEATHER_CONDITIONS.includes(weather.condition)
    ? weather.condition
    : defaultContext.weather.condition;

  return {
    ...defaultContext,
    ...Object.fromEntries(
      CONTEXT_KEYS.map((key) => [key, source[key] === true])
    ),
    weather: {
      enabled: weather.enabled === true,
      condition,
      temperatureC: normaliseTemperatureC(weather.temperatureC),
    },
  };
}

export function normaliseDayConfigs(dayConfigs) {
  if (!dayConfigs || typeof dayConfigs !== "object" || Array.isArray(dayConfigs)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(dayConfigs).map(([date, config]) => {
      const safeConfig =
        config && typeof config === "object" && !Array.isArray(config)
          ? config
          : {};
      const nextConfig = { ...safeConfig };

      if ("context" in safeConfig) {
        nextConfig.context = normaliseDayContext(safeConfig.context);
      }

      return [date, nextConfig];
    })
  );
}

export function hasActiveDayContext(context) {
  const normalised = normaliseDayContext(context);
  return (
    CONTEXT_KEYS.some((key) => normalised[key]) ||
    normalised.weather.enabled
  );
}

function getTagLabel(key) {
  return DAY_CONTEXT_TAGS.find((tag) => tag.key === key)?.label || key;
}

function getWeatherLabel(condition) {
  if (condition === "normal") return "Normal weather";
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

export function getActiveContextLabels(context) {
  const normalised = normaliseDayContext(context);
  const labels = CONTEXT_KEYS.filter((key) => normalised[key]).map(getTagLabel);

  if (normalised.weather.enabled) {
    labels.push(getWeatherLabel(normalised.weather.condition));
  }

  return labels;
}

function clampMultiplier(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(num, MIN_CONTEXT_MULTIPLIER), MAX_CONTEXT_MULTIPLIER);
}

function formatPercentEffect(multiplier) {
  const percent = Math.round((multiplier - 1) * 100);
  if (percent > 0) return `+${percent}%`;
  return `${percent}%`;
}

export function calculateContextMultiplier(context) {
  const normalised = normaliseDayContext(context);
  if (!hasActiveDayContext(normalised)) return 1;

  const tagMultiplier = CONTEXT_KEYS.reduce((multiplier, key) => {
    if (!normalised[key]) return multiplier;
    return multiplier * (DEFAULT_CONTEXT_MULTIPLIERS[key] || 1);
  }, 1);
  const weatherMultiplier = normalised.weather.enabled
    ? DEFAULT_CONTEXT_MULTIPLIERS.weather[normalised.weather.condition] || 1
    : 1;

  return clampMultiplier(tagMultiplier * weatherMultiplier);
}

export function getContextAdjustmentSummary(context) {
  const normalised = normaliseDayContext(context);
  const multiplier = calculateContextMultiplier(normalised);

  if (!hasActiveDayContext(normalised)) {
    return {
      multiplier: 1,
      percentChange: 0,
      labels: [],
    };
  }

  const labels = CONTEXT_KEYS.filter((key) => normalised[key]).map((key) => {
    const tagMultiplier = DEFAULT_CONTEXT_MULTIPLIERS[key] || 1;
    return `${getTagLabel(key)}: ${formatPercentEffect(tagMultiplier)}`;
  });

  if (normalised.weather.enabled) {
    const weatherMultiplier =
      DEFAULT_CONTEXT_MULTIPLIERS.weather[normalised.weather.condition] || 1;
    labels.push(
      `${getWeatherLabel(normalised.weather.condition)}: ${formatPercentEffect(
        weatherMultiplier
      )}`
    );
  }

  return {
    multiplier,
    percentChange: Math.round((multiplier - 1) * 100),
    labels,
  };
}

export function getLearnedContextMultiplier({
  context,
  historicalDays,
  selectedDate,
} = {}) {
  // TODO: Learn business-specific effects by comparing similar tagged days
  // against similar untagged days, such as rainy Fridays versus normal Fridays.
  if (!hasActiveDayContext(context) || !Array.isArray(historicalDays)) {
    return null;
  }

  if (!selectedDate) return null;
  return null;
}
