import React, { useState, useMemo } from "react";
import * as d3 from "d3";

export interface BklitRingSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface BklitRingChartProps {
  data: BklitRingSegment[];
  size?: number;
  innerRadiusRatio?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  valueFormatter?: (val: number) => string;
  showLegend?: boolean;
  className?: string;
}

export const RingChart: React.FC<BklitRingChartProps> = ({
  data,
  size = 180,
  innerRadiusRatio = 0.68,
  centerTitle,
  centerSubtitle,
  valueFormatter = (v) => `${v}`,
  showLegend = true,
  className = "",
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const radius = size / 2;
  const innerRadius = radius * innerRadiusRatio;
  const outerRadius = radius - 6;

  const totalValue = useMemo(() => {
    return data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [data]);

  const arcs = useMemo(() => {
    if (!data || data.length === 0 || totalValue === 0) return [];

    const pieGen = d3
      .pie<BklitRingSegment>()
      .value((d) => Math.max(0, Number(d.value) || 0))
      .sort(null)
      .padAngle(0.035);

    const arcGen = d3
      .arc<d3.PieArcDatum<BklitRingSegment>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(4);

    const pieArcs = pieGen(data);
    return pieArcs.map((arcDatum) => ({
      datum: arcDatum.data,
      path: arcGen(arcDatum) || "",
    }));
  }, [data, totalValue, innerRadius, outerRadius]);

  const activeSegment = hoveredKey
    ? data.find((d) => d.key === hoveredKey)
    : null;

  return (
    <div
      className={`bklit-ring-chart flex flex-col sm:flex-row items-center gap-4 ${className}`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="overflow-visible block"
          onMouseLeave={() => setHoveredKey(null)}
        >
          <g transform={`translate(${radius}, ${radius})`}>
            {arcs.length === 0 ? (
              <circle
                cx={0}
                cy={0}
                r={(innerRadius + outerRadius) / 2}
                fill="none"
                stroke="#1F2D26"
                strokeWidth={outerRadius - innerRadius}
              />
            ) : (
              arcs.map(({ datum, path }) => {
                const isHovered = hoveredKey === datum.key;
                return (
                  <path
                    key={datum.key}
                    d={path}
                    fill={datum.color}
                    opacity={
                      hoveredKey === null ? 0.92 : isHovered ? 1 : 0.45
                    }
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredKey(datum.key)}
                  />
                );
              })
            )}
          </g>
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeSegment ? (
            <>
              <div
                className="text-base font-mono font-bold leading-none tabular-nums"
                style={{ color: activeSegment.color }}
              >
                {valueFormatter(activeSegment.value)}
              </div>
              <div className="text-[10px] text-[#8A9990] font-sans truncate max-w-[80px] mt-1">
                {activeSegment.label}
              </div>
              <div className="text-[9px] text-[#D5DDD8] font-mono mt-0.5">
                {totalValue > 0
                  ? `${((activeSegment.value / totalValue) * 100).toFixed(1)}%`
                  : "0%"}
              </div>
            </>
          ) : (
            <>
              <div className="text-base font-mono font-bold text-[#F3F4F0] leading-none tabular-nums">
                {centerTitle ?? valueFormatter(totalValue)}
              </div>
              {centerSubtitle && (
                <div className="text-[10px] text-[#8A9990] font-sans truncate max-w-[80px] mt-1">
                  {centerSubtitle}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legend & Breakdown */}
      {showLegend && data.length > 0 && (
        <div className="flex flex-col gap-1.5 min-w-[130px] text-xs font-mono">
          {data.map((seg) => {
            const pct =
              totalValue > 0
                ? ((seg.value / totalValue) * 100).toFixed(1)
                : "0";
            const isHovered = hoveredKey === seg.key;

            return (
              <div
                key={seg.key}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`flex items-center justify-between gap-3 px-2 py-1 rounded transition-colors cursor-pointer ${
                  isHovered ? "bg-[#141E19]" : "hover:bg-[#0E1612]"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span
                    className={`truncate text-[11px] ${
                      isHovered ? "text-[#F3F4F0] font-semibold" : "text-[#8A9990]"
                    }`}
                  >
                    {seg.label}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className="font-bold tabular-nums text-[11px]"
                    style={{ color: seg.color }}
                  >
                    {valueFormatter(seg.value)}
                  </span>
                  <span className="text-[9px] text-[#8A9990] ml-1">
                    ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
