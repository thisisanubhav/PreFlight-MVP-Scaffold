"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { RetentionAnalysis, SegmentSignal } from "@/lib/api";

function segmentAt(segments: SegmentSignal[], timestamp: number): SegmentSignal | undefined {
  return (
    segments.find((s) => timestamp >= s.start && timestamp < s.end) ??
    segments[segments.length - 1]
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  segments,
}: TooltipContentProps & { segments: SegmentSignal[] }) {
  if (!active || !payload?.length) return null;
  const timestamp = Number(label);
  const pct = Number(payload[0]?.value);
  const segment = segmentAt(segments, timestamp);

  return (
    <div className="max-w-xs rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg">
      <p className="font-medium">
        {timestamp}s &mdash; {pct}% predicted audience remaining
      </p>
      {segment && (
        <p className="mt-1.5 text-neutral-500">
          {segment.transcript_text ? `"${segment.transcript_text}"` : "(no speech in this segment)"}
        </p>
      )}
    </div>
  );
}

export default function RetentionChart({ analysis }: { analysis: RetentionAnalysis }) {
  const data = analysis.retention_curve.map((p) => ({
    timestamp: p.timestamp,
    predicted_audience_pct: p.predicted_audience_pct,
  }));
  const risk = analysis.top_risk_segment;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t) => `${t}s`}
            tick={{ fontSize: 11, fill: "#737373" }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#737373" }}
          />
          <ReferenceArea
            x1={risk.start}
            x2={risk.end}
            fill="#ef4444"
            fillOpacity={0.12}
            strokeOpacity={0}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} segments={analysis.segments} />}
          />
          <Line
            type="monotone"
            dataKey="predicted_audience_pct"
            stroke="#171717"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
