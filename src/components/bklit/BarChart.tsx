import React, { useState, useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";

export interface BklitBarSeries {
  key: string;
  label: string;
  color: string;
}

export interface BklitBarChartProps {
  data: Array<Record<string, any>>;
  indexKey: string;
  series: BklitBarSeries[];
  height?: number;
  valueFormatter?: (val: number) => string;
  indexFormatter?: (val: any) => string;
  yAxisLabel?: string;
  referenceLine?: {
    value: number;
    label?: string;
    color?: string;
  };
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

export const BarChart: React.FC<BklitBarChartProps> = ({
  data,
  indexKey,
  series,
  height = 260,
  valueFormatter = (v) => `${v}`,
  indexFormatter = (v) => `${v}`,
  yAxisLabel,
  referenceLine,
  showGrid = true,
  showLegend = true,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(600);
  const [hoveredBar, setHoveredBar] = useState<{
    datumIdx: number;
    seriesKey: string;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth;
        if (clientWidth > 0) {
          setWidth(clientWidth);
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 16, right: 24, bottom: 36, left: 52 };
  const innerWidth = Math.max(100, width - margin.left - margin.right);
  const innerHeight = Math.max(80, height - margin.top - margin.bottom);

  const { x0Scale, x1Scale, yScale, yTicks } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        x0Scale: d3.scaleBand().domain([]).range([0, innerWidth]),
        x1Scale: d3.scaleBand().domain([]).range([0, 0]),
        yScale: d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]),
        yTicks: [0, 50, 100],
      };
    }

    const x0 = d3
      .scaleBand()
      .domain(data.map((d, i) => `${d[indexKey] ?? i}`))
      .range([0, innerWidth])
      .padding(0.25);

    const x1 = d3
      .scaleBand()
      .domain(series.map((s) => s.key))
      .range([0, x0.bandwidth()])
      .padding(0.1);

    let maxVal = 0;
    let minVal = 0;
    for (const d of data) {
      for (const s of series) {
        const val = Number(d[s.key]) || 0;
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
      }
    }
    if (referenceLine) {
      if (referenceLine.value > maxVal) maxVal = referenceLine.value;
      if (referenceLine.value < minVal) minVal = referenceLine.value;
    }
    if (maxVal === 0 && minVal === 0) maxVal = 100;
    const yTop = maxVal > 0 ? maxVal * 1.15 : 10;
    const yBottom = minVal < 0 ? minVal * 1.15 : 0;

    const y = d3
      .scaleLinear()
      .domain([yBottom, yTop])
      .nice()
      .range([innerHeight, 0]);

    return {
      x0Scale: x0,
      x1Scale: x1,
      yScale: y,
      yTicks: y.ticks(5),
    };
  }, [data, indexKey, series, referenceLine, innerWidth, innerHeight]);

  const zeroY = yScale(0);

  return (
    <div
      ref={containerRef}
      className={`bklit-bar-chart relative w-full select-none font-sans ${className}`}
    >
      {showLegend && series.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-2 text-xs font-mono">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block shadow-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[#8A9990]">{s.label}</span>
            </div>
          ))}
          {referenceLine && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-4 h-0.5 border-t border-dashed inline-block"
                style={{ borderColor: referenceLine.color || "#D4AF37" }}
              />
              <span className="text-[#8A9990]">
                {referenceLine.label || `Ref: ${referenceLine.value}`}
              </span>
            </div>
          )}
          {yAxisLabel && (
            <span className="ml-auto text-[11px] text-[#8A9990] hidden sm:inline">
              {yAxisLabel}
            </span>
          )}
        </div>
      )}

      <svg
        width={width}
        height={height}
        className="overflow-visible block"
        onMouseLeave={() => setHoveredBar(null)}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Horizontal Gridlines */}
          {showGrid &&
            yTicks.map((tickVal, i) => {
              const yPos = yScale(tickVal);
              return (
                <g key={`y-grid-${i}`} className="text-[10px] font-mono">
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yPos}
                    y2={yPos}
                    stroke="#1F2D26"
                    strokeDasharray={tickVal === 0 ? undefined : "3 3"}
                    strokeWidth={tickVal === 0 ? 1.5 : 1}
                  />
                  <text
                    x={-8}
                    y={yPos + 3}
                    textAnchor="end"
                    fill="#8A9990"
                    className="select-none"
                  >
                    {valueFormatter(tickVal)}
                  </text>
                </g>
              );
            })}

          {/* Reference Line */}
          {referenceLine && (
            <g>
              <line
                x1={0}
                x2={innerWidth}
                y1={yScale(referenceLine.value)}
                y2={yScale(referenceLine.value)}
                stroke={referenceLine.color || "#D4AF37"}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {referenceLine.label && (
                <text
                  x={innerWidth - 4}
                  y={yScale(referenceLine.value) - 4}
                  textAnchor="end"
                  fill={referenceLine.color || "#D4AF37"}
                  className="text-[10px] font-mono font-bold select-none"
                >
                  {referenceLine.label}
                </text>
              )}
            </g>
          )}

          {/* X Axis Labels */}
          {data.map((d, i) => {
            const xBand = x0Scale(`${d[indexKey] ?? i}`) ?? 0;
            const xCenter = xBand + x0Scale.bandwidth() / 2;

            return (
              <text
                key={`x-label-${i}`}
                x={xCenter}
                y={innerHeight + 18}
                textAnchor="middle"
                fill="#8A9990"
                className="text-[10px] font-mono select-none"
              >
                {indexFormatter(d[indexKey] ?? i)}
              </text>
            );
          })}

          {/* Grouped Bars */}
          {data.map((d, datumIdx) => {
            const groupX = x0Scale(`${d[indexKey] ?? datumIdx}`) ?? 0;

            return (
              <g key={`bar-group-${datumIdx}`}>
                {series.map((s) => {
                  const val = Number(d[s.key]) || 0;
                  const barX = groupX + (x1Scale(s.key) ?? 0);
                  const barWidth = Math.max(3, x1Scale.bandwidth());

                  const isPositive = val >= 0;
                  const barY = isPositive ? yScale(val) : zeroY;
                  const barHeight = Math.max(
                    1,
                    Math.abs(yScale(val) - zeroY)
                  );

                  const isHovered =
                    hoveredBar?.datumIdx === datumIdx &&
                    hoveredBar?.seriesKey === s.key;

                  return (
                    <rect
                      key={`bar-${s.key}-${datumIdx}`}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={3}
                      ry={3}
                      fill={s.color}
                      opacity={
                        hoveredBar === null
                          ? 0.92
                          : isHovered
                          ? 1
                          : 0.5
                      }
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredBar({ datumIdx, seriesKey: s.key })
                      }
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover Tooltip */}
      {hoveredBar !== null && data[hoveredBar.datumIdx] && (
        <div
          className="absolute z-20 pointer-events-none bg-[#0B110E]/95 backdrop-blur-md border border-[#23352C] rounded-lg p-2.5 shadow-xl font-mono text-xs text-[#F3F4F0] min-w-[130px]"
          style={{
            top: 24,
            left: Math.min(
              Math.max(
                10,
                margin.left +
                  (x0Scale(
                    `${data[hoveredBar.datumIdx][indexKey] ?? hoveredBar.datumIdx}`
                  ) ?? 0)
              ),
              width - 150
            ),
          }}
        >
          <div className="font-sans font-bold text-[#D4AF37] border-b border-[#1F2D26] pb-1 mb-1">
            {indexFormatter(data[hoveredBar.datumIdx][indexKey])}
          </div>
          {series.map((s) => {
            const val = Number(data[hoveredBar.datumIdx][s.key]) || 0;
            const isTarget = hoveredBar.seriesKey === s.key;
            return (
              <div
                key={`tip-${s.key}`}
                className={`flex items-center justify-between gap-3 text-[11px] ${
                  isTarget ? "font-bold text-[#F3F4F0]" : "text-[#8A9990]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-xs"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.label}</span>
                </div>
                <span className="tabular-nums" style={{ color: s.color }}>
                  {valueFormatter(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
