const DEMAND_SOURCE_DEFINITIONS = [
  {
    key: "orders",
    type: "count",
    unitLabel: "orders",
    roleHints: ["general"],
    patterns: [/^orders?$/, /^order[_\s-]?count$/, /^sales[_\s-]?count$/],
  },
  {
    key: "transactions",
    type: "count",
    unitLabel: "transactions",
    roleHints: ["general"],
    patterns: [/^transactions?$/],
  },
  {
    key: "customers",
    type: "count",
    unitLabel: "customers",
    roleHints: ["general", "wait"],
    patterns: [/^customers?$/, /^guests?$/],
  },
  {
    key: "covers",
    type: "count",
    unitLabel: "covers",
    roleHints: ["general", "wait"],
    patterns: [/^covers?$/],
  },
  {
    key: "bookings",
    type: "count",
    unitLabel: "bookings",
    roleHints: ["general", "frontDesk"],
    patterns: [/^bookings?$/, /^appointments?$/],
  },
  {
    key: "visits",
    type: "count",
    unitLabel: "visits",
    roleHints: ["general", "frontDesk"],
    patterns: [/^visits?$/, /^check[_\s-]?ins?$/],
  },
  {
    key: "sales",
    type: "money",
    unitLabel: "revenue units",
    roleHints: ["general"],
    patterns: [/^revenue$/, /^sales$/, /^amount$/, /^total$/, /^price$/],
  },
  {
    key: "drinkOrders",
    type: "count",
    unitLabel: "drink orders",
    roleHints: ["barista"],
    roleSpecific: true,
    patterns: [
      /^drink[_\s-]?orders?$/,
      /^drinks?$/,
      /^coffee[_\s-]?orders?$/,
      /^beverage[_\s-]?orders?$/,
    ],
  },
  {
    key: "foodOrders",
    type: "count",
    unitLabel: "food orders",
    roleHints: ["kitchen"],
    roleSpecific: true,
    patterns: [/^food[_\s-]?orders?$/, /^meals?$/, /^kitchen[_\s-]?orders?$/],
  },
  {
    key: "dineInCustomers",
    type: "count",
    unitLabel: "dine-in customers",
    roleHints: ["wait"],
    roleSpecific: true,
    patterns: [/^dine[_\s-]?in[_\s-]?customers?$/],
  },
  {
    key: "takeawayOrders",
    type: "count",
    unitLabel: "takeaway orders",
    roleHints: ["barista", "kitchen"],
    roleSpecific: true,
    patterns: [/^takeaway[_\s-]?orders?$/, /^take[_\s-]?out[_\s-]?orders?$/],
  },
  {
    key: "frontDeskVisits",
    type: "count",
    unitLabel: "front desk visits",
    roleHints: ["frontDesk"],
    roleSpecific: true,
    patterns: [/^front[_\s-]?desk[_\s-]?visits?$/],
  },
  {
    key: "classBookings",
    type: "count",
    unitLabel: "class bookings",
    roleHints: ["class"],
    roleSpecific: true,
    patterns: [/^class[_\s-]?bookings?$/],
  },
  {
    key: "ptBookings",
    type: "count",
    unitLabel: "PT bookings",
    roleHints: ["personalTrainer"],
    roleSpecific: true,
    patterns: [/^pt[_\s-]?bookings?$/, /^personal[_\s-]?trainer[_\s-]?bookings?$/],
  },
  {
    key: "memberships",
    type: "count",
    unitLabel: "memberships",
    roleHints: ["frontDesk"],
    roleSpecific: true,
    patterns: [/^memberships?$/],
  },
];

const ROLE_SOURCE_RULES = [
  {
    terms: ["barista", "coffee", "drink", "drinks"],
    sourceKeys: ["drinkOrders", "takeawayOrders"],
  },
  {
    terms: ["kitchen", "chef", "cook", "food"],
    sourceKeys: ["foodOrders", "takeawayOrders"],
  },
  {
    terms: ["wait", "server", "floor"],
    sourceKeys: ["dineInCustomers", "customers", "covers"],
  },
  {
    terms: ["front desk", "frontdesk", "reception", "receptionist"],
    sourceKeys: ["frontDeskVisits", "visits", "bookings"],
  },
  {
    terms: ["class", "instructor"],
    sourceKeys: ["classBookings"],
  },
  {
    terms: ["personal trainer", "pt", "trainer"],
    sourceKeys: ["ptBookings"],
  },
];

const GENERAL_SOURCE_PRIORITY = [
  "orders",
  "transactions",
  "customers",
  "covers",
  "bookings",
  "visits",
  "sales",
];

function normalizeHeader(header) {
  return String(header ?? "").replace(/^\uFEFF/, "").trim().toLowerCase();
}

function stripIndex(source) {
  if (!source) return null;
  const { index: _index, ...safeSource } = source;
  return safeSource;
}

export function detectDemandColumns(headers = []) {
  const sources = {};

  DEMAND_SOURCE_DEFINITIONS.forEach((definition) => {
    const index = headers.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return definition.patterns.some((pattern) => pattern.test(normalized));
    });

    if (index === -1) return;

    sources[definition.key] = {
      key: definition.key,
      index,
      column: headers[index],
      type: definition.type,
      unitLabel: definition.unitLabel,
      roleHints: definition.roleHints,
      roleSpecific: !!definition.roleSpecific,
    };
  });

  const generalKey = GENERAL_SOURCE_PRIORITY.find((key) => sources[key]);
  const general = generalKey ? sources[generalKey] : null;

  return {
    general,
    sources,
    hasRoleSpecificDemand: Object.values(sources).some(
      (source) => source.roleSpecific
    ),
  };
}

export function serializeDetectedDemandColumns(detectedColumns) {
  const sources = {};

  Object.entries(detectedColumns?.sources || {}).forEach(([key, source]) => {
    sources[key] = stripIndex(source);
  });

  return {
    general: stripIndex(detectedColumns?.general),
    sources,
    hasRoleSpecificDemand: !!detectedColumns?.hasRoleSpecificDemand,
  };
}

export function getDemandColumnForRole(role, detectedColumns) {
  const sources = detectedColumns?.sources || {};
  const general = detectedColumns?.general || null;
  const preferred = role?.preferredDemandSource;

  if (preferred && sources[preferred]) {
    return sources[preferred];
  }

  const roleText = `${role?.id || ""} ${role?.name || ""}`
    .replace(/[-_]/g, " ")
    .toLowerCase();

  const rule = ROLE_SOURCE_RULES.find((candidate) =>
    candidate.terms.some((term) => roleText.includes(term))
  );

  if (rule) {
    const sourceKey = rule.sourceKeys.find((key) => sources[key]);
    if (sourceKey) return sources[sourceKey];
  }

  return general;
}

export function getDemandValueForRole(row, role, detectedColumns, parseValue) {
  const source = getDemandColumnForRole(role, detectedColumns);
  if (!source || source.index === -1 || !parseValue) return null;
  return parseValue(row[source.index]);
}
