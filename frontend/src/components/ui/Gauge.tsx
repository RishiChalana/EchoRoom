"use client";

interface GaugeProps {
  value: number; // 0–1
  size?: number;
  label?: string;
  color?: string;
}

export function Gauge({ value, size = 80, label, color = "#4f6ef7" }: GaugeProps) {
  const r = size * 0.38;
  const circumference = Math.PI * r; // half-circle arc length
  const clamped = Math.max(0, Math.min(1, value));
  const dashOffset = circumference * (1 - clamped);
  const cx = size / 2;
  const cy = size * 0.56;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size * 0.64}
        viewBox={`0 0 ${size} ${size * 0.64}`}
        aria-label={label ? `${label}: ${Math.round(clamped * 100)}%` : undefined}
      >
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#374151"
          strokeWidth={size * 0.1}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.1}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x={cx}
          y={cy - size * 0.04}
          textAnchor="middle"
          fill="white"
          fontSize={size * 0.2}
          fontWeight="600"
        >
          {Math.round(clamped * 100)}
        </text>
      </svg>
      {label && <span className="text-xs text-gray-400">{label}</span>}
    </div>
  );
}
