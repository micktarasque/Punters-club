import React, { useState, useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";

export interface BklitAreaSeries {
  key: string;
  label: string;
  color: string;
  fillOpacity?: number;
}

export interface BklitAreaChartProps {
  data: Array<Record<string, any>>;
  indexKey: string;
  series: BklitAreaSeries[];
  height?: number;
  valueFormatter?: (val: number) => string;
  indexFormatter?: (val: any) => string;
  yAxisLabel?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

export const AreaChart: React.FC<BklitAreaChartProps> = ({
  data,
  indexKey,
  series,
  height = 260,
  valueFormatter = (v) => `${v}`,
  indexFormatter = (v) => `${v}`,
  yAxisLabel,
  showGrid = true,
  showLegend = true,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(600);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  const margin = { top: 16, right: 24, bottom: 32, left: 48 };
  const innerWidth = Math.max(100, width - margin.left - margin.right);
  const innerHeight = Math.max(80, height - margin.top - margin.bottom);

  // Compute Scales
  const { xScale, yScale, yTicks } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        xScale: d3.scalePoint().domain([]).range([0, innerWidth]),
        yScale: d3.scaleLinear().domain([0, 10]).range([innerHeight, 0]),
        yTicks: [0, 5, 10],
      };
    }

    const x = d3
      .scalePoint<string>()
      .domain(data.map((d, i) => `${d[indexKey] ?? i}`))
      .range([0, innerWidth])
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
    if (maxVal === 0 && minVal === 0) maxVal = 10;
    const yTop = maxVal * 1.15;
    const yBottom = minVal < 0 ? minVal * 1.15 : 0;

    const y = d3
      .scaleLinear()
      .domain([yBottom, yTop])
      .nice()
      .range([innerHeight, 0]);

    return {
      xScale: x,
      yScale: y,
      yTicks: y.ticks(5),
    };
  }, [data, indexKey, series, innerWidth, innerHeight]);

  const paths = useMemo(() => {
    if (!data || data.length === 0) return [];

    return series.map((s, sIdx) => {
      const lineGen = d3
        .line<Record<string, any>>()
        .x((d, i) => xScale(`${d[indexKey] ?? i}`) ?? 0)
        .y((d) => yScale(Number(d[s.key]) || 0))
        .curve(d3.curveMonotoneX);

      const areaGen = d3
        .area<Record<string, any>>()
        .x((d, i) => xScale(`${d[indexKey] ?? i}`) ?? 0)
        .y0(yScale(0))
        .y1((d) => yScale(Number(d[s.key]) || 0))
        .curve(d3.curveMonotoneX);

      const linePath = lineGen(data) || "";
      const areaPath = areaGen(data) || "";

      return {
        series: s,
        linePath,
        areaPath,
        gradientId: `bklit-area-grad-${s.key}-${sIdx}`,
      };
    });
  }, [data, indexKey, series, xScale, yScale]);

  const activeDatum = hoveredIdx !== null && data ? data[hoveredIdx] : null;
  const hoverX =
    hoveredIdx !== null && data && data[hoveredIdx]
      ? xScale(`${data[hoveredIdx][indexKey] ?? hoveredIdx}`) ?? 0
      : null;

  return (
    <div
      ref={containerRef}
      className={`bklit-area-chart relative w-full select-none font-sans ${className}`}
    >
      {showLegend && series.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-2 text-xs font-mono">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[#8A9990]">{s.label}</span>
            </div>
          ))}
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
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {paths.map(({ series: s, gradientId }) => (
            <linearGradient
              key={gradientId}
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={s.color}
                stopOpacity={s.fillOpacity ?? 0.35}
              />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Horizontal Gridlines & Y-Axis Labels */}
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

          {/* X-Axis Tick Labels */}
          {data.map((d, i) => {
            const xPos = xScale(`${d[indexKey] ?? i}`) ?? 0;
            // Space ticks if there are many points
            const shouldShow =
              data.length <= 12 ||
              i === 0 ||
              i === data.length - 1 ||
              i % Math.ceil(data.length / 8) === 0;
            if (!shouldShow) return null;

            return (
              <text
                key={`x-tick-${i}`}
                x={xPos}
                y={innerHeight + 18}
                textAnchor="middle"
                fill="#8A9990"
                className="text-[10px] font-mono select-none"
              >
                {indexFormatter(d[indexKey] ?? i)}
              </text>
            );
          })}

          {/* Area Fills */}
          {paths.map(({ series: s, areaPath, gradientId }) => (
            <path
              key={`area-${s.key}`}
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="transition-opacity duration-200"
            />
          ))}

          {/* Spline Lines */}
          {paths.map(({ series: s, linePath }) => (
            <path
              key={`line-${s.key}`}
              d={linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Data Points on Hover / Active Points */}
          {data.map((d, i) => {
            const xPos = xScale(`${d[indexKey] ?? i}`) ?? 0;
            const isHovered = hoveredIdx === i;

            return (
              <g key={`points-${i}`}>
                {series.map((s) => {
                  const val = Number(d[s.key]) || 0;
                  const yPos = yScale(val);
                  return (
                    <circle
                      key={`pt-${s.key}-${i}`}
                      cx={xPos}
                      cy={yPos}
                      r={isHovered ? 4.5 : 2.5}
                      fill={s.color}
                      stroke="#0B110E"
                      strokeWidth={1.5}
                      className="transition-all duration-150"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Hover Crosshair Line */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={0}
              y2={innerHeight}
              stroke="#D4AF37"
              strokeWidth={1.2}
              strokeDasharray="2 2"
              className="pointer-events-none"
            />
          )}

          {/* Transparent Hover Hit Boxes */}
          {data.map((d, i) => {
            const xPos = xScale(`${d[indexKey] ?? i}`) ?? 0;
            const stepWidth = innerWidth / Math.max(1, data.length);
            const boxX = Math.max(0, xPos - stepWidth / 2);

            return (
              <rect
                key={`hit-${i}`}
                x={boxX}
                y={0}
                width={stepWidth}
                height={innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
              />
            );
          })}
        </g>
      </svg>

      {/* Rich Bklit Floating Tooltip */}
      {activeDatum && hoverX !== null && (
        <div
          className="absolute z-20 pointer-events-none bg-[#0B110E]/95 backdrop-blur-md border border-[#23352C] rounded-lg p-2.5 shadow-xl font-mono text-xs text-[#F3F4F0] min-w-[150px]"
          style={{
            top: 24,
            left: Math.min(
              Math.max(10, margin.left + hoverX - 75),
              width - 165
            ),
          }}
        >
          <div className="font-sans font-bold text-[#D4AF37] border-b border-[#1F2D26] pb-1 mb-1.5 flex items-center justify-between">
            <span>{indexFormatter(activeDatum[indexKey])}</span>
            <span className="text-[10px] text-[#8A9990] font-mono">
              Race Point
            </span>
          </div>
          <div className="space-y-1">
            {series.map((s) => {
              const val = Number(activeDatum[s.key]) || 0;
              return (
                <div
                  key={`tip-${s.key}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-[#8A9990] truncate">{s.label}</span>
                  </div>
                  <span className="font-bold tabular-nums" style={{ color: s.color }}>
                    {valueFormatter(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
