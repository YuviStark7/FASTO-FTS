"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type LineSeries = {
  key: string;
  label: string;
  /** Distinct dash patterns so lines differ without relying on colour. */
  dash?: string;
  color: string;
};

const TICK = { fill: "var(--text-muted)", fontSize: 11, fontVariantNumeric: "tabular-nums" } as const;

/**
 * Recharts wrapper: one place for axes, grid and tokens. Charts are decorative to AT; callers give a text summary.
 * Quiet by design: horizontal hairlines only, no axis lines, small tabular ticks, series in the chart tokens.
 */
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
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tick={TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} tickMargin={10} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={72} tickMargin={6} tickFormatter={format} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v) => format(Number(v))}
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-2)",
              color: "var(--text)",
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              padding: "10px 12px",
            }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
            itemStyle={{ color: "var(--text)", padding: 0 }}
          />
          <Legend
            iconType="plainline"
            iconSize={18}
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: "var(--text-muted)", marginLeft: 2 }}>{value}</span>}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeDasharray={s.dash}
              strokeWidth={2}
              strokeLinecap="round"
              dot={{ r: 2.5, strokeWidth: 1.5, strokeDasharray: "0", fill: "var(--surface)" }}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)", fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
