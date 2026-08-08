"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
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

function DropBadge(props: { x?: number; y?: number; value?: string }) {
  const { x, y, value } = props;
  if (x == null || y == null || !value) return null;
  const width = value.length * 6 + 24;
  const height = 22;
  return (
    <g transform={`translate(${x - width / 2}, ${y - height - 12})`}>
      <rect width={width} height={height} rx={11} fill="#fef2f2" />
      <text
        x={width / 2}
        y={height / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#cc0000"
      >
        {value}
      </text>
    </g>
  );
}

export default function RetentionChart({ analysis }: { analysis: RetentionAnalysis }) {
  const data = analysis.retention_curve.map((p) => ({
    timestamp: p.timestamp,
    predicted_audience_pct: p.predicted_audience_pct,
  }));
  const risk = analysis.top_risk_segment;
  const dropLabel = `-${Math.round(risk.retention_before - risk.retention_after)}% Drop`;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(t) => `${t}s`}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
          />
          <ReferenceArea
            x1={risk.start}
            x2={risk.end}
            fill="#cc0000"
            fillOpacity={0.1}
            strokeOpacity={0}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} segments={analysis.segments} />}
          />
          <Line
            type="monotone"
            dataKey="predicted_audience_pct"
            stroke="#262626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#cc0000" }}
          />
          <ReferenceDot
            x={risk.end}
            y={risk.retention_after}
            r={5}
            fill="#cc0000"
            stroke="#fff"
            strokeWidth={2}
            label={<DropBadge value={dropLabel} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
