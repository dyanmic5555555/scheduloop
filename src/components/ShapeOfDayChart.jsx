// src/components/ShapeOfDayChart.jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

// Inline custom tooltip component
const ShapeOfDayTooltip = ({ active, payload, label, roles }) => {
  if (!active || !payload || payload.length === 0) return null;

  const totalPoint = payload.find((p) => p.dataKey === "total");

  return (
    <div className="sod-tooltip">
      <div className="sod-tooltip-header">{label}</div>

      <div className="sod-tooltip-body">
        {payload
          .filter((p) => p.dataKey !== "total" && p.value !== 0)
          .map((p) => {
            const role = roles?.find((r) => r.id === p.dataKey);
            const name = role ? role.name : p.name || p.dataKey;

            return (
              <div key={p.dataKey} className="sod-tooltip-row">
                <span
                  className="sod-tooltip-dot"
                  style={{ backgroundColor: p.color }}
                />
                <span className="sod-tooltip-label">{name}</span>
                <span className="sod-tooltip-value">{p.value}</span>
              </div>
            );
          })}

        {totalPoint && (
          <div className="sod-tooltip-row sod-tooltip-total">
            <span className="sod-tooltip-label">Total staff</span>
            <span className="sod-tooltip-value">{totalPoint.value}</span>
          </div>
        )}
      </div>
    </div>
  );
};

function ShapeOfDayChart({ roles, data }) {
  // Consistent colours for roles
  const roleColours = useMemo(() => {
    const fallbackColours = ["#3bd68b", "#ff776f", "#facc15", "#a855f7"];
    const map = {};
    roles.forEach((role, idx) => {
      map[role.id] = role.color || fallbackColours[idx % fallbackColours.length];
    });
    return map;
  }, [roles]);

  return (
    <div className="card big-card shape-card">
      <h2 className="card-title">Shape of the Day</h2>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, left: 0, right: 0 }}>
            <CartesianGrid
              stroke="rgba(148,163,184,0.12)"
              vertical={false}
            />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              cursor={{ stroke: "rgba(148,163,184,0.4)", strokeWidth: 1 }}
              content={<ShapeOfDayTooltip roles={roles} />}
            />

            {/* Role lines – thin, low-contrast */}
            {roles.map((role) => (
              <Line
                key={role.id}
                type="monotone"
                dataKey={role.id}
                stroke={roleColours[role.id]}
                strokeWidth={1.5}
                strokeOpacity={0.4}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}

            {/* Total line – hero line */}
            <Line
              type="monotone"
              dataKey="total"
              name="Total staff"
              stroke="#4f8cff"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ShapeOfDayChart;
