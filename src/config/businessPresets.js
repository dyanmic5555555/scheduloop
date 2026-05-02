export const DEFAULT_OPERATING_RULES = {
  intervalMinutes: 30,
  demandBufferPercent: 10,
  minTotalStaff: 1,
  prepMinutes: 30,
  closeMinutes: 30,
  breakAllowancePercent: 5,
};

export const BUSINESS_ROLE_PRESETS = {
  gym: [
    {
      id: "frontDesk",
      name: "Front Desk",
      color: "#4f8cff",
      curve: [1, 1, 2, 3, 4, 3, 2, 2, 3, 4],
      serviceRate: 40,
      minStaff: 1,
      demandWeight: 1,
      preferredDemandSource: "visits",
      requiredDuringOpen: true,
    },
    {
      id: "pts",
      name: "PTs",
      color: "#3bd68b",
      curve: [0, 1, 2, 3, 3, 3, 2, 2, 3, 3],
      serviceRate: 8,
      minStaff: 0,
      demandWeight: 0.35,
      preferredDemandSource: "ptBookings",
      requiredDuringOpen: false,
    },
    {
      id: "classes",
      name: "Class Instructors",
      color: "#ff776f",
      curve: [0, 0, 1, 2, 3, 2, 1, 1, 2, 2],
      serviceRate: 20,
      minStaff: 0,
      demandWeight: 0.25,
      preferredDemandSource: "classBookings",
      requiredDuringOpen: false,
    },
  ],
  cafe: [
    {
      id: "barista",
      name: "Barista",
      color: "#4f8cff",
      curve: [1, 2, 3, 4, 4, 3, 2, 2, 2, 2],
      serviceRate: 25,
      minStaff: 1,
      demandWeight: 1,
      preferredDemandSource: "drinkOrders",
      requiredDuringOpen: true,
    },
    {
      id: "kitchen",
      name: "Kitchen",
      color: "#ff776f",
      curve: [1, 1, 2, 3, 4, 3, 2, 1, 1, 1],
      serviceRate: 18,
      minStaff: 1,
      demandWeight: 0.7,
      preferredDemandSource: "foodOrders",
      requiredDuringOpen: true,
    },
    {
      id: "wait",
      name: "Wait Staff",
      color: "#3bd68b",
      curve: [0, 1, 2, 3, 3, 3, 2, 2, 2, 2],
      serviceRate: 30,
      minStaff: 1,
      demandWeight: 1,
      preferredDemandSource: "customers",
      requiredDuringOpen: true,
    },
  ],
};

export function withRoleAccuracyDefaults(role) {
  return {
    serviceRate: 20,
    minStaff: 0,
    maxStaff: 0,
    demandWeight: 1,
    demandShare: 1,
    preferredDemandSource: "",
    requiredDuringOpen: false,
    ...role,
  };
}

export function normalizeRolesForAccuracy(roles) {
  return roles.map(withRoleAccuracyDefaults);
}

export function getBusinessPresetRoles(businessType) {
  return normalizeRolesForAccuracy(
    BUSINESS_ROLE_PRESETS[businessType] || BUSINESS_ROLE_PRESETS.gym
  );
}

export function normalizeOperatingRules(rules) {
  return {
    ...DEFAULT_OPERATING_RULES,
    ...(rules || {}),
  };
}
