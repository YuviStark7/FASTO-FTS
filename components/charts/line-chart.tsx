"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type LineSeries = {
  key: string;
  label: string;
  /** Distinct dash patterns so lines differ without relying on colour. */
  dash?: string;
  color: string;
};

/** Recharts wrapper: one place for axes, grid and tokens. Charts are decorative to AT; callers give a text summary. */
export function LineChartBox({
  data,
  xKey,
  series,
  height = 240,
  format,
}: {
  data: Record<string, number>[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  format: (v: number) => string;
}) {
  return (
    <div aria-hidden style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} width={76} tickFormatter={format} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v) => format(Number(v))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeDasharray={s.dash}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
