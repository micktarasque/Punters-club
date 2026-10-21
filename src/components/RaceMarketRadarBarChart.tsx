import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Award,
  Zap,
  BarChart3,
  Target,
  Sparkles,
  ChevronRight,
  Info,
  ShieldCheck,
  Check,
  Flame,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import {
  analyzeRaceBettingStrategy,
  RunnerStrategyAnalysis,
} from "../utils/bettingStrategyEngine";

export interface RaceMarketRadarBarChartProps {
  meeting: RaceMeeting;
  raceNumber: number;
  onSelectRaceNumber?: (raceNo: number) => void;
  allMeetings?: RaceMeeting[];
  onSelectMeeting?: (meetingId: string) => void;
  isApple?: boolean;
  activePunter?: PunterProfile;
  currentSelections?: {
    firstPref?: number | null;
    secondPref?: number | null;
    thirdPref?: number | null;
  };
  onAssignPreference?: (prefRank: 1 | 2 | 3, tabNumber: number) => void;
  onInspectFormGuide?: () => void;
}

type ChartViewMode = "bar" | "radar";
type BarMetricMode = "oddsVsFair" | "ratingsVsImplied" | "valueEdge";
type SortOption = "oddsAsc" | "valueEdgeDesc" | "ratingDesc" | "tabAsc";

const RADAR_COLORS = [
  { stroke: "#0071E3", fill: "#0071E3", label: "Favorite" },
  { stroke: "#34C759", fill: "#34C759", label: "Top Value" },
  { stroke: "#FF9500", fill: "#FF9500", label: "Contender" },
  { stroke: "#AF52DE", fill: "#AF52DE", label: "Challenger" },
];

