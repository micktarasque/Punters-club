import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import {
  TrendingUp,
  Layers,
  Flame,
  DollarSign,
  Info,
  ShieldCheck,
  Target,
  Sliders,
  Sparkles,
} from "lucide-react";

interface TrifectaCombinationsChartProps {
  currentHorsesCount: number;
  currentCombosCount: number;
  currentFlexiPct: number;
  stake: number;
  isStandoutActive?: boolean;
  standoutHorseName?: string;
  fieldSize?: number;
}

export const TrifectaCombinationsChart: React.FC<TrifectaCombinationsChartProps> = ({
  currentHorsesCount,
  currentCombosCount,
  currentFlexiPct,
  stake,
  isStandoutActive = false,
  standoutHorseName,
  fieldSize = 12,
}) => {
  const [viewMode, setViewMode] = useState<"both" | "boxed" | "standout">("both");
  const [metricYAxis, setMetricYAxis] = useState<"combos" | "flexi" | "coverage">("combos");

  // Dynamic max horses to plot (accommodates current selection or race field size)
  const maxHorses = useMemo(() => {
    return Math.min(12, Math.max(8, Math.max(fieldSize || 10, currentHorsesCount || 5)));
  }, [fieldSize, currentHorsesCount]);

  // Simulated horse count for interactive "what-if" testing
  const [simulatedHorses, setSimulatedHorses] = useState<number>(() => {
    return currentHorsesCount >= 3 ? currentHorsesCount : 6;
  });

  // Keep simulated horses synced if current selection changes and user hasn't explicitly changed it
  const effectiveSimulatedHorses = Math.max(3, Math.min(maxHorses, simulatedHorses));

  // Total possible trifectas in the race field: F * (F - 1) * (F - 2)
  const totalFieldTrifectas = useMemo(() => {
    const f = Math.max(4, fieldSize || 10);
    return f * (f - 1) * (f - 2);
  }, [fieldSize]);

  // Build data points from 3 up to maxHorses
  const chartData = useMemo(() => {
    const points = [];
    for (let n = 3; n <= maxHorses; n++) {
      // Boxed formula: n * (n - 1) * (n - 2)
      const boxedCombos = n * (n - 1) * (n - 2);
      const boxedFlexi = (stake / boxedCombos) * 100;
      const boxedUnitCost = boxedCombos; // $1 per combo
      const boxedCoverage = Number(((boxedCombos / totalFieldTrifectas) * 100).toFixed(1));

      // Standout Banker formula: 1 * (n - 1) * (n - 2)
      const standoutCombos = (n - 1) * (n - 2);
      const standoutFlexi = (stake / standoutCombos) * 100;
      const standoutUnitCost = standoutCombos;
      const standoutCoverage = Number(((standoutCombos / totalFieldTrifectas) * 100).toFixed(1));

      points.push({
        horses: n,
        horsesLabel: `${n} Horses`,
        boxedCombos,
        boxedFlexi: Number(boxedFlexi.toFixed(2)),
        boxedUnitCost,
        boxedCoverage,
        standoutCombos,
        standoutFlexi: Number(standoutFlexi.toFixed(2)),
        standoutUnitCost,
        standoutCoverage,
        isCurrent: n === currentHorsesCount,
        isSimulated: n === effectiveSimulatedHorses,
      });
    }
    return points;
  }, [maxHorses, stake, currentHorsesCount, effectiveSimulatedHorses, totalFieldTrifectas]);

  // Current Y value for ReferenceDot tracking
  const currentYVal = useMemo(() => {
    if (metricYAxis === "combos") {
      return currentCombosCount;
    }
    if (metricYAxis === "flexi") {
      return Number(currentFlexiPct.toFixed(2));
    }
    // coverage
    const cov = (currentCombosCount / totalFieldTrifectas) * 100;
    return Number(cov.toFixed(1));
  }, [metricYAxis, currentCombosCount, currentFlexiPct, totalFieldTrifectas]);

  // Simulated metrics
  const simulatedStats = useMemo(() => {
    const n = effectiveSimulatedHorses;
    const bCombos = n * (n - 1) * (n - 2);
    const bFlexi = (stake / bCombos) * 100;
    const bCoverage = (bCombos / totalFieldTrifectas) * 100;

    const sCombos = (n - 1) * (n - 2);
    const sFlexi = (stake / sCombos) * 100;
    const sCoverage = (sCombos / totalFieldTrifectas) * 100;

    let tradeOffVerdict = "";
    let verdictColor = "text-[#D4AF37]";

    if (n <= 4) {
      tradeOffVerdict = "High Precision / Concentrated: Low field coverage, but massive payout share if hit.";
      verdictColor = "text-[#38BDF8]";
    } else if (n <= 6) {
      tradeOffVerdict = "Syndicate Sweet Spot: Balanced 15%–33% Flexi dividend with high multi-punter coverage.";
      verdictColor = "text-[#10B981]";
    } else if (n <= 7) {
      tradeOffVerdict = "Wide Net: Strong field coverage (~30%), with Flexi dividend around 5%–10%.";
      verdictColor = "text-[#F59E0B]";
    } else {
      tradeOffVerdict = "High Dilution / Heavy Spread: High combo count (>300), Flexi payout drops below 3%.";
      verdictColor = "text-[#EF4444]";
    }

    return {
      horses: n,
      boxedCombos: bCombos,
      boxedFlexi: bFlexi,
      boxedCoverage: bCoverage,
      standoutCombos: sCombos,
      standoutFlexi: sFlexi,
      standoutCoverage: sCoverage,
      tradeOffVerdict,
      verdictColor,
    };
  }, [effectiveSimulatedHorses, stake, totalFieldTrifectas]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#09110D] border border-[#1E2E25] space-y-4 font-mono text-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2E25]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
            <h4 className="font-display font-bold text-sm text-[#F3F4F0]">
              Trifecta Cost-to-Coverage Trade-Off Curve
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold">
              Recharts Visualizer
            </span>
          </div>
          <p className="text-[11px] text-[#8A9990] mt-0.5">
            Understand how adding horses expands field coverage vs. cubically diluting your Flexi dividend percentage at ${stake} outlay.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric Toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#0E1512] border border-[#1E2E25]">
            <button
              type="button"
              onClick={() => setMetricYAxis("combos")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metricYAxis === "combos"
                  ? "bg-[#D4AF37] text-[#070B09]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Combinations
            </button>
            <button
              type="button"
              onClick={() => setMetricYAxis("flexi")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metricYAxis === "flexi"
                  ? "bg-[#10B981] text-[#070B09]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Flexi % Share
            </button>
            <button
              type="button"
              onClick={() => setMetricYAxis("coverage")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metricYAxis === "coverage"
                  ? "bg-[#38BDF8] text-[#070B09]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Field Coverage %
            </button>
          </div>

          {/* Mode Filter */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#0E1512] border border-[#1E2E25]">
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                viewMode === "both"
                  ? "bg-[#16231C] text-[#F3F4F0] border border-[#23352B]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Compare Both
            </button>
            <button
              type="button"
              onClick={() => setViewMode("boxed")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                viewMode === "boxed"
                  ? "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/50"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Boxed
            </button>
            <button
              type="button"
              onClick={() => setViewMode("standout")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                viewMode === "standout"
                  ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Banker
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Key Insight Banner */}
      <div className="p-3 rounded-xl bg-[#0E1612] border border-[#1E2E25] flex flex-col md:flex-row md:items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse shrink-0" />
          <span className="text-[#D5DDD8]">
            Current Ticket:{" "}
            <strong className="text-[#F3F4F0]">
              {currentHorsesCount} Horses Selected
            </strong>{" "}
            ──►{" "}
            <strong className="text-[#D4AF37]">
              {currentCombosCount} Combos
            </strong>{" "}
            yielding{" "}
            <strong className="text-[#10B981]">
              {currentFlexiPct.toFixed(2)}% Flexi
            </strong>{" "}
            at ${stake} outlay (
            <span className="text-[#38BDF8]">
              {((currentCombosCount / totalFieldTrifectas) * 100).toFixed(1)}% field coverage
            </span>
            )
          </span>
        </div>

        {isStandoutActive ? (
          <div className="flex items-center gap-1.5 text-[#10B981] shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>
              Banker Boost: Anchoring {standoutHorseName || "favorite"} cuts combinations by ~66%!
            </span>
          </div>
        ) : (
          <div className="text-[#8A9990] shrink-0">
            Cubic Growth: Moving from 5 to 7 horses jumps combos from <strong>60 to 210</strong> (+250%).
          </div>
        )}
      </div>

      {/* Dynamic Recharts Container */}
      <div className="h-64 sm:h-72 w-full pt-2 min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
          >
            <defs>
              {/* Boxed Gradient (Gold) */}
              <linearGradient id="boxedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
              </linearGradient>

              {/* Standout Gradient (Emerald) */}
              <linearGradient id="standoutGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1C2C23"
              vertical={false}
            />

            <XAxis
              dataKey="horses"
              stroke="#6B7D73"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `${v}H`}
            />

            <YAxis
              stroke="#6B7D73"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                metricYAxis === "combos"
                  ? `${v}`
                  : `${v}%`
              }
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                const isSelected = d.horses === currentHorsesCount;

                return (
                  <div className="p-3.5 rounded-xl bg-[#09110D] border border-[#23352B] shadow-2xl space-y-2 text-xs font-mono min-w-[220px]">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#1E2E25]">
                      <span className="font-bold text-[#F3F4F0] text-sm">
                        {d.horses} Horses in Selections
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold text-[10px]">
                          Your Current Ticket
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {/* Boxed Stats */}
                      <div className="space-y-0.5 text-[#D4AF37]">
                        <div className="flex items-center justify-between">
                          <span>Boxed Permutations:</span>
                          <span className="font-bold">{d.boxedCombos} combos</span>
                        </div>
                        <div className="flex items-center justify-between text-[#D4AF37]/80 text-[10px]">
                          <span>Flexi % (${stake} stake):</span>
                          <span className="font-bold">{d.boxedFlexi}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[#38BDF8] text-[10px]">
                          <span>Field Coverage:</span>
                          <span className="font-bold">{d.boxedCoverage}% of race</span>
                        </div>
                      </div>

                      {/* Standout Stats */}
                      <div className="space-y-0.5 text-[#10B981] pt-1.5 border-t border-[#1C2C23]">
                        <div className="flex items-center justify-between">
                          <span>Banker (1st Standout):</span>
                          <span className="font-bold">{d.standoutCombos} combos</span>
                        </div>
                        <div className="flex items-center justify-between text-[#10B981]/80 text-[10px]">
                          <span>Flexi % (${stake} stake):</span>
                          <span className="font-bold">{d.standoutFlexi}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[#38BDF8] text-[10px]">
                          <span>Field Coverage:</span>
                          <span className="font-bold">{d.standoutCoverage}% of race</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            {/* Reference Line at Current Selected Horses */}
            {currentHorsesCount >= 3 && currentHorsesCount <= maxHorses && (
              <ReferenceLine
                x={currentHorsesCount}
                stroke="#F3F4F0"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "Your Ticket",
                  position: "top",
                  fill: "#F3F4F0",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
              />
            )}

            {/* Boxed Area / Curve */}
            {(viewMode === "both" || viewMode === "boxed") && (
              <Area
                type="monotone"
                dataKey={
                  metricYAxis === "combos"
                    ? "boxedCombos"
                    : metricYAxis === "flexi"
                    ? "boxedFlexi"
                    : "boxedCoverage"
                }
                name="Boxed Trifecta"
                stroke="#D4AF37"
                strokeWidth={2.5}
                fill="url(#boxedGradient)"
                activeDot={{ r: 6, fill: "#D4AF37", stroke: "#070B09", strokeWidth: 2 }}
              />
            )}

            {/* Standout Banker Area / Curve */}
            {(viewMode === "both" || viewMode === "standout") && (
              <Area
                type="monotone"
                dataKey={
                  metricYAxis === "combos"
                    ? "standoutCombos"
                    : metricYAxis === "flexi"
                    ? "standoutFlexi"
                    : "standoutCoverage"
                }
                name="Standout Banker"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#standoutGradient)"
                activeDot={{ r: 6, fill: "#10B981", stroke: "#070B09", strokeWidth: 2 }}
              />
            )}

            {/* Current Selection Pinpoint Dot */}
            {currentHorsesCount >= 3 && currentHorsesCount <= maxHorses && (
              <ReferenceDot
                x={currentHorsesCount}
                y={currentYVal}
                r={6}
                fill="#F3F4F0"
                stroke={isStandoutActive ? "#10B981" : "#D4AF37"}
                strokeWidth={3}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive What-If Simulator Row */}
      <div className="p-3 rounded-xl bg-[#0C1410] border border-[#1E2E25] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#F3F4F0] font-bold">
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Interactive Simulator: Test Adding More Horses</span>
          </div>
          <span className="text-[11px] text-[#8A9990]">
            Click a runner count to inspect cost-to-coverage trade-off
          </span>
        </div>

        {/* Horse count pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {chartData.map((d) => {
            const isSelected = d.horses === effectiveSimulatedHorses;
            const isTicket = d.horses === currentHorsesCount;
            return (
              <button
                key={d.horses}
                type="button"
                onClick={() => setSimulatedHorses(d.horses)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? "bg-[#D4AF37] text-[#070B09] shadow-md shadow-[#D4AF37]/20"
                    : "bg-[#14231B] text-[#D5DDD8] hover:bg-[#1E2E25] border border-[#23352B]"
                }`}
              >
                <span>{d.horses} Horses</span>
                {isTicket && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" title="Your Current Selection" />
                )}
              </button>
            );
          })}
        </div>

        {/* Simulated Trade-Off Analysis Card */}
        <div className="p-2.5 rounded-lg bg-[#080D0B] border border-[#1A2820] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-[#8A9990] block text-[10px]">Boxed Combos</span>
            <span className="font-bold text-[#D4AF37] text-xs">
              {simulatedStats.boxedCombos} combos
            </span>
            <span className="text-[10px] text-[#6B7D73] block">(${simulatedStats.boxedCombos} unit)</span>
          </div>

          <div>
            <span className="text-[#8A9990] block text-[10px]">Flexi % (${stake} stake)</span>
            <span className="font-bold text-[#10B981] text-xs">
              {simulatedStats.boxedFlexi.toFixed(2)}% Flexi
            </span>
            <span className="text-[10px] text-[#6B7D73] block">
              Banker: {simulatedStats.standoutFlexi.toFixed(2)}%
            </span>
          </div>

          <div>
            <span className="text-[#8A9990] block text-[10px]">Field Coverage</span>
            <span className="font-bold text-[#38BDF8] text-xs">
              {simulatedStats.boxedCoverage.toFixed(1)}% of race
            </span>
            <span className="text-[10px] text-[#6B7D73] block">
              out of {totalFieldTrifectas} race outcomes
            </span>
          </div>

          <div>
            <span className="text-[#8A9990] block text-[10px]">Trade-Off Verdict</span>
            <span className={`font-bold text-[10px] line-clamp-2 ${simulatedStats.verdictColor}`}>
              {simulatedStats.tradeOffVerdict}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Legend & Educational Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1E2E25] text-[11px] text-[#8A9990]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#D4AF37]" />
            <span className="text-[#D5DDD8]">Full Boxed Permutations (N × (N-1) × (N-2))</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[#D5DDD8]">Standout Banker Curve (1 × (N-1) × (N-2))</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F3F4F0] border border-[#10B981]" />
            <span className="text-[#F3F4F0]">Your Active Ticket</span>
          </div>
        </div>

        <div className="text-[10px] text-[#6B7D73]">
          Official Sportsbet &amp; TAB Flexi Formula: % = (Stake / Combos) × 100%
        </div>
      </div>
    </div>
  );
};
