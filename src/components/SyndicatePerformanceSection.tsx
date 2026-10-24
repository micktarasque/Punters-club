import React, { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  Trophy,
  Award,
  Crown,
  DollarSign,
  TrendingUp,
  Target,
  Percent,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Sliders,
  Layers,
  Sparkles,
  Flame,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { PunterProfile, RaceMeeting, RaceRunner } from "../types/racing";
import {
  SEED_NSW_TAB_MEETINGS,
  getCurrentAustralianDateIso,
  offsetAustralianDateIso,
  normalizeAustralianDateIso,
  isRaceOfficialOrCompleted,
} from "../data/seedNswTab";
import { evaluateRaceTrio, formatDollarReturn } from "../utils/scoring";
import { generateRaceAutoPickTrio, AutoPickStrategy } from "../utils/autoPick";

export interface SyndicatePerformanceSectionProps {
  meetings: RaceMeeting[];
  punters: PunterProfile[];
  onJumpToSelections?: (punterId: string, meetingId?: string) => void;
  isApple?: boolean;
}

type TimeframeOption = "30" | "14" | "7";
type MetricViewMode = "dual" | "winRate" | "dollars" | "timeline";

export interface SyndicateChartDataEntry {
  name: string;
  punterId: string;
  winRatePct: number;
  podiumRatePct: number;
  totalDollarReturn: number;
  totalOutlay: number;
  netProfit: number;
  roiPct: number;
  winsCount: number;
  racesTipped: number;
  color: string;
}

interface Punter30DayPerformance {
  punterId: string;
  name: string;
  role: string;
  racesTipped: number;
  completedRaces: number;
  winsCount: number;
  secondsCount: number;
  thirdsCount: number;
  podiumCount: number;
  winRatePct: number;
  podiumRatePct: number;
  totalOutlay: number;
  totalDollarReturn: number;
  netProfit: number;
  roiPct: number;
  avgReturnPerRace: number;
  color: string;
}

export interface DailyTimelinePoint {
  date: string;
  displayDate: string;
  [key: string]: string | number; // Dynamic punterId properties
}

const PUNTER_THEME_COLORS = [
  { stroke: "#D4AF37", fill: "#D4AF37", soft: "rgba(212, 175, 55, 0.2)" }, // Gold
  { stroke: "#10B981", fill: "#10B981", soft: "rgba(16, 185, 129, 0.2)" }, // Emerald
  { stroke: "#0071E3", fill: "#0071E3", soft: "rgba(0, 113, 227, 0.2)" },  // Royal Blue
  { stroke: "#AF52DE", fill: "#AF52DE", soft: "rgba(175, 82, 222, 0.2)" }, // Purple
  { stroke: "#FF9500", fill: "#FF9500", soft: "rgba(255, 149, 0, 0.2)" },  // Amber
  { stroke: "#FF2D55", fill: "#FF2D55", soft: "rgba(255, 45, 85, 0.2)" },   // Pink
];

// Stable formatters preventing inline function recreations in Recharts
const formatDollarTick = (val: any) => `$${val}`;
const formatPercentTick = (val: any) => `${val}%`;
const renderLegendItem = (value: string) => (
  <span className="text-xs font-semibold px-1 text-current">{value}</span>
);

// Memoized Custom Tooltip for Dual Overview Chart
interface DualTooltipProps {
  active?: boolean;
  payload?: any[];
  isApple: boolean;
}

const DualTooltipContent: React.FC<DualTooltipProps> = React.memo(({ active, payload, isApple }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as SyndicateChartDataEntry;
  if (!d) return null;

  return (
    <div
      className={`p-3.5 rounded-xl shadow-xl text-xs space-y-1.5 border min-w-56 ${
        isApple
          ? "bg-white/95 border-[#E5E5EA] text-[#1D1D1F] backdrop-blur-md"
          : "bg-[#0B120E]/95 border-[#23352C] text-[#F3F4F0] backdrop-blur-md"
      }`}
    >
      <div className="font-bold text-sm border-b pb-1.5 flex items-center justify-between border-current/10">
        <span>{d.name}</span>
        <span
          className="font-mono text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${d.color}25`, color: d.color }}
        >
          {d.roiPct >= 0 ? `+${d.roiPct}% ROI` : `${d.roiPct}% ROI`}
        </span>
      </div>
      <div className="flex justify-between items-center pt-0.5">
        <span className="text-[#86868B]">Win-Rate %:</span>
        <span className="font-mono font-bold text-[#0071E3] dark:text-[#D4AF37]">
          {d.winRatePct}% ({d.winsCount} / {d.racesTipped} races)
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[#86868B]">Total Returns ($):</span>
        <span className="font-mono font-bold text-[#10B981]">
          {formatDollarReturn(d.totalDollarReturn)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[#86868B]">Total Outlay ($):</span>
        <span className="font-mono text-[#86868B]">
          {formatDollarReturn(d.totalOutlay)}
        </span>
      </div>
      <div className="flex justify-between items-center border-t border-current/10 pt-1">
        <span className="text-[#86868B]">Net Profit/Loss:</span>
        <span
          className={`font-mono font-bold ${
            d.netProfit >= 0 ? "text-[#10B981]" : "text-[#FF9500]"
          }`}
        >
          {d.netProfit >= 0 ? `+$${d.netProfit.toFixed(2)}` : `-$${Math.abs(d.netProfit).toFixed(2)}`}
        </span>
      </div>
    </div>
  );
});
DualTooltipContent.displayName = "DualTooltipContent";

// Memoized Recharts Subcomponent: Dual Overview (ComposedChart)
interface DualOverviewRechartsChartProps {
  data: SyndicateChartDataEntry[];
  isApple: boolean;
  syndicateAverageWinRate: number;
}

export const DualOverviewRechartsChart: React.FC<DualOverviewRechartsChartProps> = React.memo(
  ({ data, isApple, syndicateAverageWinRate }) => {
    const tooltipRenderer = useCallback(
      (props: any) => <DualTooltipContent {...props} isApple={isApple} />,
      [isApple]
    );

    return (
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isApple ? "#E5E5EA" : "#1F2E25"}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={12}
              tickLine={false}
              dy={10}
            />
            <YAxis
              yAxisId="dollars"
              stroke={isApple ? "#10B981" : "#10B981"}
              fontSize={11}
              tickLine={false}
              tickFormatter={formatDollarTick}
            />
            <YAxis
              yAxisId="winRate"
              orientation="right"
              domain={[0, 100]}
              stroke={isApple ? "#0071E3" : "#D4AF37"}
              fontSize={11}
              tickLine={false}
              tickFormatter={formatPercentTick}
            />
            <Tooltip content={tooltipRenderer} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={renderLegendItem}
            />
            <ReferenceLine
              yAxisId="winRate"
              y={syndicateAverageWinRate}
              stroke="#AF52DE"
              strokeDasharray="4 4"
              label={{
                value: `Avg Win ${syndicateAverageWinRate}%`,
                fill: "#AF52DE",
                fontSize: 10,
                position: "insideTopRight",
              }}
            />
            <Bar
              yAxisId="dollars"
              dataKey="totalDollarReturn"
              name="Total Dollar Returns ($)"
              fill="#10B981"
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
              isAnimationActive={false}
            >
              {data.map((entry, idx) => (
                <Cell
                  key={`bar-${entry.punterId}-${idx}`}
                  fill={isApple ? (idx % 2 === 0 ? "#10B981" : "#34C759") : "#10B981"}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
            <Line
              yAxisId="winRate"
              type="monotone"
              dataKey="winRatePct"
              name="Win-Rate (%)"
              stroke={isApple ? "#0071E3" : "#D4AF37"}
              strokeWidth={3}
              dot={{ r: 5, fill: isApple ? "#0071E3" : "#D4AF37", strokeWidth: 2, stroke: "#FFFFFF" }}
              activeDot={{ r: 8 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
DualOverviewRechartsChart.displayName = "DualOverviewRechartsChart";

// Memoized Recharts Subcomponent: Win-Rate % (BarChart)
interface WinRateRechartsChartProps {
  data: SyndicateChartDataEntry[];
  isApple: boolean;
  syndicateAverageWinRate: number;
}

export const WinRateRechartsChart: React.FC<WinRateRechartsChartProps> = React.memo(
  ({ data, isApple, syndicateAverageWinRate }) => {
    const tooltipFormatter = useCallback(
      (val: any, _name: any, item: any) => [
        `${val}% (${item.payload.winsCount} Wins in ${item.payload.racesTipped} Races)`,
        "Win-Rate",
      ],
      []
    );

    return (
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isApple ? "#E5E5EA" : "#1F2E25"}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={12}
              tickLine={false}
              dy={10}
            />
            <YAxis
              domain={[0, 100]}
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={11}
              tickLine={false}
              tickFormatter={formatPercentTick}
            />
            <Tooltip formatter={tooltipFormatter} />
            <ReferenceLine
              y={syndicateAverageWinRate}
              stroke="#AF52DE"
              strokeDasharray="4 4"
              label={{
                value: `Syndicate Avg (${syndicateAverageWinRate}%)`,
                fill: "#AF52DE",
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="winRatePct"
              name="Win-Rate Percentage (%)"
              fill="#0071E3"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={`wr-bar-${entry.punterId}`}
                  fill={entry.winRatePct >= 40 ? "#10B981" : entry.winRatePct >= 25 ? "#0071E3" : "#FF9500"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
WinRateRechartsChart.displayName = "WinRateRechartsChart";

// Memoized Recharts Subcomponent: Dollar Returns & Outlay (BarChart)
interface DollarReturnsRechartsChartProps {
  data: SyndicateChartDataEntry[];
  isApple: boolean;
}

export const DollarReturnsRechartsChart: React.FC<DollarReturnsRechartsChartProps> = React.memo(
  ({ data, isApple }) => {
    const tooltipFormatter = useCallback(
      (val: any, name: any) => [`$${Number(val).toFixed(2)}`, name],
      []
    );

    return (
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isApple ? "#E5E5EA" : "#1F2E25"}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={12}
              tickLine={false}
              dy={10}
            />
            <YAxis
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={11}
              tickLine={false}
              tickFormatter={formatDollarTick}
            />
            <Tooltip formatter={tooltipFormatter} />
            <Legend verticalAlign="top" height={36} formatter={renderLegendItem} />
            <Bar
              dataKey="totalDollarReturn"
              name="Total Returns ($)"
              fill="#10B981"
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
            />
            <Bar
              dataKey="totalOutlay"
              name="Total Outlay ($)"
              fill={isApple ? "#86868B" : "#4A5A52"}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
DollarReturnsRechartsChart.displayName = "DollarReturnsRechartsChart";

// Memoized Recharts Subcomponent: Growth Timeline (LineChart)
interface GrowthTimelineRechartsChartProps {
  data: DailyTimelinePoint[];
  punters: PunterProfile[];
  isApple: boolean;
}

export const GrowthTimelineRechartsChart: React.FC<GrowthTimelineRechartsChartProps> = React.memo(
  ({ data, punters, isApple }) => {
    const tooltipFormatter = useCallback(
      (val: any, name: any) => [`$${Number(val).toFixed(2)}`, name],
      []
    );

    return (
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 25, left: 10, bottom: 25 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isApple ? "#E5E5EA" : "#1F2E25"}
              vertical={false}
            />
            <XAxis
              dataKey="displayDate"
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={11}
              tickLine={false}
              dy={10}
            />
            <YAxis
              stroke={isApple ? "#86868B" : "#8A9990"}
              fontSize={11}
              tickLine={false}
              tickFormatter={formatDollarTick}
            />
            <Tooltip formatter={tooltipFormatter} />
            <Legend verticalAlign="top" height={36} formatter={renderLegendItem} />
            {punters.map((p, idx) => {
              const color = PUNTER_THEME_COLORS[idx % PUNTER_THEME_COLORS.length].stroke;
              return (
                <Line
                  key={`timeline-${p.id}`}
                  type="monotone"
                  dataKey={`${p.id}_cumReturn`}
                  name={`${p.name} ($)`}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
);
GrowthTimelineRechartsChart.displayName = "GrowthTimelineRechartsChart";

const SyndicatePerformanceSectionComponent: React.FC<SyndicatePerformanceSectionProps> = ({
  meetings = [],
  punters = [],
  onJumpToSelections,
  isApple = true,
}) => {
  const [timeframeDays, setTimeframeDays] = useState<TimeframeOption>("30");
  const [viewMode, setViewMode] = useState<MetricViewMode>("dual");
  const [includeProfileBaselines, setIncludeProfileBaselines] = useState<boolean>(true);
  const [selectedPunterFilter, setSelectedPunterFilter] = useState<string>("all");

  // Determine current Sydney reference date and start date for chosen timeframe
  const todayIso = useMemo(() => getCurrentAustralianDateIso(), []);
  const startDateIso = useMemo(() => {
    const days = parseInt(timeframeDays, 10);
    return offsetAustralianDateIso(todayIso, -days);
  }, [todayIso, timeframeDays]);

  // Combine and deduplicate meetings between prop meetings and seed archive
  const targetTimeframeMeetings = useMemo(() => {
    const meetingMap = new Map<string, RaceMeeting>();

    // Seed archive provides historical depth across last 30 days
    SEED_NSW_TAB_MEETINGS.forEach((m) => {
      const d = normalizeAustralianDateIso(m.date);
      if (d >= startDateIso && d <= todayIso) {
        meetingMap.set(m.id, m);
      }
    });

    // App state meetings take precedence for current updates/patches
    meetings.forEach((m) => {
      const d = normalizeAustralianDateIso(m.date);
      if (d >= startDateIso && d <= todayIso) {
        meetingMap.set(m.id, m);
      }
    });

    return Array.from(meetingMap.values()).sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      if (diff !== 0) return diff;
      return a.venue.localeCompare(b.venue);
    });
  }, [meetings, startDateIso, todayIso]);

  // Evaluate performance for each punter across the timeframe
  const performanceStats = useMemo(() => {
    return punters.map((punter, index) => {
      let racesTipped = 0;
      let completedRaces = 0;
      let winsCount = 0;
      let secondsCount = 0;
      let thirdsCount = 0;
      let podiumCount = 0;
      let totalOutlay = 0;
      let totalDollarReturn = 0;

      // Map punter role to appropriate tipping strategy for unpicked past races
      const strategy: AutoPickStrategy = punter.name.includes("Steve")
        ? "balanced"
        : punter.name.includes("Mark")
        ? "value-hunter"
        : punter.name.includes("Dave")
        ? "market-consensus"
        : "balanced";

      targetTimeframeMeetings.forEach((meeting) => {
        const mSelections = punter.selectionsByMeeting?.[meeting.id] || {};
        const isJokerRaceNum = punter.jokerRaceByMeeting?.[meeting.id] ?? null;

        meeting.races.forEach((race) => {
          const isResulted = isRaceOfficialOrCompleted(race, meeting.date);
          if (!isResulted) return;

          let trio = mSelections[race.raceNumber];
          let hasExplicitSelection =
            trio && (trio.firstPref !== null || trio.secondPref !== null || trio.thirdPref !== null);

          // If user hasn't explicitly tipped a past resulted race and baselines are enabled,
          // synthesize their profile strategy so the 30-day analytics are comprehensive
          if (!hasExplicitSelection && includeProfileBaselines) {
            const autoTrio = generateRaceAutoPickTrio(race.runners, race.raceNumber, strategy);
            trio = {
              firstPref: autoTrio.firstPref,
              secondPref: autoTrio.secondPref,
              thirdPref: autoTrio.thirdPref,
            };
            hasExplicitSelection = true;
          }

          if (hasExplicitSelection && trio) {
            const isJoker = isJokerRaceNum === race.raceNumber;
            const evalRes = evaluateRaceTrio(race, trio, meeting.date, isJoker);

            if (evalRes.hasAnySelection) {
              racesTipped++;
              completedRaces++;
              totalOutlay += evalRes.parOutlayUnits || 6;
              totalDollarReturn += evalRes.raceDollarReturn;

              const hasWin = evalRes.picks.some((p) => p.finishPosition === 1);
              if (hasWin) winsCount++;

              const hasSecond = evalRes.picks.some((p) => p.finishPosition === 2);
              if (hasSecond) secondsCount++;

              const hasThird = evalRes.picks.some((p) => p.finishPosition === 3);
              if (hasThird) thirdsCount++;

              const hasPodium = evalRes.picks.some(
                (p) => p.finishPosition >= 1 && p.finishPosition <= 3
              );
              if (hasPodium) podiumCount++;
            }
          }
        });
      });

      const winRatePct = racesTipped > 0 ? Number(((winsCount / racesTipped) * 100).toFixed(1)) : 0;
      const podiumRatePct = racesTipped > 0 ? Number(((podiumCount / racesTipped) * 100).toFixed(1)) : 0;
      const netProfit = Number((totalDollarReturn - totalOutlay).toFixed(2));
      const roiPct = totalOutlay > 0 ? Number(((netProfit / totalOutlay) * 100).toFixed(1)) : 0;
      const avgReturnPerRace = racesTipped > 0 ? Number((totalDollarReturn / racesTipped).toFixed(2)) : 0;
      const colorTheme = PUNTER_THEME_COLORS[index % PUNTER_THEME_COLORS.length];

      return {
        punterId: punter.id,
        name: punter.name,
        role: punter.role || "Syndicate Punter",
        racesTipped,
        completedRaces,
        winsCount,
        secondsCount,
        thirdsCount,
        podiumCount,
        winRatePct,
        podiumRatePct,
        totalOutlay: Number(totalOutlay.toFixed(2)),
        totalDollarReturn: Number(totalDollarReturn.toFixed(2)),
        netProfit,
        roiPct,
        avgReturnPerRace,
        color: colorTheme.stroke,
      };
    });
  }, [punters, targetTimeframeMeetings, includeProfileBaselines]);

  // Aggregate daily timeline series for cumulative return tracking
  const dailyTimelineData = useMemo(() => {
    const datesMap = new Map<string, { date: string; displayDate: string; [key: string]: any }>();

    // Collect sorted unique dates
    const uniqueDates = Array.from(
      new Set(targetTimeframeMeetings.map((m) => normalizeAustralianDateIso(m.date)))
    ).sort();

    // Initialize daily points
    uniqueDates.forEach((d) => {
      const parts = d.split("-");
      const displayDate = `${parts[2]}/${parts[1]}`;
      const entry: Record<string, any> = { date: d, displayDate };
      punters.forEach((p) => {
        entry[`${p.id}_dayReturn`] = 0;
        entry[`${p.id}_cumReturn`] = 0;
      });
      datesMap.set(d, entry as DailyTimelinePoint);
    });

    // Accumulate each punter's day-by-day return
    punters.forEach((punter) => {
      const strategy: AutoPickStrategy = punter.name.includes("Steve")
        ? "balanced"
        : punter.name.includes("Mark")
        ? "value-hunter"
        : punter.name.includes("Dave")
        ? "market-consensus"
        : "balanced";

      targetTimeframeMeetings.forEach((meeting) => {
        const mDate = normalizeAustralianDateIso(meeting.date);
        const dayEntry = datesMap.get(mDate);
        if (!dayEntry) return;

        const mSelections = punter.selectionsByMeeting?.[meeting.id] || {};
        const isJokerRaceNum = punter.jokerRaceByMeeting?.[meeting.id] ?? null;

        meeting.races.forEach((race) => {
          if (!isRaceOfficialOrCompleted(race, meeting.date)) return;

          let trio = mSelections[race.raceNumber];
          let hasExplicitSelection =
            trio && (trio.firstPref !== null || trio.secondPref !== null || trio.thirdPref !== null);

          if (!hasExplicitSelection && includeProfileBaselines) {
            const autoTrio = generateRaceAutoPickTrio(race.runners, race.raceNumber, strategy);
            trio = {
              firstPref: autoTrio.firstPref,
              secondPref: autoTrio.secondPref,
              thirdPref: autoTrio.thirdPref,
            };
            hasExplicitSelection = true;
          }

          if (hasExplicitSelection && trio) {
            const isJoker = isJokerRaceNum === race.raceNumber;
            const evalRes = evaluateRaceTrio(race, trio, meeting.date, isJoker);
            if (evalRes.hasAnySelection) {
              dayEntry[`${punter.id}_dayReturn`] =
                (dayEntry[`${punter.id}_dayReturn`] as number) + evalRes.raceDollarReturn;
            }
          }
        });
      });

      // Compute running cumulative sum
      let runningCum = 0;
      uniqueDates.forEach((d) => {
        const entry = datesMap.get(d);
        if (entry) {
          runningCum += Number((entry[`${punter.id}_dayReturn`] as number).toFixed(2));
          entry[`${punter.id}_cumReturn`] = Number(runningCum.toFixed(2));
        }
      });
    });

    return Array.from(datesMap.values());
  }, [punters, targetTimeframeMeetings, includeProfileBaselines]);

  // Filter stats if a single punter is selected
  const visiblePuntersStats = useMemo(() => {
    if (selectedPunterFilter === "all") return performanceStats;
    return performanceStats.filter((p) => p.punterId === selectedPunterFilter);
  }, [performanceStats, selectedPunterFilter]);

  // Top performers and syndicate aggregates
  const topWinRatePunter = useMemo(() => {
    if (!performanceStats.length) return null;
    return [...performanceStats].sort((a, b) => b.winRatePct - a.winRatePct)[0];
  }, [performanceStats]);

  const topDollarPunter = useMemo(() => {
    if (!performanceStats.length) return null;
    return [...performanceStats].sort((a, b) => b.totalDollarReturn - a.totalDollarReturn)[0];
  }, [performanceStats]);

  const syndicateTotalReturn = useMemo(() => {
    return Number(performanceStats.reduce((sum, p) => sum + p.totalDollarReturn, 0).toFixed(2));
  }, [performanceStats]);

  const syndicateAverageWinRate = useMemo(() => {
    if (!performanceStats.length) return 0;
    const avg =
      performanceStats.reduce((sum, p) => sum + p.winRatePct, 0) / performanceStats.length;
    return Number(avg.toFixed(1));
  }, [performanceStats]);

  // Formatted chart dataset for Recharts
  const chartData = useMemo(() => {
    return visiblePuntersStats.map((p) => ({
      name: p.name,
      punterId: p.punterId,
      winRatePct: p.winRatePct,
      podiumRatePct: p.podiumRatePct,
      totalDollarReturn: p.totalDollarReturn,
      totalOutlay: p.totalOutlay,
      netProfit: p.netProfit,
      roiPct: p.roiPct,
      winsCount: p.winsCount,
      racesTipped: p.racesTipped,
      color: p.color,
    }));
  }, [visiblePuntersStats]);

  // Memoize total resulted races across meetings
  const totalResultedRacesCount = useMemo(() => {
    return targetTimeframeMeetings.reduce(
      (acc, m) => acc + m.races.filter((r) => isRaceOfficialOrCompleted(r, m.date)).length,
      0
    );
  }, [targetTimeframeMeetings]);

  // Memoize sorted performance list for standings table
  const sortedPerformanceStats = useMemo(() => {
    return [...performanceStats].sort((a, b) => b.totalDollarReturn - a.totalDollarReturn);
  }, [performanceStats]);

  return (
    <section
      id="section-syndicate-performance"
      aria-label="Syndicate 30-Day Performance & Analytics"
      className={`scroll-mt-24 rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]"
          : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
      } p-4 sm:p-6 space-y-6`}
    >
      {/* =========================================================================
          1. HEADER & INTERACTIVE CONTROLS
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Official 30-Day Trackside Analytics</span>
            </span>
            <span className="text-xs text-[#86868B] font-mono">· Recharts Engine</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif font-extrabold tracking-tight mt-1">
            Syndicate Performance
          </h2>
          <p className="text-xs sm:text-sm text-[#86868B] mt-0.5">
            Visualizing each user&apos;s win-rate percentage and total dollar returns over the last{" "}
            <strong className="text-current">{timeframeDays} days</strong> of race data (
            {targetTimeframeMeetings.length} meetings, {totalResultedRacesCount} resulted races).
          </p>
        </div>

        {/* Control Cluster: Timeframe, Chart Mode & Punter Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#16211C] border-[#2B3D34]"
            }`}
          >
            {(["30", "14", "7"] as TimeframeOption[]).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTimeframeDays(days)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeframeDays === days
                    ? isApple
                      ? "bg-white text-[#0071E3] shadow-xs"
                      : "bg-[#10B981] text-[#070B09] shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div
            className={`flex items-center p-1 rounded-xl border ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#16211C] border-[#2B3D34]"
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode("dual")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "dual"
                  ? isApple
                    ? "bg-white text-[#0071E3] shadow-xs"
                    : "bg-[#10B981] text-[#070B09] shadow-xs"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="Dual-Axis Overview (Win-Rate % and Dollar Returns $)"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dual Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("winRate")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "winRate"
                  ? isApple
                    ? "bg-white text-[#0071E3] shadow-xs"
                    : "bg-[#10B981] text-[#070B09] shadow-xs"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="Win-Rate % Only"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Win-Rate %</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("dollars")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "dollars"
                  ? isApple
                    ? "bg-white text-[#0071E3] shadow-xs"
                    : "bg-[#10B981] text-[#070B09] shadow-xs"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="Total Dollar Returns ($) & Outlay"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Returns ($)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "timeline"
                  ? isApple
                    ? "bg-white text-[#0071E3] shadow-xs"
                    : "bg-[#10B981] text-[#070B09] shadow-xs"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="30-Day Cumulative Return Growth Timeline"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Growth Trend</span>
            </button>
          </div>

          {/* User Filter Dropdown */}
          <select
            value={selectedPunterFilter}
            onChange={(e) => setSelectedPunterFilter(e.target.value)}
            aria-label="Filter by Syndicate Member"
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
              isApple
                ? "bg-white border-[#D1D1D6] text-[#1D1D1F] dark:bg-[#1C1C1E] dark:border-[#38383A] dark:text-[#F2F2F7]"
                : "bg-[#16211C] border-[#2B3D34] text-[#F3F4F0]"
            }`}
          >
            <option value="all" className="bg-[#1C1C1E] text-white">
              All Members ({punters.length})
            </option>
            {punters.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#1C1C1E] text-white">
                {p.name} ({p.role ? p.role.split(" ")[0] : "Punter"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =========================================================================
          2. PERFORMANCE HIGHLIGHT BENTO CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Top Win-Rate Punter */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            isApple ? "bg-[#F2F7FF] border-[#0071E3]/25" : "bg-[#0B1522] border-[#38BDF8]/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#0071E3] dark:text-[#38BDF8] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Top Win-Rate Punter
            </span>
            <span className="font-mono text-xs font-bold text-[#0071E3] dark:text-[#38BDF8]">
              {timeframeDays}D Strike
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold truncate">
              {topWinRatePunter ? topWinRatePunter.name : "—"}
            </div>
            <div className="text-2xl font-black font-mono text-[#0071E3] dark:text-[#38BDF8] mt-0.5">
              {topWinRatePunter ? `${topWinRatePunter.winRatePct}%` : "0%"}
            </div>
          </div>
          <div className="text-[11px] text-[#86868B] mt-2 flex items-center justify-between border-t border-current/10 pt-2">
            <span>{topWinRatePunter ? `${topWinRatePunter.winsCount} Wins` : "0"}</span>
            <span>{topWinRatePunter ? `${topWinRatePunter.racesTipped} Races Tipped` : "0"}</span>
          </div>
        </div>

        {/* Top Dollar Return Punter */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            isApple ? "bg-[#F0FDF4] border-[#10B981]/25" : "bg-[#081C14] border-[#10B981]/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#10B981] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              Top Total Returns ($)
            </span>
            <span className="font-mono text-xs font-bold text-[#10B981]">
              {timeframeDays}D Collect
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold truncate">
              {topDollarPunter ? topDollarPunter.name : "—"}
            </div>
            <div className="text-2xl font-black font-mono text-[#10B981] mt-0.5">
              {topDollarPunter ? formatDollarReturn(topDollarPunter.totalDollarReturn) : "$0.00"}
            </div>
          </div>
          <div className="text-[11px] text-[#86868B] mt-2 flex items-center justify-between border-t border-current/10 pt-2">
            <span>
              ROI:{" "}
              <strong
                className={
                  topDollarPunter && topDollarPunter.roiPct >= 0
                    ? "text-[#10B981]"
                    : "text-[#FF9500]"
                }
              >
                {topDollarPunter
                  ? `${topDollarPunter.roiPct >= 0 ? "+" : ""}${topDollarPunter.roiPct}%`
                  : "0%"}
              </strong>
            </span>
            <span>
              Net:{" "}
              {topDollarPunter
                ? `${topDollarPunter.netProfit >= 0 ? "+" : ""}$${topDollarPunter.netProfit.toFixed(0)}`
                : "$0"}
            </span>
          </div>
        </div>

        {/* Syndicate Combined Return */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            isApple ? "bg-[#FCF9F0] border-[#D4AF37]/30" : "bg-[#1E1908] border-[#D4AF37]/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#D4AF37] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Club Combined Returns
            </span>
            <span className="font-mono text-xs font-bold text-[#D4AF37]">Syndicate Pool</span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold">All Active Punters</div>
            <div className="text-2xl font-black font-mono text-[#D4AF37] mt-0.5">
              {formatDollarReturn(syndicateTotalReturn)}
            </div>
          </div>
          <div className="text-[11px] text-[#86868B] mt-2 flex items-center justify-between border-t border-current/10 pt-2">
            <span>{punters.length} Syndicate Members</span>
            <span>{targetTimeframeMeetings.length} Meetings Scored</span>
          </div>
        </div>

        {/* Syndicate Average Win Rate */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
            isApple ? "bg-[#FAF5FF] border-[#AF52DE]/25" : "bg-[#1B0B26] border-[#AF52DE]/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#AF52DE] flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Syndicate Average Strike
            </span>
            <span className="font-mono text-xs font-bold text-[#AF52DE]">Benchmark</span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold">Consensus Win-Rate</div>
            <div className="text-2xl font-black font-mono text-[#AF52DE] mt-0.5">
              {syndicateAverageWinRate}%
            </div>
          </div>
          <div className="text-[11px] text-[#86868B] mt-2 flex items-center justify-between border-t border-current/10 pt-2">
            <span>Place Rate: ~65%</span>
            <span>Target: &gt;33% Par</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. RECHARTS VISUALIZATION CONTAINER
          ========================================================================= */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#111A16] border-[#1F2E25]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight">
              {viewMode === "dual" && "Dual Metric: Total Dollar Returns ($) vs. Win-Rate (%)"}
              {viewMode === "winRate" && "Member Win-Rate Percentage Comparison (Last 30 Days)"}
              {viewMode === "dollars" && "Total Dollar Returns ($) & Outlay Breakdown"}
              {viewMode === "timeline" && "Cumulative Dollar Return Growth Over Time"}
            </h3>
            <span className="text-[11px] text-[#86868B] font-mono">
              (Over {timeframeDays} Days of Australian Racing)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#86868B]">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeProfileBaselines}
                onChange={(e) => setIncludeProfileBaselines(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#0071E3] focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] font-medium">Include Profile Strategy Baselines</span>
            </label>
          </div>
        </div>

        {/* 3.1 DUAL OVERVIEW (COMPOSED CHART: BARS = DOLLARS, LINE = WIN RATE %) */}
        {viewMode === "dual" && (
          <DualOverviewRechartsChart
            data={chartData}
            isApple={isApple}
            syndicateAverageWinRate={syndicateAverageWinRate}
          />
        )}

        {/* 3.2 WIN RATE % BAR CHART */}
        {viewMode === "winRate" && (
          <WinRateRechartsChart
            data={chartData}
            isApple={isApple}
            syndicateAverageWinRate={syndicateAverageWinRate}
          />
        )}

        {/* 3.3 DOLLAR RETURNS & OUTLAY COMPARISON */}
        {viewMode === "dollars" && (
          <DollarReturnsRechartsChart
            data={chartData}
            isApple={isApple}
          />
        )}

        {/* 3.4 CUMULATIVE 30-DAY TIMELINE */}
        {viewMode === "timeline" && (
          <GrowthTimelineRechartsChart
            data={dailyTimelineData}
            punters={punters}
            isApple={isApple}
          />
        )}
      </div>

      {/* =========================================================================
          4. SYNDICATE MEMBER STATISTICAL BREAKDOWN TABLE
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#86868B] flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Member 30-Day League Standings &amp; Financial Ledger</span>
          </h4>
          <span className="text-[11px] text-[#86868B]">
            Basis: $1 Win + $1 Place ($2 Each-Way / Selection)
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-current/10">
          <table className="w-full text-xs text-left">
            <thead>
              <tr
                className={`border-b border-current/10 font-bold uppercase tracking-wider text-[10px] ${
                  isApple ? "bg-[#F2F2F7] text-[#86868B]" : "bg-[#141C18] text-[#8A9990]"
                }`}
              >
                <th className="py-2.5 px-3">Rank / Punter</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-right">Races Tipped</th>
                <th className="py-2.5 px-3 text-right">Wins</th>
                <th className="py-2.5 px-3 text-right">Win Rate %</th>
                <th className="py-2.5 px-3 text-right">Place Rate %</th>
                <th className="py-2.5 px-3 text-right">Total Outlay</th>
                <th className="py-2.5 px-3 text-right">Dollar Returns</th>
                <th className="py-2.5 px-3 text-right">Net Profit</th>
                <th className="py-2.5 px-3 text-right">ROI %</th>
                {onJumpToSelections && <th className="py-2.5 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-current/5">
              {sortedPerformanceStats.map((stat, idx) => {
                  const isTopEarner = idx === 0;
                  const isPositiveRoi = stat.roiPct >= 0;

                  return (
                    <tr
                      key={stat.punterId}
                      className={`hover:bg-current/5 transition-colors ${
                        isTopEarner ? (isApple ? "bg-[#0071E3]/5" : "bg-[#10B981]/5") : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0
                              ? "bg-[#D4AF37] text-black"
                              : idx === 1
                              ? "bg-[#C0C0C0] text-black"
                              : idx === 2
                              ? "bg-[#CD7F32] text-white"
                              : "bg-current/10 text-current"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{stat.name}</span>
                          {isTopEarner && (
                            <span title="Leader">
                              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#86868B]">{stat.role}</td>
                      <td className="py-3 px-3 text-right font-mono">{stat.racesTipped}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-current">
                        {stat.winsCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0071E3] dark:text-[#38BDF8]">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 bg-current/10 rounded-full h-1.5 overflow-hidden hidden sm:block">
                            <div
                              className="bg-[#0071E3] dark:bg-[#38BDF8] h-full rounded-full"
                              style={{ width: `${Math.min(100, stat.winRatePct)}%` }}
                            />
                          </div>
                          <span>{stat.winRatePct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#86868B]">
                        {stat.podiumRatePct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[#86868B]">
                        ${stat.totalOutlay.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#10B981]">
                        ${stat.totalDollarReturn.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          stat.netProfit >= 0 ? "text-[#10B981]" : "text-[#FF9500]"
                        }`}
                      >
                        {stat.netProfit >= 0 ? `+$${stat.netProfit.toFixed(2)}` : `-$${Math.abs(stat.netProfit).toFixed(2)}`}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isPositiveRoi
                              ? "bg-[#10B981]/15 text-[#10B981]"
                              : "bg-[#FF9500]/15 text-[#FF9500]"
                          }`}
                        >
                          {isPositiveRoi ? `+${stat.roiPct}%` : `${stat.roiPct}%`}
                        </span>
                      </td>
                      {onJumpToSelections && (
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onJumpToSelections(stat.punterId)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-current/15 hover:border-current/30 hover:bg-current/10 transition-all cursor-pointer"
                          >
                            Tips →
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

function areSyndicatePerformancePropsEqual(
  prevProps: SyndicatePerformanceSectionProps,
  nextProps: SyndicatePerformanceSectionProps
): boolean {
  if (prevProps.isApple !== nextProps.isApple) return false;
  if (prevProps.punters !== nextProps.punters) return false;
  if (prevProps.meetings !== nextProps.meetings) {
    if (prevProps.meetings.length !== nextProps.meetings.length) return false;
    for (let i = 0; i < prevProps.meetings.length; i++) {
      const pm = prevProps.meetings[i];
      const nm = nextProps.meetings[i];
      if (pm.id !== nm.id || pm.races.length !== nm.races.length) return false;
    }
  }
  return true;
}

export const SyndicatePerformanceSection = React.memo(
  SyndicatePerformanceSectionComponent,
  areSyndicatePerformancePropsEqual
);
