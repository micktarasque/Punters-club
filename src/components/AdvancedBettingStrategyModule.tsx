import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  SlidersHorizontal,
  Zap,
  Target,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  Plus,
  RefreshCw,
  Info,
  Clock,
  Compass,
} from "lucide-react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import {
  analyzeRaceBettingStrategy,
  analyzeTrackAndRail,
  DEFAULT_STRATEGY_FILTERS,
  RunnerStrategyAnalysis,
  StrategyFilterConfig,
  ValueGrade,
} from "../utils/bettingStrategyEngine";
import { JockeySilkSvg } from "./JockeySilkSvg";

interface AdvancedBettingStrategyModuleProps {
  meetings: RaceMeeting[];
  activePunter?: PunterProfile;
  onSetPunterPreference?: (
    meetingId: string,
    raceNumber: number,
    rank: 1 | 2 | 3,
    tabNumber: number
  ) => void;
  onOpenTrifectaCustomiser?: (meeting: RaceMeeting, race: RaceEvent) => void;
  onRefreshScraperData?: () => void;
  isRefreshing?: boolean;
}

export const AdvancedBettingStrategyModule: React.FC<
  AdvancedBettingStrategyModuleProps
> = ({
  meetings,
  activePunter,
  onSetPunterPreference,
  onOpenTrifectaCustomiser,
  onRefreshScraperData,
  isRefreshing = false,
}) => {
  // Active selected meeting and race
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    meetings[0]?.id || ""
  );

  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  }, [meetings, selectedMeetingId]);

  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number>(() => {
    return activeMeeting?.races[0]?.raceNumber || 1;
  });

  const activeRace = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return null;
    return (
      activeMeeting.races.find((r) => r.raceNumber === selectedRaceNumber) ||
      activeMeeting.races[0]
    );
  }, [activeMeeting, selectedRaceNumber]);

  // Filters state
  const [filters, setFilters] =
    useState<StrategyFilterConfig>(DEFAULT_STRATEGY_FILTERS);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectedRunnerDetail, setSelectedRunnerDetail] =
    useState<RunnerStrategyAnalysis | null>(null);

  // Track & Rail Analysis
  const trackAnalysis = useMemo(() => {
    if (!activeMeeting) return null;
    return analyzeTrackAndRail(activeMeeting, activeRace || undefined);
  }, [activeMeeting, activeRace]);

  // Strategy Analysis for the active race
  const raceAnalyses = useMemo(() => {
    if (!activeRace || !activeMeeting) return [];
    return analyzeRaceBettingStrategy(activeRace, activeMeeting);
  }, [activeRace, activeMeeting]);

  // Filtered analyses
  const filteredRunners = useMemo(() => {
    return raceAnalyses.filter((r) => {
      if (r.edgePct < filters.minEdgePct) return false;
      if (r.bookmakerOdds < filters.minOdds || r.bookmakerOdds > filters.maxOdds)
        return false;
      if (r.jockeyStats.winRatePct < filters.minJockeyWinPct) return false;

      if (filters.trackConditionFilter !== "ALL") {
        const cond = (
          activeMeeting?.trackRating ||
          activeMeeting?.trackCondition ||
          ""
        ).toLowerCase();
        const isWet = cond.includes("soft") || cond.includes("heavy");
        if (filters.trackConditionFilter === "GOOD" && isWet) return false;
        if (filters.trackConditionFilter === "SOFT_HEAVY" && !isWet) return false;
      }

      if (filters.speedMapFilter !== "ALL") {
        if (
          filters.speedMapFilter === "LEADERS_ON_PACE" &&
          r.speedMapPosition !== "Leader" &&
          r.speedMapPosition !== "On Pace"
        ) {
          return false;
        }
        if (
          filters.speedMapFilter === "MIDFIELD" &&
          r.speedMapPosition !== "Midfield"
        ) {
          return false;
        }
        if (
          filters.speedMapFilter === "BACKMARKERS" &&
          r.speedMapPosition !== "Backmarker"
        ) {
          return false;
        }
      }

      return true;
    });
  }, [raceAnalyses, filters, activeMeeting]);

  // Value bet count
  const strongValueCount = useMemo(() => {
    return raceAnalyses.filter((r) => r.valueGrade === "STRONG_VALUE").length;
  }, [raceAnalyses]);

  // Helper for applying filter presets
  const applyPreset = (presetName: string) => {
    if (presetName === "OVERLAYS") {
      setFilters({
        ...DEFAULT_STRATEGY_FILTERS,
        minEdgePct: 12,
        minOdds: 2.2,
      });
    } else if (presetName === "LEADERS") {
      setFilters({
        ...DEFAULT_STRATEGY_FILTERS,
        minEdgePct: 0,
        speedMapFilter: "LEADERS_ON_PACE",
      });
    } else if (presetName === "WET") {
      setFilters({
        ...DEFAULT_STRATEGY_FILTERS,
        trackConditionFilter: "SOFT_HEAVY",
      });
    } else if (presetName === "JOCKEYS") {
      setFilters({
        ...DEFAULT_STRATEGY_FILTERS,
        minJockeyWinPct: 16,
      });
    } else {
      setFilters(DEFAULT_STRATEGY_FILTERS);
    }
  };

  // Check if runner is currently in punter's trio
  const getPunterPreferenceRank = (tab: number): 1 | 2 | 3 | null => {
    if (!activePunter || !activeMeeting || !activeRace) return null;
    const trio =
      activePunter.selectionsByMeeting?.[activeMeeting.id]?.[
        activeRace.raceNumber
      ];
    if (!trio) return null;
    if (trio.firstPref === tab) return 1;
    if (trio.secondPref === tab) return 2;
    if (trio.thirdPref === tab) return 3;
    return null;
  };

  if (!meetings.length || !activeMeeting) {
    return (
      <div className="p-8 text-center text-[#8A9990] font-mono">
        No active Australian race meetings loaded. Please run the NSW TAB scraper.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Meeting Selection Bar */}
      <div className="bg-[#0A120E] border border-[#18261E] rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#8A9990] font-mono">
              <span className="text-[#D4AF37] font-semibold">
                QUANTITATIVE STRATEGY LAB
              </span>
              <span aria-hidden="true">·</span>
              <span>NSW TAB Grounded</span>
              <span aria-hidden="true">·</span>
              <span>Plackett-Luce Fair Value Engine</span>
            </div>
            <h2 className="text-lg font-bold text-[#F3F4F0] mt-0.5">
              Advanced Betting Strategy & Value Finder
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                showFilterDrawer
                  ? "bg-[#10B981] text-[#070B09] border-[#10B981]"
                  : "bg-[#111C16] text-[#D5DDD8] border-[#203328] hover:border-[#10B981]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Custom Strategy Filters</span>
              {filters.minEdgePct > 0 && (
                <span className="px-1.5 py-0.2 bg-[#070B09]/40 rounded text-[10px]">
                  +{filters.minEdgePct}% EV
                </span>
              )}
            </button>

            {onRefreshScraperData && (
              <button
                type="button"
                onClick={onRefreshScraperData}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-lg text-xs font-mono bg-[#111C16] text-[#D5DDD8] border border-[#203328] hover:border-[#10B981] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#10B981] ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">Refresh TAB Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Meeting Selector Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {meetings.map((m) => {
            const isSel = m.id === activeMeeting.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMeetingId(m.id);
                  setSelectedRaceNumber(m.races[0]?.raceNumber || 1);
                }}
                className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isSel
                    ? "bg-[#10B981] text-[#070B09] shadow"
                    : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
                }`}
              >
                {m.venue} ({m.state})
                <span className="ml-1.5 text-[10px] opacity-80">
                  {m.trackRating || m.trackCondition || "Good"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Race Selector Pill Bar */}
        {activeMeeting && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[#18261E]">
            <span className="text-[11px] font-mono text-[#8A9990] mr-1 shrink-0">
              Races:
            </span>
            {activeMeeting.races.map((r) => {
              const isSel = r.raceNumber === activeRace?.raceNumber;
              return (
                <button
                  key={r.raceNumber}
                  type="button"
                  onClick={() => setSelectedRaceNumber(r.raceNumber)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 ${
                    isSel
                      ? "bg-[#D4AF37] text-[#070B09]"
                      : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#18261E]"
                  }`}
                >
                  R{r.raceNumber}
                  <span className="ml-1 text-[10px] font-normal opacity-75">
                    {r.distance}m
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Drawer & Quick Presets */}
      {showFilterDrawer && (
        <div className="bg-[#0D1612] border border-[#203328] rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#D4AF37]">
              STRATEGY CRITERIA & OVERLAY THRESHOLDS
            </span>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_STRATEGY_FILTERS)}
              className="text-[11px] font-mono text-[#8A9990] hover:text-[#10B981] cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#8A9990] font-mono mr-1">
              Quick Strategies:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("OVERLAYS")}
              className="px-2.5 py-1 rounded bg-[#13221A] text-[#10B981] border border-[#1A3326] text-xs font-mono hover:bg-[#1A3326] cursor-pointer"
            >
              ⚡ High Value Overlays (+12% EV)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("LEADERS")}
              className="px-2.5 py-1 rounded bg-[#13221A] text-[#38BDF8] border border-[#1A3326] text-xs font-mono hover:bg-[#1A3326] cursor-pointer"
            >
              🏁 On-Pace Speed Map Leaders
            </button>
            <button
              type="button"
              onClick={() => applyPreset("WET")}
              className="px-2.5 py-1 rounded bg-[#13221A] text-[#A78BFA] border border-[#1A3326] text-xs font-mono hover:bg-[#1A3326] cursor-pointer"
            >
              🌧️ Wet Track Specialists
            </button>
            <button
              type="button"
              onClick={() => applyPreset("JOCKEYS")}
              className="px-2.5 py-1 rounded bg-[#13221A] text-[#FBBF24] border border-[#1A3326] text-xs font-mono hover:bg-[#1A3326] cursor-pointer"
            >
              👑 Elite Jockeys (16%+ Win)
            </button>
          </div>

          {/* Interactive Sliders and Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <div className="flex justify-between text-[#8A9990] mb-1">
                <span>Minimum Expected Value (+EV):</span>
                <span className="text-[#10B981] font-bold">
                  +{filters.minEdgePct}%
                </span>
              </div>
              <input
                type="range"
                min="-20"
                max="40"
                step="2"
                value={filters.minEdgePct}
                onChange={(e) =>
                  setFilters({ ...filters, minEdgePct: Number(e.target.value) })
                }
                className="w-full accent-[#10B981]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#8A9990] mb-1">
                <span>Max Odds Limit:</span>
                <span className="text-[#F3F4F0] font-bold">
                  ${filters.maxOdds.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="50"
                step="2"
                value={filters.maxOdds}
                onChange={(e) =>
                  setFilters({ ...filters, maxOdds: Number(e.target.value) })
                }
                className="w-full accent-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#8A9990] mb-1">
                <span>Min Jockey Win Rate:</span>
                <span className="text-[#F3F4F0] font-bold">
                  {filters.minJockeyWinPct}%
                </span>
              </div>
              <input
                type="range"
                min="8"
                max="22"
                step="1"
                value={filters.minJockeyWinPct}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    minJockeyWinPct: Number(e.target.value),
                  })
                }
                className="w-full accent-[#38BDF8]"
              />
            </div>

            <div>
              <span className="text-[#8A9990] block mb-1">
                Speed Map Filter:
              </span>
              <select
                value={filters.speedMapFilter}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    speedMapFilter: e.target.value as any,
                  })
                }
                className="w-full bg-[#111C16] border border-[#203328] rounded px-2.5 py-1 text-[#F3F4F0] text-xs font-mono"
              >
                <option value="ALL">All Running Styles</option>
                <option value="LEADERS_ON_PACE">Leaders & On Pace</option>
                <option value="MIDFIELD">Midfield Only</option>
                <option value="BACKMARKERS">Backmarkers / Swoopers</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Track & Bias Intelligence Panel */}
      {trackAnalysis && activeRace && (
        <div className="bg-[#0A120E] border border-[#18261E] rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[11px] font-mono text-[#8A9990] block">
              RACE & DISTANCE
            </span>
            <div className="font-bold text-[#F3F4F0] text-sm">
              R{activeRace.raceNumber} · {activeRace.raceName}
            </div>
            <div className="text-[11px] text-[#8A9990] mt-0.5">
              {activeRace.distance}m · {activeRace.classGrade} · Jump:{" "}
              {activeRace.startTime}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-mono text-[#8A9990] block">
              TRACK CONDITION & RAIL BIAS
            </span>
            <div className="text-[#D4AF37] font-semibold">
              {trackAnalysis.trackCondition} · Rail {trackAnalysis.railPosition}
            </div>
            <div className="text-[11px] text-[#8A9990] mt-0.5">
              {trackAnalysis.railBiasNote}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-mono text-[#8A9990] block">
              PACE TEMPO & BARRIER SWEET SPOT
            </span>
            <div className="text-[#10B981] font-semibold flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>
                {trackAnalysis.paceScenario === "FAST_LEAD_FAVOURED"
                  ? "Fast Tempo · Front-Runners Favoured"
                  : trackAnalysis.paceScenario === "SLOW_SIT_AND_SPRINT"
                  ? "Slow Tempo · Tactical Sprint Home"
                  : "Even Pace · Balanced Surface"}
              </span>
            </div>
            <div className="text-[11px] text-[#8A9990] mt-0.5">
              Preferred: {trackAnalysis.preferredBarrierBand}
            </div>
          </div>
        </div>
      )}

      {/* Value Bet Summary Kicker */}
      <div className="flex items-center justify-between text-xs font-mono text-[#8A9990] px-1">
        <div>
          Showing{" "}
          <span className="text-[#F3F4F0] font-bold">
            {filteredRunners.length}
          </span>{" "}
          of {raceAnalyses.length} runners matching criteria ·{" "}
          <span className="text-[#10B981] font-semibold">
            {strongValueCount} Strong Value (+EV) Opportunities
          </span>
        </div>

        {activeRace && onOpenTrifectaCustomiser && (
          <button
            type="button"
            onClick={() => onOpenTrifectaCustomiser(activeMeeting, activeRace)}
            className="text-[#10B981] hover:underline cursor-pointer flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Open Syndicate Trifecta Customiser</span>
          </button>
        )}
      </div>

      {/* Strategy Table & Compact Tactile Cards */}
      <div className="space-y-2">
        {filteredRunners.length === 0 ? (
          <div className="bg-[#0A120E] border border-[#18261E] rounded-xl p-8 text-center text-xs font-mono text-[#8A9990]">
            No runners currently meet the selected strategy filter threshold (+
            {filters.minEdgePct}% EV). Try relaxing the minimum overlay filter.
          </div>
        ) : (
          filteredRunners.map((item) => {
            const punterRank = getPunterPreferenceRank(item.tabNumber);
            const isSub19 = item.bookmakerOdds < 1.9;

            return (
              <div
                key={item.tabNumber}
                className={`bg-[#0A120E] border rounded-xl p-3 transition-colors ${
                  item.valueGrade === "STRONG_VALUE"
                    ? "border-[#10B981]/50 bg-[#0C1711]"
                    : item.isTopPick
                    ? "border-[#D4AF37]/40 bg-[#121913]"
                    : "border-[#18261E] hover:border-[#22382B]"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left: Tab #, Silks, Name, Jockey, Form */}
                  <div className="flex items-center gap-3 min-w-[260px]">
                    <div
                      className={`w-8 h-8 rounded-lg font-mono font-bold text-sm flex items-center justify-center shrink-0 shadow ${
                        item.isTopPick
                          ? "bg-[#D4AF37] text-[#070B09]"
                          : "bg-[#111C16] text-[#F3F4F0] border border-[#22382B]"
                      }`}
                    >
                      {item.tabNumber}
                    </div>

                    <div className="shrink-0 w-6 h-6">
                      <JockeySilkSvg
                        seed={item.tabNumber}
                        primary={item.tabNumber % 2 === 0 ? "#10B981" : "#D4AF37"}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F3F4F0] text-sm">
                          {item.horseName}
                        </span>
                        <span className="text-[11px] font-mono text-[#8A9990]">
                          (B{item.barrier})
                        </span>
                        {item.isTopPick && (
                          <span className="text-[10px] font-mono font-bold text-[#D4AF37]">
                            ★ TOP POWER RATING
                          </span>
                        )}
                        {isSub19 && (
                          <span className="text-[10px] font-mono font-bold text-[#10B981]">
                            ⚡ SUB-$1.90 FAV
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#8A9990]">
                        <span>{item.jockey}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>{item.trainer}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>Form: {item.form}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[#38BDF8]">
                          {item.speedMapPosition}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Quantitative Odds Equation & Expected Value */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#8A9990] block">
                        BOOKMAKER ODDS
                      </span>
                      <span className="font-bold text-sm text-[#F3F4F0]">
                        ${item.bookmakerOdds.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#8A9990] block">
                        Implied {item.impliedProbPct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#8A9990] block">
                        MODEL FAIR ODDS
                      </span>
                      <span className="font-bold text-sm text-[#D4AF37]">
                        ${item.modelFairOdds.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#8A9990] block">
                        Model {item.modelWinProbPct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#8A9990] block">
                        EXPECTED VALUE (+EV)
                      </span>
                      <span
                        className={`font-bold text-sm ${
                          item.edgePct > 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}
                      >
                        {item.edgePct > 0 ? `+${item.edgePct}%` : `${item.edgePct}%`}
                      </span>
                      <span className="text-[10px] text-[#8A9990] block">
                        {item.valueGrade === "STRONG_VALUE"
                          ? "Strong Overlay"
                          : item.valueGrade === "MODERATE_VALUE"
                          ? "Moderate Value"
                          : item.valueGrade === "FAIR"
                          ? "Fair Market"
                          : "Under The Odds"}
                      </span>
                    </div>

                    {item.recommendedKellyStakePct > 0 && (
                      <div className="hidden sm:block">
                        <span className="text-[10px] text-[#8A9990] block">
                          KELLY RECOM.
                        </span>
                        <span className="font-bold text-xs text-[#38BDF8]">
                          {item.recommendedKellyStakePct}% Bank
                        </span>
                        <span className="text-[10px] text-[#8A9990] block">
                          Quarter-Kelly
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Tactile Selection Buttons (1st, 2nd, 3rd) & Detail Toggle */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {onSetPunterPreference && activeMeeting && activeRace && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onSetPunterPreference(
                              activeMeeting.id,
                              activeRace.raceNumber,
                              1,
                              item.tabNumber
                            )
                          }
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            punterRank === 1
                              ? "bg-[#D4AF37] text-[#070B09] ring-2 ring-[#D4AF37]"
                              : "bg-[#111C16] text-[#8A9990] hover:text-[#D4AF37] border border-[#22382B]"
                          }`}
                          title="Set as 1st Preference"
                        >
                          1
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onSetPunterPreference(
                              activeMeeting.id,
                              activeRace.raceNumber,
                              2,
                              item.tabNumber
                            )
                          }
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            punterRank === 2
                              ? "bg-[#10B981] text-[#070B09] ring-2 ring-[#10B981]"
                              : "bg-[#111C16] text-[#8A9990] hover:text-[#10B981] border border-[#22382B]"
                          }`}
                          title="Set as 2nd Preference"
                        >
                          2
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onSetPunterPreference(
                              activeMeeting.id,
                              activeRace.raceNumber,
                              3,
                              item.tabNumber
                            )
                          }
                          className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            punterRank === 3
                              ? "bg-[#38BDF8] text-[#070B09] ring-2 ring-[#38BDF8]"
                              : "bg-[#111C16] text-[#8A9990] hover:text-[#38BDF8] border border-[#22382B]"
                          }`}
                          title="Set as 3rd Preference"
                        >
                          3
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRunnerDetail(
                          selectedRunnerDetail?.tabNumber === item.tabNumber
                            ? null
                            : item
                        )
                      }
                      className="px-2.5 py-1.5 rounded bg-[#111C16] hover:bg-[#18261E] border border-[#22382B] text-xs font-mono text-[#D5DDD8] flex items-center gap-1 cursor-pointer"
                    >
                      <span>Analysis</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          selectedRunnerDetail?.tabNumber === item.tabNumber
                            ? "rotate-90"
                            : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Qualitative Breakdown */}
                {selectedRunnerDetail?.tabNumber === item.tabNumber && (
                  <div className="mt-3 pt-3 border-t border-[#18261E] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="space-y-1">
                      <span className="text-[#8A9990] block text-[10px]">
                        JOCKEY INTEL
                      </span>
                      <div className="text-[#F3F4F0]">
                        {item.jockeyStats.name} ({item.jockeyStats.ratingTier})
                      </div>
                      <div className="text-[11px] text-[#8A9990]">
                        Career: {item.jockeyStats.winRatePct}% · Last 30d:{" "}
                        {item.jockeyStats.last30DaysWinPct}% · ROI:{" "}
                        {item.jockeyStats.roiIndex}x
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#8A9990] block text-[10px]">
                        SPEED & TRACK METRICS
                      </span>
                      <div className="text-[#F3F4F0]">
                        Speed Map: {item.speedMapPosition} · Rating:{" "}
                        {item.speedRating}/100
                      </div>
                      <div className="text-[11px] text-[#8A9990]">
                        Form Score: {item.formScore} · Track/Dist:{" "}
                        {item.trackDistScore} · Freshness: {item.freshnessScore}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#8A9990] block text-[10px]">
                        KEY STRATEGY ANGLES
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {item.keyAngles.map((angle, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-[#111C16] border border-[#203328] text-[#10B981] px-1.5 py-0.5 rounded"
                          >
                            {angle}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
