import React, { useState, useMemo } from "react";
import {
  Zap,
  Gauge,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { RaceEvent, RaceRunner, RaceSelectionTrio } from "../types/racing";
import {
  computeRaceSpeedMapAnalysis,
  RunnerSpeedMapProfile,
  SpeedMapPositionGroup,
} from "../utils/speedMapAnalytics";
import { JockeySilkSvg } from "./JockeySilkSvg";

export interface RaceSpeedMapVisualizerProps {
  race: RaceEvent;
  allRacesInMeeting?: RaceEvent[];
  selectedRaceNumber?: number;
  onSelectRaceNumber?: (raceNo: number) => void;
  trackCondition?: string;
  railPosition?: string;
  meetingVenue?: string;
  activeRaceTrio?: RaceSelectionTrio;
  onAssignPreference?: (preferenceRank: 1 | 2 | 3, tabNumber: number) => void;
  isApple?: boolean;
  isObsidian?: boolean;
  compact?: boolean;
  className?: string;
}

export const RaceSpeedMapVisualizer: React.FC<RaceSpeedMapVisualizerProps> = ({
  race,
  allRacesInMeeting = [],
  selectedRaceNumber,
  onSelectRaceNumber,
  trackCondition = "Good 4",
  railPosition = "True",
  meetingVenue = "",
  activeRaceTrio,
  onAssignPreference,
  isApple = false,
  isObsidian = false,
  compact = false,
  className = "",
}) => {
  // State for toggles
  const [viewMode, setViewMode] = useState<"track" | "matrix">(compact ? "track" : "track");
  const [unitMode, setUnitMode] = useState<"kmh" | "l600">("kmh");
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | SpeedMapPositionGroup>("ALL");
  const [isExpanded, setIsExpanded] = useState<boolean>(!compact);

  // Analyze race using career average closing speeds
  const analysis = useMemo(() => {
    return computeRaceSpeedMapAnalysis(race, trackCondition, railPosition);
  }, [race, trackCondition, railPosition]);

  // Theme styling helpers
  const cardBg = isApple
    ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
    : isObsidian
    ? "bg-[#111827] border-[#1E293B] text-[#F1F5F9]"
    : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]";

  const turfTrackBg = isApple
    ? "bg-[#F5F8F5] border-[#D1E7DD]"
    : isObsidian
    ? "bg-[#09101D] border-[#1E293B]"
    : "bg-[#0A140F] border-[#1E3025]";

  const secondaryText = isApple
    ? "text-[#86868B]"
    : isObsidian
    ? "text-[#94A3B8]"
    : "text-[#8A9990]";

  const accentColor = isApple
    ? "text-[#0071E3]"
    : isObsidian
    ? "text-[#38BDF8]"
    : "text-[#D4AF37]";

  // Filtered runners
  const displayedRunners = useMemo(() => {
    if (selectedFilter === "ALL") return analysis.runners;
    return analysis.byGroup[selectedFilter] || [];
  }, [analysis, selectedFilter]);

  // Helper for color badge based on position group
  const getGroupBadgeClass = (group: SpeedMapPositionGroup) => {
    if (group === "Leader") {
      return isApple
        ? "bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/30"
        : "bg-[#FF9500]/15 text-[#F59E0B] border-[#F59E0B]/30";
    }
    if (group === "Stalker") {
      return isApple
        ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30"
        : "bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30";
    }
    // Backmarker
    return isApple
      ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30"
      : "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30";
  };

  const getPaceTempoBadge = () => {
    if (analysis.paceTempo === "Fast Contested Tempo") {
      return {
        label: "FAST CONTESTED TEMPO",
        color: isApple
          ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30"
          : "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 animate-pulse",
        icon: <Flame className="w-3.5 h-3.5 text-current shrink-0" />,
      };
    }
    if (analysis.paceTempo === "Moderate / Sit-Sprint") {
      return {
        label: "MODERATE / SIT-SPRINT",
        color: isApple
          ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30"
          : "bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/40",
        icon: <Gauge className="w-3.5 h-3.5 text-current shrink-0" />,
      };
    }
    return {
      label: "GENUINE EVEN TEMPO",
      color: isApple
        ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30"
        : "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40",
      icon: <Zap className="w-3.5 h-3.5 text-current shrink-0" />,
    };
  };

  const paceBadge = getPaceTempoBadge();

  return (
    <div className={`rounded-xl border transition-all ${cardBg} ${className}`}>
      {/* ====================================================================
          HEADER: TITLE, RACE SELECTOR & CONTROL BAR
         ==================================================================== */}
      <div className="p-4 border-b border-inherit space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SPEED MAP
              </span>
              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                Race {race.raceNumber}: {race.raceName} ({race.distance}m)
              </h3>
              {meetingVenue && (
                <span className={`text-xs ${secondaryText}`}>
                  · {meetingVenue} ({trackCondition})
                </span>
              )}
            </div>
            <p className={`text-xs ${secondaryText}`}>
              Settling positions projected from each runner&apos;s verified career average closing speed (L600m &amp; km/h).
            </p>
          </div>

          {/* Quick Controls: Expand/Collapse & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unit Toggle: km/h vs L600s */}
            <div className={`inline-flex rounded-lg border p-0.5 text-xs font-mono ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
            }`}>
              <button
                type="button"
                onClick={() => setUnitMode("kmh")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  unitMode === "kmh"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#16271E] text-[#10B981] font-bold border border-[#10B981]/40"
                    : `${secondaryText} hover:text-current`
                }`}
                title="Display speed in kilometers per hour"
              >
                km/h
              </button>
              <button
                type="button"
                onClick={() => setUnitMode("l600")}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  unitMode === "l600"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#16271E] text-[#10B981] font-bold border border-[#10B981]/40"
                    : `${secondaryText} hover:text-current`
                }`}
                title="Display sectional in seconds per last 600m"
              >
                L600m (s)
              </button>
            </div>

            {/* View Mode Toggle: Visual Track vs Matrix */}
            <div className={`inline-flex rounded-lg border p-0.5 text-xs ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
            }`}>
              <button
                type="button"
                onClick={() => setViewMode("track")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === "track"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#16271E] text-[#10B981] font-bold border border-[#10B981]/40"
                    : `${secondaryText} hover:text-current`
                }`}
                title="Interactive Visual Track Canvas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Track</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === "matrix"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#16271E] text-[#10B981] font-bold border border-[#10B981]/40"
                    : `${secondaryText} hover:text-current`
                }`}
                title="Speed Matrix Data Table"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Matrix</span>
              </button>
            </div>

            {/* Expand / Collapse Button */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                isApple
                  ? "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0] hover:bg-[#1A2820]"
              }`}
            >
              <span>{isExpanded ? "Collapse" : "Expand Analysis"}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Race Jump Bar (When allRacesInMeeting provided) */}
        {allRacesInMeeting.length > 0 && onSelectRaceNumber && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
            <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold mr-1 shrink-0 ${secondaryText}`}>
              Races:
            </span>
            {allRacesInMeeting.map((r) => {
              const isActive = r.raceNumber === race.raceNumber;
              return (
                <button
                  key={r.raceNumber}
                  type="button"
                  onClick={() => onSelectRaceNumber(r.raceNumber)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? isApple
                        ? "bg-[#0071E3] text-white shadow-xs"
                        : isObsidian
                        ? "bg-[#38BDF8] text-[#09101D] shadow-xs"
                        : "bg-[#D4AF37] text-[#0B110E] shadow-xs"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                      : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
                  }`}
                >
                  R{r.raceNumber} ({r.distance}m)
                </button>
              );
            })}
          </div>
        )}

        {/* Tactical Key Metrics & Tempo Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Metric 1: Pace Tempo */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
          }`}>
            <span className={`text-[10px] font-mono uppercase ${secondaryText}`}>
              Projected Tempo
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${paceBadge.color}`}>
                {paceBadge.icon}
                <span>{paceBadge.label}</span>
              </span>
            </div>
          </div>

          {/* Metric 2: Field Benchmark Closing Speed */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
          }`}>
            <span className={`text-[10px] font-mono uppercase ${secondaryText}`}>
              Benchmark Closing Speed
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-mono text-sm font-bold text-emerald-400">
                {unitMode === "kmh"
                  ? `${analysis.benchmarkFieldClosingSpeedKmH} km/h`
                  : `${analysis.benchmarkL600Sec}s L600m`}
              </span>
              <span className={`text-[10px] ${secondaryText}`}>
                {unitMode === "kmh" ? `(${analysis.benchmarkL600Sec}s)` : `(${analysis.benchmarkFieldClosingSpeedKmH} km/h)`}
              </span>
            </div>
          </div>

          {/* Metric 3: Fastest Closer */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
          }`}>
            <span className={`text-[10px] font-mono uppercase ${secondaryText}`}>
              Fastest Closer
            </span>
            <div className="mt-1 truncate">
              {analysis.fastestCloser ? (
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    #{analysis.fastestCloser.tabNumber}
                  </span>
                  <span className="text-xs font-medium truncate">
                    {analysis.fastestCloser.horseName}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 shrink-0">
                    ({unitMode === "kmh"
                      ? `${analysis.fastestCloser.careerClosingSpeedKmH} km/h`
                      : `${analysis.fastestCloser.closingSpeedL600Sec}s`})
                  </span>
                </div>
              ) : (
                <span className={`text-xs ${secondaryText}`}>-</span>
              )}
            </div>
          </div>

          {/* Metric 4: Position Counts */}
          <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
          }`}>
            <span className={`text-[10px] font-mono uppercase ${secondaryText}`}>
              Position Breakdown
            </span>
            <div className="flex items-center gap-2 mt-1 font-mono text-xs">
              <span className="text-amber-400 font-bold" title="Expected Leaders">
                {analysis.leadersCount}L
              </span>
              <span className={secondaryText}>·</span>
              <span className="text-sky-400 font-bold" title="Expected Stalkers">
                {analysis.stalkersCount}S
              </span>
              <span className={secondaryText}>·</span>
              <span className="text-emerald-400 font-bold" title="Expected Backmarkers">
                {analysis.backmarkersCount}B
              </span>
            </div>
          </div>
        </div>

        {/* Position Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold mr-1 ${secondaryText}`}>
            Filter:
          </span>
          {(
            [
              { id: "ALL", label: `All Runners (${analysis.runners.length})` },
              { id: "Leader", label: `Leaders (${analysis.leadersCount})` },
              { id: "Stalker", label: `Stalkers (${analysis.stalkersCount})` },
              { id: "Backmarker", label: `Backmarkers (${analysis.backmarkersCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                selectedFilter === tab.id
                  ? isApple
                    ? "bg-[#0071E3] text-white font-semibold shadow-xs"
                    : isObsidian
                    ? "bg-[#38BDF8] text-[#09101D] font-bold shadow-xs"
                    : "bg-[#10B981] text-[#0B110E] font-bold shadow-xs"
                  : isApple
                  ? "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                  : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          MAIN SPEED MAP VISUALIZATION: TRACK CANVAS OR DATA MATRIX
         ==================================================================== */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {viewMode === "track" ? (
            /* ================================================================
               VISUAL TURF TRACK CANVAS
               Structured into 3 Longitudinal Strategic Zones:
               [LEADERS: Early Speed] -> [STALKERS: Midfield] -> [BACKMARKERS: Closers]
               Over 3 Lateral Track Lanes: Rail, Two-Wide, Three-Wide
               ================================================================ */
            <div className={`rounded-xl border p-3 sm:p-4 relative overflow-hidden ${turfTrackBg}`}>
              {/* Direction Indicator & Track Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-inherit/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    TURF SETTLING MAP
                  </span>
                  <span className={`text-[11px] ${secondaryText}`}>
                    · Rails: {railPosition} · Track: {trackCondition}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-400 font-semibold">
                  <ArrowRight className="w-3.5 h-3.5 rotate-180 text-amber-400 animate-pulse" />
                  <span>Direction of Race → Heading to Winning Post</span>
                </div>
              </div>

              {/* 3 Strategic Position Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* ZONE 1: LEADERS (Front of Race / Setting Pace) */}
                <div className={`rounded-lg border p-3 flex flex-col justify-between ${
                  isApple ? "bg-white border-[#E5E5EA]" : "bg-[#0B120E] border-[#1F2D26]"
                }`}>
                  <div className="pb-2 mb-2 border-b border-inherit/30 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="font-bold text-xs text-amber-400 uppercase tracking-wide">
                        1. Leaders ({analysis.byGroup.Leader.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400/80">
                      ~56.8–58.8 km/h
                    </span>
                  </div>
                  <p className={`text-[11px] mb-3 leading-snug ${secondaryText}`}>
                    Dominates initial 0–400m; expends energy early; sustains speed to home bend.
                  </p>

                  <div className="space-y-2 flex-1">
                    {analysis.byGroup.Leader.length === 0 ? (
                      <div className={`p-4 text-center text-xs italic ${secondaryText}`}>
                        No declared front-runners. Race tempo likely to be soft or sit-sprint.
                      </div>
                    ) : (
                      analysis.byGroup.Leader.map((runner) => (
                        <RunnerSpeedMapCard
                          key={runner.tabNumber}
                          runner={runner}
                          unitMode={unitMode}
                          isApple={isApple}
                          isObsidian={isObsidian}
                          activeRaceTrio={activeRaceTrio}
                          onAssignPreference={onAssignPreference}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* ZONE 2: STALKERS (Midfield / In-Transit Cover) */}
                <div className={`rounded-lg border p-3 flex flex-col justify-between ${
                  isApple ? "bg-white border-[#E5E5EA]" : "bg-[#0B120E] border-[#1F2D26]"
                }`}>
                  <div className="pb-2 mb-2 border-b border-inherit/30 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      <span className="font-bold text-xs text-sky-400 uppercase tracking-wide">
                        2. Stalkers ({analysis.byGroup.Stalker.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400/80">
                      ~59.0–61.8 km/h
                    </span>
                  </div>
                  <p className={`text-[11px] mb-3 leading-snug ${secondaryText}`}>
                    Positioned 2–4 lengths off pace; enjoys cover; poised for home straight sprint.
                  </p>

                  <div className="space-y-2 flex-1">
                    {analysis.byGroup.Stalker.length === 0 ? (
                      <div className={`p-4 text-center text-xs italic ${secondaryText}`}>
                        No runners classified as stalking.
                      </div>
                    ) : (
                      analysis.byGroup.Stalker.map((runner) => (
                        <RunnerSpeedMapCard
                          key={runner.tabNumber}
                          runner={runner}
                          unitMode={unitMode}
                          isApple={isApple}
                          isObsidian={isObsidian}
                          activeRaceTrio={activeRaceTrio}
                          onAssignPreference={onAssignPreference}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* ZONE 3: BACKMARKERS (Rear of Field / Late Closers) */}
                <div className={`rounded-lg border p-3 flex flex-col justify-between ${
                  isApple ? "bg-white border-[#E5E5EA]" : "bg-[#0B120E] border-[#1F2D26]"
                }`}>
                  <div className="pb-2 mb-2 border-b border-inherit/30 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="font-bold text-xs text-emerald-400 uppercase tracking-wide">
                        3. Backmarkers ({analysis.byGroup.Backmarker.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400/80">
                      ~62.0–64.8 km/h
                    </span>
                  </div>
                  <p className={`text-[11px] mb-3 leading-snug ${secondaryText}`}>
                    Restrained early to save maximum energy; unleashes highest terminal closing speed.
                  </p>

                  <div className="space-y-2 flex-1">
                    {analysis.byGroup.Backmarker.length === 0 ? (
                      <div className={`p-4 text-center text-xs italic ${secondaryText}`}>
                        No pure deep closers identified.
                      </div>
                    ) : (
                      analysis.byGroup.Backmarker.map((runner) => (
                        <RunnerSpeedMapCard
                          key={runner.tabNumber}
                          runner={runner}
                          unitMode={unitMode}
                          isApple={isApple}
                          isObsidian={isObsidian}
                          activeRaceTrio={activeRaceTrio}
                          onAssignPreference={onAssignPreference}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================
               SPEED MATRIX DATA TABLE VIEW
               ================================================================ */
            <div className={`rounded-xl border overflow-x-auto ${
              isApple ? "bg-white border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
            }`}>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className={`border-b font-mono text-[10px] uppercase tracking-wider ${
                    isApple ? "bg-[#F9F9FB] border-[#E5E5EA] text-[#86868B]" : "bg-[#0E1712] border-[#1F2D26] text-[#8A9990]"
                  }`}>
                    <th className="py-2.5 px-3">Runner / Silk</th>
                    <th className="py-2.5 px-2">Barrier</th>
                    <th className="py-2.5 px-2">Position Group</th>
                    <th className="py-2.5 px-2">Settling Lane</th>
                    <th className="py-2.5 px-3 text-right">
                      {unitMode === "kmh" ? "Career Closing Speed" : "Career L600m"}
                    </th>
                    <th className="py-2.5 px-2 text-right">Vs Benchmark</th>
                    <th className="py-2.5 px-2 text-right">Early Pace</th>
                    <th className="py-2.5 px-2 text-right">Speed Rating</th>
                    <th className="py-2.5 px-3 text-right">Fixed Win</th>
                    {onAssignPreference && (
                      <th className="py-2.5 px-3 text-center">Trio Pick</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit/20">
                  {displayedRunners.map((runner) => {
                    const is1st = activeRaceTrio?.firstPref === runner.tabNumber;
                    const is2nd = activeRaceTrio?.secondPref === runner.tabNumber;
                    const is3rd = activeRaceTrio?.thirdPref === runner.tabNumber;

                    return (
                      <tr
                        key={runner.tabNumber}
                        className={`transition-colors hover:bg-current/5 ${
                          is1st
                            ? "bg-amber-500/10"
                            : is2nd
                            ? "bg-emerald-500/10"
                            : is3rd
                            ? "bg-sky-500/10"
                            : ""
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs w-5 text-right">
                              #{runner.tabNumber}
                            </span>
                            <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                              <JockeySilkSvg
                                primary={runner.silkPrimary}
                                secondary={runner.silkSecondary}
                                seed={runner.tabNumber}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold truncate text-xs">
                                {runner.horseName}
                              </div>
                              <div className={`text-[10px] truncate ${secondaryText}`}>
                                {runner.jockey} · {runner.trainer}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-current/10 font-bold">
                            B{runner.barrier}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex px-2 py-0.5 rounded font-mono text-[10px] font-semibold border ${getGroupBadgeClass(runner.positionGroup)}`}>
                            {runner.positionGroup}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-[11px]">
                          {runner.laneLabel}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                          {unitMode === "kmh"
                            ? `${runner.careerClosingSpeedKmH} km/h`
                            : `${runner.closingSpeedL600Sec}s`}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[11px]">
                          <span
                            className={
                              runner.differentialVsBenchmarkKmH >= 0
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {runner.differentialVsBenchmarkKmH >= 0 ? "+" : ""}
                            {runner.differentialVsBenchmarkKmH} km/h
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-[11px]">
                          {runner.earlyPaceRating}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold">
                          {runner.speedRating}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#D4AF37]">
                          ${runner.fixedWin.toFixed(2)}
                        </td>
                        {onAssignPreference && (
                          <td className="py-2 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onAssignPreference(1, runner.tabNumber)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                  is1st
                                    ? "bg-amber-400 text-black"
                                    : "bg-current/10 hover:bg-amber-400/20 text-current"
                                }`}
                              >
                                1st
                              </button>
                              <button
                                type="button"
                                onClick={() => onAssignPreference(2, runner.tabNumber)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                  is2nd
                                    ? "bg-emerald-400 text-black"
                                    : "bg-current/10 hover:bg-emerald-400/20 text-current"
                                }`}
                              >
                                2nd
                              </button>
                              <button
                                type="button"
                                onClick={() => onAssignPreference(3, runner.tabNumber)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                                  is3rd
                                    ? "bg-sky-400 text-black"
                                    : "bg-current/10 hover:bg-sky-400/20 text-current"
                                }`}
                              >
                                3rd
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ====================================================================
              TACTICAL SPEED SCRIPT & TRACK ADVISORY
             ==================================================================== */}
          <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#0E1612] border-[#1F2D26]"
          }`}>
            <div className="flex items-center gap-2 font-bold">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-400 uppercase tracking-wide font-mono text-[11px]">
                Race {race.raceNumber} Tactical Pace Advisory:
              </span>
            </div>
            <p className="leading-relaxed">
              <strong className="text-current font-semibold">{analysis.paceTempoDescription}</strong>{" "}
              <span className={secondaryText}>{analysis.tacticalAdvantageAdvisory}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface RunnerSpeedMapCardProps {
  runner: RunnerSpeedMapProfile;
  unitMode: "kmh" | "l600";
  isApple: boolean;
  isObsidian: boolean;
  activeRaceTrio?: RaceSelectionTrio;
  onAssignPreference?: (preferenceRank: 1 | 2 | 3, tabNumber: number) => void;
}

const RunnerSpeedMapCard: React.FC<RunnerSpeedMapCardProps> = ({
  runner,
  unitMode,
  isApple,
  isObsidian,
  activeRaceTrio,
  onAssignPreference,
}) => {
  const is1st = activeRaceTrio?.firstPref === runner.tabNumber;
  const is2nd = activeRaceTrio?.secondPref === runner.tabNumber;
  const is3rd = activeRaceTrio?.thirdPref === runner.tabNumber;
  const isSelected = is1st || is2nd || is3rd;

  const cardBorder = isSelected
    ? is1st
      ? "border-amber-400 ring-1 ring-amber-400/40"
      : is2nd
      ? "border-emerald-400 ring-1 ring-emerald-400/40"
      : "border-sky-400 ring-1 ring-sky-400/40"
    : isApple
    ? "border-[#E5E5EA]"
    : isObsidian
    ? "border-[#1E293B]"
    : "border-[#1F2D26]";

  const cardBg = isSelected
    ? is1st
      ? "bg-amber-500/10"
      : is2nd
      ? "bg-emerald-500/10"
      : "bg-sky-500/10"
    : isApple
    ? "bg-[#FAF9FA] hover:bg-white"
    : isObsidian
    ? "bg-[#111C2E] hover:bg-[#15233A]"
    : "bg-[#0C1510] hover:bg-[#121F18]";

  const secondaryText = isApple
    ? "text-[#86868B]"
    : isObsidian
    ? "text-[#94A3B8]"
    : "text-[#8A9990]";

  return (
    <div
      className={`rounded-lg border p-2.5 transition-all text-xs flex flex-col justify-between gap-2 ${cardBg} ${cardBorder}`}
    >
      {/* Top Row: Silk, Number, Barrier, Name, Closing Speed */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="w-7 h-7 flex items-center justify-center">
              <JockeySilkSvg
                primary={runner.silkPrimary}
                secondary={runner.silkSecondary}
                seed={runner.tabNumber}
              />
            </div>
            <span className="absolute -bottom-1 -right-1 font-mono text-[9px] font-bold px-1 rounded bg-black/80 text-white border border-white/20">
              B{runner.barrier}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs">
                #{runner.tabNumber}
              </span>
              <span className="font-bold text-xs truncate" title={runner.horseName}>
                {runner.horseName}
              </span>
            </div>
            <div className={`text-[10px] truncate ${secondaryText}`}>
              {runner.jockey} · {runner.subRole}
            </div>
          </div>
        </div>

        {/* Speed Metric */}
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-xs text-emerald-400">
            {unitMode === "kmh"
              ? `${runner.careerClosingSpeedKmH} km/h`
              : `${runner.closingSpeedL600Sec}s`}
          </div>
          <div className={`font-mono text-[9px] ${
            runner.differentialVsBenchmarkKmH >= 0 ? "text-emerald-400" : "text-amber-400"
          }`}>
            {runner.differentialVsBenchmarkKmH >= 0 ? "+" : ""}
            {runner.differentialVsBenchmarkKmH} km/h edge
          </div>
        </div>
      </div>

      {/* Bottom Row: Lane Tag, Fixed Odds & Preference Assign Buttons */}
      <div className="flex items-center justify-between pt-1 border-t border-inherit/30 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono px-1.5 py-0.5 rounded bg-current/10 font-medium ${secondaryText}`}>
            {runner.laneLabel}
          </span>
          <span className="font-mono font-bold text-[#D4AF37]">
            ${runner.fixedWin.toFixed(2)}
          </span>
        </div>

        {onAssignPreference && (
          <div className="flex items-center gap-1 font-mono">
            <button
              type="button"
              onClick={() => onAssignPreference(1, runner.tabNumber)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                is1st
                  ? "bg-amber-400 text-black shadow-xs"
                  : "bg-current/10 hover:bg-amber-400/30 text-current"
              }`}
              title="Set as 1st Preference"
            >
              1st
            </button>
            <button
              type="button"
              onClick={() => onAssignPreference(2, runner.tabNumber)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                is2nd
                  ? "bg-emerald-400 text-black shadow-xs"
                  : "bg-current/10 hover:bg-emerald-400/30 text-current"
              }`}
              title="Set as 2nd Preference"
            >
              2nd
            </button>
            <button
              type="button"
              onClick={() => onAssignPreference(3, runner.tabNumber)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                is3rd
                  ? "bg-sky-400 text-black shadow-xs"
                  : "bg-current/10 hover:bg-sky-400/30 text-current"
              }`}
              title="Set as 3rd Preference"
            >
              3rd
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