export const RaceMarketRadarBarChart: React.FC<RaceMarketRadarBarChartProps> = ({
  meeting,
  raceNumber,
  onSelectRaceNumber,
  allMeetings = [],
  onSelectMeeting,
  isApple = true,
  activePunter,
  currentSelections,
  onAssignPreference,
  onInspectFormGuide,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>("bar");
  const [barMetricMode, setBarMetricMode] = useState<BarMetricMode>("oddsVsFair");
  const [sortOption, setSortOption] = useState<SortOption>("oddsAsc");
  const [selectedRadarTabs, setSelectedRadarTabs] = useState<number[]>([]);
  const [hoveredRunnerTab, setHoveredRunnerTab] = useState<number | null>(null);

  // Locate currently targeted race event
  const currentRace: RaceEvent | undefined = useMemo(() => {
    return (
      meeting.races.find((r) => r.raceNumber === raceNumber) ||
      meeting.races[0]
    );
  }, [meeting, raceNumber]);

  // Compute quantitative model analytics for active runners
  const analysisData: RunnerStrategyAnalysis[] = useMemo(() => {
    if (!currentRace) return [];
    return analyzeRaceBettingStrategy(currentRace, meeting);
  }, [currentRace, meeting]);

  // Identify Market Favorite, Top Value Overlay, and Best Roughie
  const marketFavorite = useMemo(() => {
    if (!analysisData.length) return null;
    return [...analysisData].sort((a, b) => a.bookmakerOdds - b.bookmakerOdds)[0];
  }, [analysisData]);

  const topValueRunner = useMemo(() => {
    if (!analysisData.length) return null;
    // Pick runner with highest positive edge and decent rating
    const valueRunners = [...analysisData]
      .filter((r) => r.edgePct > 0)
      .sort((a, b) => b.edgePct - a.edgePct);
    return valueRunners.length > 0 ? valueRunners[0] : null;
  }, [analysisData]);

  const bestRoughie = useMemo(() => {
    if (!analysisData.length) return null;
    // Value runners with double-digit odds ($10+)
    const roughies = [...analysisData]
      .filter((r) => r.bookmakerOdds >= 10.0 && r.speedRating >= 78)
      .sort((a, b) => b.edgePct - a.edgePct);
    return roughies.length > 0 ? roughies[0] : null;
  }, [analysisData]);

  // Initialize default radar selections (Favorite + Top Value + 2 top contenders)
  useMemo(() => {
    if (!analysisData.length) return;
    const initialTabs: number[] = [];
    if (marketFavorite) initialTabs.push(marketFavorite.tabNumber);
    if (topValueRunner && topValueRunner.tabNumber !== marketFavorite?.tabNumber) {
      initialTabs.push(topValueRunner.tabNumber);
    }
    // Add next best rated runner not yet included
    const sortedByRating = [...analysisData].sort(
      (a, b) => b.compositeRating - a.compositeRating
    );
    for (const r of sortedByRating) {
      if (initialTabs.length >= 4) break;
      if (!initialTabs.includes(r.tabNumber)) {
        initialTabs.push(r.tabNumber);
      }
    }
    setSelectedRadarTabs(initialTabs);
  }, [currentRace?.raceNumber, meeting.id]);

  // Sort analysis items for Bar chart
  const sortedBarData = useMemo(() => {
    const list = [...analysisData];
    switch (sortOption) {
      case "oddsAsc":
        return list.sort((a, b) => a.bookmakerOdds - b.bookmakerOdds);
      case "valueEdgeDesc":
        return list.sort((a, b) => b.edgePct - a.edgePct);
      case "ratingDesc":
        return list.sort((a, b) => b.compositeRating - a.compositeRating);
      case "tabAsc":
      default:
        return list.sort((a, b) => a.tabNumber - b.tabNumber);
    }
  }, [analysisData, sortOption]);

  // Transform data for Recharts Bar Chart
  const chartData = useMemo(() => {
    return sortedBarData.map((item) => {
      const isFav = item.tabNumber === marketFavorite?.tabNumber;
      const isTopVal = item.tabNumber === topValueRunner?.tabNumber;

      return {
        tabNumber: item.tabNumber,
        horseName: item.horseName,
        label: `#${item.tabNumber} ${item.horseName.length > 12 ? item.horseName.slice(0, 11) + "…" : item.horseName}`,
        fullHorseName: item.horseName,
        barrier: item.barrier,
        jockey: item.jockey,
        trainer: item.trainer,
        bookmakerOdds: Number(item.bookmakerOdds.toFixed(2)),
        modelFairOdds: Number(item.modelFairOdds.toFixed(2)),
        impliedProbPct: Number(item.impliedProbPct.toFixed(1)),
        modelWinProbPct: Number(item.modelWinProbPct.toFixed(1)),
        compositeRating: item.compositeRating,
        speedRating: item.speedRating,
        formScore: item.formScore,
        edgePct: Number(item.edgePct.toFixed(1)),
        valueGrade: item.valueGrade,
        isFav,
        isTopVal,
        color: isFav
          ? isApple
            ? "#0071E3"
            : "#38BDF8"
          : isTopVal || item.edgePct >= 15
          ? isApple
            ? "#34C759"
            : "#10B981"
          : item.edgePct >= 0
          ? isApple
            ? "#FF9500"
            : "#F59E0B"
          : isApple
            ? "#8E8E93"
            : "#64748B",
      };
    });
  }, [sortedBarData, marketFavorite, topValueRunner, isApple]);

  // Multi-dimensional Radar Chart Axes data
  // We compare up to 4 selected runners across 6 dimensions
  const radarAxes = useMemo(() => {
    if (!analysisData.length) return [];

    const dimensions = [
      { key: "marketConfidence", label: "Market Implied %", fullMark: 100 },
      { key: "speedPower", label: "Speed & Sectional", fullMark: 100 },
      { key: "formScore", label: "Form & Strike", fullMark: 100 },
      { key: "barrierSuitability", label: "Barrier Bias", fullMark: 100 },
      { key: "connectionsScore", label: "Jockey/Trainer", fullMark: 100 },
      { key: "valueEdgeScore", label: "Value Edge", fullMark: 100 },
    ];

    const targetRunners = analysisData.filter((r) =>
      selectedRadarTabs.includes(r.tabNumber)
    );

    return dimensions.map((dim) => {
      const axisPoint: Record<string, string | number> = {
        subject: dim.label,
        fullMark: dim.fullMark,
      };

      targetRunners.forEach((r) => {
        let val = 50;
        if (dim.key === "marketConfidence") {
          // Normalize implied probability (0-50% -> 0-100 score)
          val = Math.min(100, Math.round(r.impliedProbPct * 2));
        } else if (dim.key === "speedPower") {
          val = r.speedRating;
        } else if (dim.key === "formScore") {
          val = r.formScore;
        } else if (dim.key === "barrierSuitability") {
          // Lower barrier numbers generally score higher, modified by speed map
          val = Math.max(30, Math.round(100 - r.barrier * 4.5));
        } else if (dim.key === "connectionsScore") {
          val = Math.min(
            99,
            Math.round(
              r.jockeyStats.winRatePct * 2.5 + r.trainerStats.winRatePct * 2.5
            )
          );
        } else if (dim.key === "valueEdgeScore") {
          // Map edgePct (-50% to +50%) into 10 to 95
          val = Math.max(10, Math.min(99, Math.round(50 + r.edgePct)));
        }
        axisPoint[`runner_${r.tabNumber}`] = val;
      });

      return axisPoint;
    });
  }, [analysisData, selectedRadarTabs]);

  const activeRadarRunners = useMemo(() => {
    return analysisData.filter((r) => selectedRadarTabs.includes(r.tabNumber));
  }, [analysisData, selectedRadarTabs]);

  const toggleRadarTab = (tabNo: number) => {
    setSelectedRadarTabs((prev) => {
      if (prev.includes(tabNo)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((t) => t !== tabNo);
      }
      if (prev.length >= 4) {
        // Replace oldest
        return [...prev.slice(1), tabNo];
      }
      return [...prev, tabNo];
    });
  };

  if (!currentRace || analysisData.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Market vs Model Strength Intelligence"
      className={`rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]"
          : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
      } p-4 sm:p-6 space-y-6`}
    >
      {/* =========================================================================
          1. HEADER & TOP CONTROLS (Race Switcher, Meeting, View Switcher)
          ========================================================================= */}
      <div className="flex flex-col gap-4 border-b pb-5 border-current/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono font-bold tracking-wider uppercase ${
                  isApple ? "text-[#0071E3]" : "text-[#10B981]"
                }`}
              >
                Market vs. Model Intelligence
              </span>
              <span className="text-xs text-[#86868B] font-mono">
                Recharts Analytics Suite
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
              Race {currentRace.raceNumber} Market Distribution &amp; Value Engine
            </h3>
            {/* Clean unboxed metadata with typographic separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#86868B] mt-1">
              <span className="font-semibold text-current">
                {meeting.venue} ({meeting.state})
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentRace.raceName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{currentRace.distance}m</span>
              <span aria-hidden="true">·</span>
              <span>Track: {meeting.trackRating}</span>
              <span aria-hidden="true">·</span>
              <span>{analysisData.length} Contenders Evaluated</span>
            </div>
          </div>

          {/* View Mode Segmented Control (Bar Chart vs Radar Chart) */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center p-1 rounded-xl border ${
                isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA]"
                  : "bg-[#1A2420] border-[#2B3D34]"
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode("bar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "bar"
                    ? isApple
                      ? "bg-white text-[#0071E3] shadow-xs"
                      : "bg-[#10B981] text-[#070B09] shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Distribution Bar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("radar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "radar"
                    ? isApple
                      ? "bg-white text-[#0071E3] shadow-xs"
                      : "bg-[#10B981] text-[#070B09] shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Contenders Radar</span>
              </button>
            </div>

            {onInspectFormGuide && (
              <button
                type="button"
                onClick={onInspectFormGuide}
                className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-current/15 hover:border-current/30 transition-all cursor-pointer"
              >
                <span>Full Form</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Race Jump Ribbon (R1 - R12) */}
        {onSelectRaceNumber && meeting.races.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider shrink-0 mr-1">
              Select Race:
            </span>
            {meeting.races.map((r) => {
              const isSelected = r.raceNumber === currentRace.raceNumber;
              return (
                <button
                  key={r.raceNumber}
                  type="button"
                  onClick={() => onSelectRaceNumber(r.raceNumber)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? isApple
                        ? "bg-[#0071E3] text-white shadow-xs"
                        : "bg-[#10B981] text-[#070B09] shadow-xs"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      : "bg-[#1A2420] text-[#8A9990] hover:text-[#F3F4F0]"
                  }`}
                >
                  R{r.raceNumber}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          2. INSIGHT BENTO: MARKET FAVORITE vs TOP VALUE OVERLAY CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Market Favorite Card */}
        {marketFavorite && (
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              isApple
                ? "bg-[#F2F7FF] border-[#0071E3]/25"
                : "bg-[#0E1D2E] border-[#38BDF8]/25"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-wide text-[#0071E3] dark:text-[#38BDF8]">
                  <Flame className="w-3.5 h-3.5" />
                  <span>MARKET FAVORITE · CONSENSUS ANCHOR</span>
                </div>
                <span className="font-mono text-sm font-black text-[#0071E3] dark:text-[#38BDF8]">
                  ${marketFavorite.bookmakerOdds.toFixed(2)}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <h4 className="text-lg font-bold">
                    #{marketFavorite.tabNumber} {marketFavorite.horseName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#86868B] mt-0.5">
                    <span>Barrier {marketFavorite.barrier}</span>
                    <span aria-hidden="true">·</span>
                    <span>Jockey: {marketFavorite.jockey}</span>
                    <span aria-hidden="true">·</span>
                    <span>Speed Rtg: {marketFavorite.speedRating}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#86868B] block">Implied Win Prob</span>
                  <span className="font-mono text-base font-bold text-current">
                    {marketFavorite.impliedProbPct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs text-[#86868B] leading-relaxed">
                Clear bookmaker favorite. Model fair price evaluates to{" "}
                <strong className="text-current font-mono">
                  ${marketFavorite.modelFairOdds.toFixed(2)}
                </strong>{" "}
                ({marketFavorite.edgePct >= 0 ? "Positive overlay" : "Under the odds premium"}).
              </p>
            </div>

            {/* Quick Preference Assignment */}
            {onAssignPreference && activePunter && (
              <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between">
                <span className="text-[11px] text-[#86868B]">
                  Punter Action ({activePunter.name}):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAssignPreference(1, marketFavorite.tabNumber)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-colors cursor-pointer"
                  >
                    Set 1st Pick
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignPreference(2, marketFavorite.tabNumber)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-current/20 hover:bg-current/5 transition-colors cursor-pointer"
                  >
                    Set 2nd
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Value Overlay Runner Card */}
        {topValueRunner ? (
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              isApple
                ? "bg-[#EAFBF0] border-[#34C759]/30"
                : "bg-[#0F261B] border-[#10B981]/30"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-wide text-[#34C759] dark:text-[#10B981]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>TOP STATISTICAL VALUE OVERLAY</span>
                </div>
                <span className="font-mono text-xs font-bold text-[#34C759] dark:text-[#10B981]">
                  +{topValueRunner.edgePct.toFixed(1)}% EDGE
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <h4 className="text-lg font-bold">
                    #{topValueRunner.tabNumber} {topValueRunner.horseName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#86868B] mt-0.5">
                    <span>Barrier {topValueRunner.barrier}</span>
                    <span aria-hidden="true">·</span>
                    <span>Jockey: {topValueRunner.jockey}</span>
                    <span aria-hidden="true">·</span>
                    <span>Composite: {topValueRunner.compositeRating}/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#86868B] block">Market Odds</span>
                  <span className="font-mono text-base font-bold text-[#34C759] dark:text-[#10B981]">
                    ${topValueRunner.bookmakerOdds.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs text-[#86868B] leading-relaxed">
                Quantitative model projects fair true price of{" "}
                <strong className="text-current font-mono">
                  ${topValueRunner.modelFairOdds.toFixed(2)}
                </strong>{" "}
                against market price of{" "}
                <strong className="text-current font-mono">
                  ${topValueRunner.bookmakerOdds.toFixed(2)}
                </strong>
                , signaling a premier risk-adjusted overlay opportunity.
              </p>
            </div>

            {/* Quick Preference Assignment */}
            {onAssignPreference && activePunter && (
              <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between">
                <span className="text-[11px] text-[#86868B]">
                  Punter Action ({activePunter.name}):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAssignPreference(2, topValueRunner.tabNumber)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#34C759] text-white hover:bg-[#2FB350] transition-colors cursor-pointer"
                  >
                    Set 2nd Value
                  </button>
                  <button
                    type="button"
                    onClick={() => onAssignPreference(3, topValueRunner.tabNumber)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-current/20 hover:bg-current/5 transition-colors cursor-pointer"
                  >
                    Set 3rd
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`p-4 rounded-xl border flex flex-col justify-center items-center text-center ${
              isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#151D19] border-[#23352C]"
            }`}
          >
            <Info className="w-5 h-5 text-[#86868B] mb-1" />
            <span className="text-xs font-semibold">Tightly Priced Market</span>
            <p className="text-[11px] text-[#86868B] max-w-xs mt-1">
              No extreme positive overlays detected. Market is currently tracking close to theoretical bookmaker par.
            </p>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. MAIN VISUALIZATION AREA: BAR CHART vs RADAR CHART
          ========================================================================= */}
      {viewMode === "bar" ? (
        <div className="space-y-4">
          {/* Bar Chart Secondary Controls (Metric mode & Sort) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Metric Mode Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-current/5">
              <button
                type="button"
                onClick={() => setBarMetricMode("oddsVsFair")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  barMetricMode === "oddsVsFair"
                    ? isApple
                      ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : "text-[#86868B] hover:text-current"
                }`}
              >
                Odds vs. Fair Price ($)
              </button>
              <button
                type="button"
                onClick={() => setBarMetricMode("ratingsVsImplied")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  barMetricMode === "ratingsVsImplied"
                    ? isApple
                      ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : "text-[#86868B] hover:text-current"
                }`}
              >
                Model Rating vs. Implied %
              </button>
              <button
                type="button"
                onClick={() => setBarMetricMode("valueEdge")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  barMetricMode === "valueEdge"
                    ? isApple
                      ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : "text-[#86868B] hover:text-current"
                }`}
              >
                Value Edge Index (%)
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#86868B] flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort:
              </span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className={`rounded-lg px-2.5 py-1 text-xs border font-medium cursor-pointer ${
                  isApple
                    ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                    : "bg-[#1A2420] border-[#2B3D34] text-[#F3F4F0]"
                }`}
              >
                <option value="oddsAsc">Favorites First (Lowest Odds)</option>
                <option value="valueEdgeDesc">Highest Value Edge (+%)</option>
                <option value="ratingDesc">Highest Model Rating</option>
                <option value="tabAsc">TAB Number (1–{chartData.length})</option>
              </select>
            </div>
          </div>

          {/* Recharts Bar Chart Container */}
          <div className="w-full h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 15, left: 0, bottom: 25 }}
                onMouseMove={(state: any) => {
                  if (state?.activePayload && state.activePayload.length) {
                    setHoveredRunnerTab(
                      state.activePayload[0]?.payload?.tabNumber || null
                    );
                  }
                }}
                onMouseLeave={() => setHoveredRunnerTab(null)}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isApple ? "#E5E5EA" : "#1A2420"}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={isApple ? "#86868B" : "#8A9990"}
                  fontSize={11}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke={isApple ? "#86868B" : "#8A9990"}
                  fontSize={11}
                  tickFormatter={(val) =>
                    barMetricMode === "oddsVsFair"
                      ? `$${val}`
                      : barMetricMode === "valueEdge"
                      ? `${val}%`
                      : `${val}`
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div
                        className={`p-3 rounded-xl border shadow-lg text-xs space-y-2 ${
                          isApple
                            ? "bg-white/95 border-[#E5E5EA] text-[#1D1D1F] backdrop-blur-md"
                            : "bg-[#0E1512]/95 border-[#23352C] text-[#F3F4F0] backdrop-blur-md"
                        }`}
                      >
                        <div className="border-b pb-1.5 border-current/10">
                          <div className="font-bold text-sm">
                            #{data.tabNumber} {data.fullHorseName}
                          </div>
                          <div className="text-[11px] text-[#86868B]">
                            Barrier {data.barrier} · {data.jockey} · {data.trainer}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                          <div>
                            <span className="text-[#86868B]">Market Odds: </span>
                            <span className="font-bold">${data.bookmakerOdds.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[#86868B]">Fair Odds: </span>
                            <span className="font-bold">${data.modelFairOdds.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[#86868B]">Implied Prob: </span>
                            <span>{data.impliedProbPct}%</span>
                          </div>
                          <div>
                            <span className="text-[#86868B]">Model Win Prob: </span>
                            <span>{data.modelWinProbPct}%</span>
                          </div>
                          <div>
                            <span className="text-[#86868B]">Speed Rating: </span>
                            <span>{data.speedRating}/100</span>
                          </div>
                          <div>
                            <span className="text-[#86868B]">Composite: </span>
                            <span>{data.compositeRating}/100</span>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-current/10 flex items-center justify-between">
                          <span className="text-[11px] text-[#86868B]">Edge Delta:</span>
                          <span
                            className={`font-mono font-bold ${
                              data.edgePct >= 0
                                ? "text-[#34C759] dark:text-[#10B981]"
                                : "text-[#FF9500] dark:text-[#F59E0B]"
                            }`}
                          >
                            {data.edgePct >= 0 ? `+${data.edgePct}%` : `${data.edgePct}%`}
                          </span>
                        </div>

                        {data.isFav && (
                          <div className="text-[10px] font-bold text-[#0071E3] dark:text-[#38BDF8]">
                            ★ Market Consensus Favorite
                          </div>
                        )}
                        {data.isTopVal && (
                          <div className="text-[10px] font-bold text-[#34C759] dark:text-[#10B981]">
                            💎 Top Model Statistical Overlay
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />

                {barMetricMode === "oddsVsFair" && (
                  <>
                    <Bar
                      dataKey="bookmakerOdds"
                      name="Market Win Odds ($)"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-odds-${index}`}
                          fill={entry.color}
                          opacity={
                            hoveredRunnerTab === null ||
                            hoveredRunnerTab === entry.tabNumber
                              ? 0.95
                              : 0.4
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="modelFairOdds"
                      name="Model Fair Price ($)"
                      fill={isApple ? "#A1A1A6" : "#4B5563"}
                      radius={[4, 4, 0, 0]}
                    />
                  </>
                )}

                {barMetricMode === "ratingsVsImplied" && (
                  <>
                    <Bar
                      dataKey="compositeRating"
                      name="Model Composite Rating (0–100)"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-rtg-${index}`}
                          fill={entry.color}
                          opacity={
                            hoveredRunnerTab === null ||
                            hoveredRunnerTab === entry.tabNumber
                              ? 0.95
                              : 0.4
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="impliedProbPct"
                      name="Market Implied Prob (%)"
                      fill={isApple ? "#5856D6" : "#818CF8"}
                      radius={[4, 4, 0, 0]}
                    />
                  </>
                )}

                {barMetricMode === "valueEdge" && (
                  <>
                    <ReferenceLine y={0} stroke={isApple ? "#1D1D1F" : "#F3F4F0"} />
                    <Bar
                      dataKey="edgePct"
                      name="Value Edge Delta (%)"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-edge-${index}`}
                          fill={
                            entry.edgePct >= 15
                              ? "#34C759"
                              : entry.edgePct >= 0
                              ? "#FF9500"
                              : "#EF4444"
                          }
                          opacity={
                            hoveredRunnerTab === null ||
                            hoveredRunnerTab === entry.tabNumber
                              ? 0.95
                              : 0.4
                          }
                        />
                      ))}
                    </Bar>
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Explanatory Key */}
          <div className="flex flex-wrap items-center justify-between text-xs text-[#86868B] pt-2 border-t border-current/10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
                <span>Market Favorite</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                <span>Value Overlay (&gt;15% Edge)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
                <span>Moderate Contender</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8E8E93]" />
                <span>Underlay / Longshot</span>
              </span>
            </div>
            <span className="font-mono text-[11px]">
              Click runner to inspect or assign selections below
            </span>
          </div>
        </div>
      ) : (
        /* =========================================================================
           RADAR CHART: MULTI-DIMENSIONAL CONTENDER COMPARISON
           ========================================================================= */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold">
                Contenders Profile Matrix (Compare up to 4 Runners)
              </h4>
              <p className="text-xs text-[#86868B]">
                Assesses Market Confidence, Speed, Form, Barrier Bias, Connections &amp; Value Edge.
              </p>
            </div>

            {/* Runner Selector Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {analysisData.slice(0, 8).map((r) => {
                const isSelected = selectedRadarTabs.includes(r.tabNumber);
                const colorIdx = selectedRadarTabs.indexOf(r.tabNumber);
                const assignedColor =
                  colorIdx >= 0 ? RADAR_COLORS[colorIdx % RADAR_COLORS.length].stroke : null;

                return (
                  <button
                    key={r.tabNumber}
                    type="button"
                    onClick={() => toggleRadarTab(r.tabNumber)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "border-current shadow-xs font-bold"
                        : "border-current/15 opacity-60 hover:opacity-100"
                    }`}
                    style={
                      isSelected && assignedColor
                        ? { borderColor: assignedColor, color: assignedColor }
                        : {}
                    }
                  >
                    <span>#{r.tabNumber}</span>
                    <span>{r.horseName.slice(0, 8)}</span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full h-80 sm:h-96 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="75%"
                data={radarAxes}
              >
                <PolarGrid stroke={isApple ? "#E5E5EA" : "#1A2420"} />
                <PolarAngleAxis
                  dataKey="subject"
                  stroke={isApple ? "#1D1D1F" : "#F3F4F0"}
                  fontSize={11}
                  fontWeight={600}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  stroke={isApple ? "#86868B" : "#8A9990"}
                  fontSize={10}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div
                        className={`p-3 rounded-xl border shadow-lg text-xs space-y-1.5 ${
                          isApple
                            ? "bg-white/95 border-[#E5E5EA] text-[#1D1D1F] backdrop-blur-md"
                            : "bg-[#0E1512]/95 border-[#23352C] text-[#F3F4F0] backdrop-blur-md"
                        }`}
                      >
                        <div className="font-bold text-sm border-b pb-1 border-current/10">
                          {label}
                        </div>
                        {payload.map((item, idx) => {
                          const tabNo = Number(String(item.dataKey).replace("runner_", ""));
                          const runnerObj = analysisData.find((r) => r.tabNumber === tabNo);
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-4 font-mono text-[11px]"
                            >
                              <span style={{ color: item.color }} className="font-bold">
                                #{tabNo} {runnerObj?.horseName || "Runner"}:
                              </span>
                              <span className="font-bold">{item.value}/100</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />

                {activeRadarRunners.map((runner, idx) => {
                  const colorObj = RADAR_COLORS[idx % RADAR_COLORS.length];
                  return (
                    <Radar
                      key={runner.tabNumber}
                      name={`#${runner.tabNumber} ${runner.horseName} ($${runner.bookmakerOdds.toFixed(2)})`}
                      dataKey={`runner_${runner.tabNumber}`}
                      stroke={colorObj.stroke}
                      fill={colorObj.fill}
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  );
                })}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. RUNNER DIRECT SELECTION TABLE & VALUE CLASSIFICATION
          ========================================================================= */}
      <div className="pt-2 border-t border-current/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#86868B]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
              Quick Preference Assignment from Chart
            </span>
          </div>
          <span className="text-xs text-[#86868B]">
            Showing top contenders ranked by {sortOption}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sortedBarData.slice(0, 6).map((runner) => {
            const isFav = runner.tabNumber === marketFavorite?.tabNumber;
            const isTopVal = runner.tabNumber === topValueRunner?.tabNumber;
            const is1st = currentSelections?.firstPref === runner.tabNumber;
            const is2nd = currentSelections?.secondPref === runner.tabNumber;
            const is3rd = currentSelections?.thirdPref === runner.tabNumber;

            return (
              <div
                key={runner.tabNumber}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  is1st || is2nd || is3rd
                    ? isApple
                      ? "bg-[#F2F7FF] border-[#0071E3] ring-1 ring-[#0071E3]/20"
                      : "bg-[#0E1D2E] border-[#38BDF8] ring-1 ring-[#38BDF8]/25"
                    : isApple
                    ? "bg-[#FAF9FA] border-[#E5E5EA] hover:border-[#D2D2D7]"
                    : "bg-[#141C18] border-[#23352C] hover:border-[#2B3D34]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold w-5">
                      #{runner.tabNumber}
                    </span>
                    <span className="font-semibold text-xs truncate">
                      {runner.horseName}
                    </span>
                    {isFav && (
                      <span className="text-[10px] font-bold text-[#0071E3] dark:text-[#38BDF8] shrink-0">
                        FAV
                      </span>
                    )}
                    {isTopVal && (
                      <span className="text-[10px] font-bold text-[#34C759] dark:text-[#10B981] shrink-0">
                        VAL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#86868B] font-mono mt-0.5">
                    <span>${runner.bookmakerOdds.toFixed(2)}</span>
                    <span className="mx-1">·</span>
                    <span>Edge: {runner.edgePct >= 0 ? `+${runner.edgePct.toFixed(0)}%` : `${runner.edgePct.toFixed(0)}%`}</span>
                    <span className="mx-1">·</span>
                    <span>Rtg {runner.compositeRating}</span>
                  </div>
                </div>

                {/* Preference Buttons */}
                {onAssignPreference && activePunter && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title={`Assign #${runner.tabNumber} as 1st Preference`}
                      onClick={() => onAssignPreference(1, runner.tabNumber)}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        is1st
                          ? "bg-[#0071E3] text-white shadow-xs"
                          : "bg-current/10 hover:bg-current/20 text-current"
                      }`}
                    >
                      1st
                    </button>
                    <button
                      type="button"
                      title={`Assign #${runner.tabNumber} as 2nd Preference`}
                      onClick={() => onAssignPreference(2, runner.tabNumber)}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        is2nd
                          ? "bg-[#34C759] text-white shadow-xs"
                          : "bg-current/10 hover:bg-current/20 text-current"
                      }`}
                    >
                      2nd
                    </button>
                    <button
                      type="button"
                      title={`Assign #${runner.tabNumber} as 3rd Preference`}
                      onClick={() => onAssignPreference(3, runner.tabNumber)}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        is3rd
                          ? "bg-[#FF9500] text-white shadow-xs"
                          : "bg-current/10 hover:bg-current/20 text-current"
                      }`}
                    >
                      3rd
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
