import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";

export const WEAK_AREA_THRESHOLD = 60;

const DEFAULT_BLUE = "#3b82f6";
const WEAK_RED = "#ef4444";

interface AccuracyBarChartProps {
  data: { label: string; attempted: number; accuracy: number }[];
  title: string;
}

export default function AccuracyBarChart({ data, title }: AccuracyBarChartProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#111827" }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            label={{ value: "Category", position: "insideBottom", offset: -4, fontSize: 12 }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            label={{ value: "Attempted", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: "Accuracy (%)", angle: 90, position: "insideRight", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Accuracy (%)") return [`${value}%`, "Accuracy"];
              return [value, "Attempted"];
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="attempted" name="Attempted" fill={DEFAULT_BLUE} />
          <Bar yAxisId="right" dataKey="accuracy" name="Accuracy (%)">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.accuracy < WEAK_AREA_THRESHOLD ? WEAK_RED : DEFAULT_BLUE}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
