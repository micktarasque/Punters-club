import React, { useMemo, useState } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Info,
  Layers,
  LayoutGrid,
  List,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { RaceEvent, RaceRunner } from "../types/racing";
import {
  CombinedRaceTrifectaEvaluation,
  CustomTrifectaRaceConfig,
  TrifectaBetType,
  computeCustomTrifectaCombinations,
  computeTabFlexiBetMetrics,
  formatDollarReturn,
} from "../utils/scoring";
import { JockeySilkSvg } from "./JockeySilkSvg";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";

export interface InteractiveTrifectaCustomiserProps {
  race: RaceEvent;
  meetingVenue: string;
  meetingState?: string;
  evalData: CombinedRaceTrifectaEvaluation;
  activeStake: number;
  initialConfig?: CustomTrifectaRaceConfig;
  onApplyConfig: (config: CustomTrifectaRaceConfig | null) => void;
  onClose: () => void;
}

export const InteractiveTrifectaCustomiser: React.FC<
  InteractiveTrifectaCustomiserProps
> = ({
  race,
  meetingVenue,
  meetingState,
  evalData,
  activeStake,
  initialConfig,
  onApplyConfig,
  onClose,
}) => {
  // Sort non-scratched runners by odds (lowest to highest)
  const sortedRunners = useMemo(() => {
    return [...race.runners]
      .filter((r) => !r.isScratched)
      .sort((a, b) => {
        const oddsA = Number(a.fixedWin || a.nswTabWin) || 999;
        const oddsB = Number(b.fixedWin || b.nswTabWin) || 999;
        if (oddsA !== oddsB) return oddsA - oddsB;
        return a.tabNumber - b.tabNumber;
      });
  }, [race.runners]);

  // Sub-$1.90 favourite in the field
  const sub19Fav = useMemo(() => {
    return sortedRunners.find((r) => {
      const win = Number(r.fixedWin || r.nswTabWin);
      return Number.isFinite(win) && win > 0 && win < 1.9;
    });
  }, [sortedRunners]);

  // Mode state
  const [mode, setMode] = useState<TrifectaBetType>(() => {
    if (initialConfig?.mode) return initialConfig.mode;
    return evalData.betType || "flexi_standout";
  });

  // Standout position state (1, 2, or 3)
  const [standoutPosition, setStandoutPosition] = useState<1 | 2 | 3>(() => {
    if (initialConfig?.standoutPosition) return initialConfig.standoutPosition;
    return evalData.standoutPosition || 1;
  });

  // Standout runner tabNumber
  const [standoutTab, setStandoutTab] = useState<number>(() => {
    if (initialConfig?.standoutTab) return initialConfig.standoutTab;
    if (evalData.standoutRunner?.tabNumber) return evalData.standoutRunner.tabNumber;
    if (sub19Fav?.tabNumber) return sub19Fav.tabNumber;
    return sortedRunners[0]?.tabNumber || 1;
  });

  // Flexi 2nd & 3rd selections (for Standout mode)
  const [standoutFlexiOthers, setStandoutFlexiOthers] = useState<number[]>(() => {
    if (initialConfig?.secondPicks && initialConfig.secondPicks.length > 0) {
      return initialConfig.secondPicks;
    }
    if (evalData.positionPicks.second && evalData.positionPicks.second.length > 0) {
      return evalData.positionPicks.second.filter(
        (t) => t !== (evalData.standoutRunner?.tabNumber || standoutTab)
      );
    }
    const otherTabs = evalData.combinedRunners
      .map((c) => c.tabNumber)
      .filter((t) => t !== standoutTab);
    return otherTabs.length >= 2
      ? otherTabs
      : sortedRunners.map((r) => r.tabNumber).filter((t) => t !== standoutTab).slice(0, 2);
  });

  // Position-by-Position picks (Multiple mode)
  const [firstPicks, setFirstPicks] = useState<number[]>(() => {
    if (initialConfig?.firstPicks && initialConfig.firstPicks.length > 0) {
      return initialConfig.firstPicks;
    }
    if (evalData.positionPicks.first && evalData.positionPicks.first.length > 0) {
      return evalData.positionPicks.first;
    }
    return [sortedRunners[0]?.tabNumber || 1];
  });

  const [secondPicks, setSecondPicks] = useState<number[]>(() => {
    if (initialConfig?.secondPicks && initialConfig.secondPicks.length > 0) {
      return initialConfig.secondPicks;
    }
    if (evalData.positionPicks.second && evalData.positionPicks.second.length > 0) {
      return evalData.positionPicks.second;
    }
    return sortedRunners.slice(1, 3).map((r) => r.tabNumber);
  });

  const [thirdPicks, setThirdPicks] = useState<number[]>(() => {
    if (initialConfig?.thirdPicks && initialConfig.thirdPicks.length > 0) {
      return initialConfig.thirdPicks;
    }
    if (evalData.positionPicks.third && evalData.positionPicks.third.length > 0) {
      return evalData.positionPicks.third;
    }
    return sortedRunners.slice(1, 4).map((r) => r.tabNumber);
  });

  // Boxed selections
  const [boxedTabs, setBoxedTabs] = useState<number[]>(() => {
    if (initialConfig?.mode === "flexi_boxed" && initialConfig.firstPicks) {
      return initialConfig.firstPicks;
    }
    if (evalData.combinedRunners.length >= 3) {
      return evalData.combinedRunners.map((c) => c.tabNumber);
    }
    return sortedRunners.slice(0, 4).map((r) => r.tabNumber);
  });

  // Stake state
  const [betStake, setBetStake] = useState<number>(() => {
    if (initialConfig?.customStake && initialConfig.customStake > 0) {
      return initialConfig.customStake;
    }
    return activeStake || 20;
  });

  // Compact Grid vs Detailed List layout
  const [layoutView, setLayoutView] = useState<"grid" | "list">("grid");

  // Toggle helper for arrays
  const toggleInArray = (arr: number[], val: number): number[] => {
    if (arr.includes(val)) {
      return arr.filter((x) => x !== val);
    }
    return [...arr, val];
  };

  // Compute live combinations based on active mode
  const liveCombinations = useMemo(() => {
    let p1: number[] = [];
    let p2: number[] = [];
    let p3: number[] = [];

    if (mode === "flexi_standout") {
      p1 = [standoutTab];
      p2 = standoutFlexiOthers.filter((t) => t !== standoutTab);
      p3 = standoutFlexiOthers.filter((t) => t !== standoutTab);
    } else if (mode === "standout_placing") {
      const others = standoutFlexiOthers.filter((t) => t !== standoutTab);
      if (standoutPosition === 1) {
        p1 = [standoutTab];
        p2 = others;
        p3 = others;
      } else if (standoutPosition === 2) {
        p1 = others;
        p2 = [standoutTab];
        p3 = others;
      } else {
        p1 = others;
        p2 = others;
        p3 = [standoutTab];
      }
    } else if (mode === "flexi_positions") {
      p1 = firstPicks;
      p2 = secondPicks;
      p3 = thirdPicks;
    } else if (mode === "flexi_boxed") {
      p1 = boxedTabs;
      p2 = boxedTabs;
      p3 = boxedTabs;
    } else if (mode === "roving_banker") {
      const others = standoutFlexiOthers.filter((t) => t !== standoutTab);
      p1 = [standoutTab, ...others];
      p2 = [standoutTab, ...others];
      p3 = [standoutTab, ...others];
    }

    let res = computeCustomTrifectaCombinations(p1, p2, p3);

    if (mode === "roving_banker") {
      const filtered = res.combinationsList.filter(
        ([r1, r2, r3]) =>
          r1 === standoutTab || r2 === standoutTab || r3 === standoutTab
      );
      res = {
        combinationsCount: filtered.length,
        combinationsList: filtered,
      };
    }

    return {
      p1,
      p2,
      p3,
      count: res.combinationsCount,
      list: res.combinationsList,
    };
  }, [
    mode,
    standoutPosition,
    standoutTab,
    standoutFlexiOthers,
    firstPicks,
    secondPicks,
    thirdPicks,
    boxedTabs,
  ]);

  // Live flexi metrics
  const liveFlexiMetrics = useMemo(() => {
    return computeTabFlexiBetMetrics(
      1,
      betStake,
      Math.max(1, liveCombinations.count)
    );
  }, [betStake, liveCombinations.count]);

  // Check if live combinations hit official results
  const liveHit = useMemo(() => {
    if (!evalData.isRaceResulted) return false;
    const f1 = evalData.officialPodium.first?.tabNumber;
    const f2 = evalData.officialPodium.second?.tabNumber;
    const f3 = evalData.officialPodium.third?.tabNumber;
    if (!f1 || !f2 || !f3) return false;
    return liveCombinations.list.some(
      ([r1, r2, r3]) => r1 === f1 && r2 === f2 && r3 === f3
    );
  }, [evalData.isRaceResulted, evalData.officialPodium, liveCombinations.list]);

  // Quick preset buttons for stake
  const PRESET_STAKES = [5, 10, 20, 50, 100];

  // Quick preset: Apply sub-$1.90 standout
  const applySub19Preset = () => {
    if (!sub19Fav) return;
    setMode("flexi_standout");
    setStandoutPosition(1);
    setStandoutTab(sub19Fav.tabNumber);
    const others = evalData.combinedRunners
      .map((c) => c.tabNumber)
      .filter((t) => t !== sub19Fav.tabNumber);
    const safeOthers =
      others.length >= 2
        ? others
        : sortedRunners.map((r) => r.tabNumber).filter((t) => t !== sub19Fav.tabNumber).slice(0, 2);
    setStandoutFlexiOthers(safeOthers);
  };

  // Quick preset: Restore consensus top picks
  const applyConsensusPreset = () => {
    const topTab =
      evalData.combinedRunners[0]?.tabNumber || sortedRunners[0]?.tabNumber || 1;
    setMode("flexi_standout");
    setStandoutPosition(1);
    setStandoutTab(topTab);
    const others = evalData.combinedRunners
      .map((c) => c.tabNumber)
      .filter((t) => t !== topTab);
    const safeOthers =
      others.length >= 2
        ? others
        : sortedRunners.map((r) => r.tabNumber).filter((t) => t !== topTab).slice(0, 2);
    setStandoutFlexiOthers(safeOthers);
  };

  const handleSave = () => {
    const config: CustomTrifectaRaceConfig = {
      mode,
      standoutTab,
      standoutPosition,
      firstPicks:
        mode === "flexi_positions"
          ? firstPicks
          : mode === "flexi_boxed"
          ? boxedTabs
          : [standoutTab],
      secondPicks:
        mode === "flexi_positions" ? secondPicks : standoutFlexiOthers,
      thirdPicks:
        mode === "flexi_positions" ? thirdPicks : standoutFlexiOthers,
      customStake: betStake,
    };
    onApplyConfig(config);
    onClose();
  };

  const handleResetToDefault = () => {
    onApplyConfig(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in"
    >
      <div className="relative w-full max-w-4xl bg-[#0E1612] border border-[#23352C] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Header: TAB / Sportsbet styling */}
        <div className="p-4 sm:p-5 border-b border-[#1F2D26] bg-[#0A100D] flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#10B981] text-[#0B110E] font-mono text-[10px] font-bold uppercase tracking-wider">
                {meetingState || "TAB"} · R{race.raceNumber}
              </span>
              <span className="text-xs font-mono text-[#D4AF37] font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {race.startTime} · {race.distance}m
              </span>
              {evalData.isRaceResulted && (
                <span className="px-2 py-0.5 rounded bg-[#152920] border border-[#10B981] text-[#10B981] font-mono text-[10px] font-bold">
                  OFFICIAL RESULT
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#F3F4F0] mt-1 flex items-center gap-2">
              <span>
                {meetingVenue} R{race.raceNumber} — {race.raceName}
              </span>
            </h2>
            <p className="text-xs text-[#8A9990] mt-0.5">
              Customise your Syndicate Trifecta: choose standout anchors,
              position-by-position flexi, or boxed combinations.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#14201A] hover:bg-[#1E3027] text-[#8A9990] hover:text-[#F3F4F0] border border-[#23352C] cursor-pointer transition-colors"
            title="Close Customiser"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-$1.90 Standout Favourite Notification Banner */}
        {sub19Fav && (
          <div className="px-4 py-2.5 bg-[#122A1E] border-b border-[#10B981]/40 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-[#10B981]">
              <Zap className="w-4 h-4 shrink-0 text-[#10B981]" />
              <span>
                <strong>Sub-$1.90 Favourite Detected:</strong> #{sub19Fav.tabNumber}{" "}
                {sub19Fav.horseName} is paying{" "}
                <strong className="text-[#D4AF37]">
                  ${(Number(sub19Fav.fixedWin || sub19Fav.nswTabWin) || 0).toFixed(2)}
                </strong>
                . System automatically locks this runner as Standout 1st.
              </span>
            </div>
            <button
              type="button"
              onClick={applySub19Preset}
              className="px-2.5 py-1 rounded bg-[#10B981] text-[#0B110E] font-mono font-bold text-[11px] hover:bg-[#0EA271] cursor-pointer shrink-0 transition-colors"
            >
              Apply # {sub19Fav.tabNumber} Standout
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 grow">
          {/* Bet Structure Mode Switcher Tabs */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-[#8A9990] mb-2 font-semibold">
              Select Trifecta Bet Structure (Sportsbet &amp; TAB Standard):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("flexi_standout");
                  setStandoutPosition(1);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "flexi_standout"
                    ? "bg-[#152B20] border-[#10B981] text-[#F3F4F0] shadow-md shadow-[#10B981]/10"
                    : "bg-[#101814] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#10B981]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Standout 1st</span>
                </div>
                <div className="text-[11px] text-[#8A9990] mt-0.5">
                  1st Anchor + Flexi 2nd/3rd
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("standout_placing");
                  if (standoutPosition === 1) setStandoutPosition(2);
                }}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "standout_placing"
                    ? "bg-[#152B20] border-[#10B981] text-[#F3F4F0] shadow-md shadow-[#10B981]/10"
                    : "bg-[#101814] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#D4AF37]">
                  <Award className="w-3.5 h-3.5" />
                  <span>Standout Place</span>
                </div>
                <div className="text-[11px] text-[#8A9990] mt-0.5">
                  Standout in 2nd or 3rd
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("flexi_positions")}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "flexi_positions"
                    ? "bg-[#152B20] border-[#10B981] text-[#F3F4F0] shadow-md shadow-[#10B981]/10"
                    : "bg-[#101814] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#38BDF8]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Flexi Multiple</span>
                </div>
                <div className="text-[11px] text-[#8A9990] mt-0.5">
                  Positions 1st / 2nd / 3rd
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("flexi_boxed")}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "flexi_boxed"
                    ? "bg-[#152B20] border-[#10B981] text-[#F3F4F0] shadow-md shadow-[#10B981]/10"
                    : "bg-[#101814] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#F59E0B]">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Boxed Flexi</span>
                </div>
                <div className="text-[11px] text-[#8A9990] mt-0.5">
                  Any 3 to finish 1-2-3
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("roving_banker")}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mode === "roving_banker"
                    ? "bg-[#152B20] border-[#10B981] text-[#F3F4F0] shadow-md shadow-[#10B981]/10"
                    : "bg-[#101814] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#EC4899]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Roving Banker</span>
                </div>
                <div className="text-[11px] text-[#8A9990] mt-0.5">
                  Banker in top 3 spots
                </div>
              </button>
            </div>
          </div>

          {/* Standout Position Sub-Selector (when Standout Placing is active) */}
          {mode === "standout_placing" && (
            <div className="p-3 rounded-xl bg-[#121A16] border border-[#23352C] flex items-center justify-between gap-3">
              <span className="text-xs text-[#F3F4F0] font-semibold">
                Nominate which position #{standoutTab} must finish:
              </span>
              <div className="flex items-center gap-2">
                {[
                  { pos: 1 as const, label: "1st Place" },
                  { pos: 2 as const, label: "2nd Place" },
                  { pos: 3 as const, label: "3rd Place" },
                ].map(({ pos, label }) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setStandoutPosition(pos)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                      standoutPosition === pos
                        ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                        : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26] hover:text-[#F3F4F0]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Runner Selection Module (Compact Grid UI with Tactile Buttons) */}
          <div className="border border-[#1F2D26] rounded-xl overflow-hidden bg-[#0A100D]">
            <div className="px-3.5 py-2.5 bg-[#0F1713] border-b border-[#1F2D26] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#8A9990]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#F3F4F0]">
                  Runner Selections ({sortedRunners.length} Horses)
                </span>
                <span className="text-[11px] text-[#8A9990] hidden sm:inline">
                  · {mode === "flexi_standout" ? "Standout 1st + Flexi 2nd & 3rd" : mode.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Layout Switcher (Grid vs List) */}
                <div className="flex items-center bg-[#070B09] border border-[#1F2D26] rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => setLayoutView("grid")}
                    className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                      layoutView === "grid"
                        ? "bg-[#10B981] text-[#070B09] font-bold"
                        : "text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                    title="Compact Grid View (Tactile Buttons)"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Compact Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayoutView("list")}
                    className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                      layoutView === "list"
                        ? "bg-[#10B981] text-[#070B09] font-bold"
                        : "text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                    title="Detailed List View"
                  >
                    <List className="w-3 h-3" />
                    <span>List</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={applyConsensusPreset}
                  className="text-[11px] text-[#10B981] hover:underline cursor-pointer ml-1"
                >
                  ⚡ Reset to Syndicate Picks
                </button>
              </div>
            </div>

            {/* View A: Compact Grid UI with Tactile Buttons */}
            {layoutView === "grid" ? (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {sortedRunners.map((runner) => {
                  const odds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                  const isStandout = standoutTab === runner.tabNumber;
                  const isInStandoutOthers = standoutFlexiOthers.includes(runner.tabNumber);
                  const isSub19 = odds > 0 && odds < 1.9;

                  // Multiple mode picks
                  const in1st = firstPicks.includes(runner.tabNumber);
                  const in2nd = secondPicks.includes(runner.tabNumber);
                  const in3rd = thirdPicks.includes(runner.tabNumber);

                  // Boxed mode
                  const isBoxed = boxedTabs.includes(runner.tabNumber);

                  return (
                    <div
                      key={runner.tabNumber}
                      className={`p-2.5 rounded-lg border transition-all ${
                        isStandout && (mode === "flexi_standout" || mode === "standout_placing" || mode === "roving_banker")
                          ? "bg-[#14261C] border-[#10B981]"
                          : isInStandoutOthers && (mode === "flexi_standout" || mode === "standout_placing")
                          ? "bg-[#0E1A14] border-[#10B981]/50"
                          : isBoxed && mode === "flexi_boxed"
                          ? "bg-[#1A180E] border-[#D4AF37]"
                          : (in1st || in2nd || in3rd) && mode === "flexi_positions"
                          ? "bg-[#0E1A14] border-[#10B981]/60"
                          : "bg-[#0C1410] border-[#1B2A22] hover:border-[#273E31]"
                      }`}
                    >
                      {/* Compact Header: Tab #, Horse Name, Live Odds */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded bg-[#D4AF37] text-[#0B110E] font-mono font-bold flex items-center justify-center text-xs shrink-0 shadow">
                            {runner.tabNumber}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#F3F4F0] block truncate" title={runner.horseName}>
                              {runner.horseName}
                            </span>
                          </div>
                        </div>

                        {/* Essential Live Odds */}
                        <div className="shrink-0 text-right font-mono">
                          <span className={`text-xs font-bold ${isSub19 ? "text-[#10B981]" : "text-[#D4AF37]"}`}>
                            ${odds > 0 ? odds.toFixed(2) : "-"}
                          </span>
                        </div>
                      </div>

                      {/* Tactile Control Buttons depending on Mode */}
                      <div className="pt-1 border-t border-[#18261E]">
                        {/* Standout 1st or Standout Placing or Roving Banker Mode */}
                        {(mode === "flexi_standout" || mode === "standout_placing" || mode === "roving_banker") && (
                          <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setStandoutTab(runner.tabNumber);
                                setStandoutFlexiOthers((prev) => prev.filter((t) => t !== runner.tabNumber));
                              }}
                              className={`py-1.5 px-1 rounded text-center font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                                isStandout
                                  ? "bg-[#10B981] text-[#070B09] shadow"
                                  : "bg-[#111C16] text-[#8A9990] hover:text-[#10B981] border border-[#203328]"
                              }`}
                            >
                              <span>{isStandout ? "★ Standout" : "Standout"}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isStandout}
                              onClick={() => setStandoutFlexiOthers((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`py-1.5 px-1 rounded text-center font-bold text-[11px] transition-colors cursor-pointer ${
                                isStandout
                                  ? "opacity-30 cursor-not-allowed text-[#8A9990] bg-[#111C16]"
                                  : isInStandoutOthers
                                  ? "bg-[#1D3326] text-[#10B981] border border-[#10B981]"
                                  : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] border border-[#203328]"
                              }`}
                            >
                              {isInStandoutOthers ? "✓ Flexi" : "+ Flexi"}
                            </button>
                          </div>
                        )}

                        {/* Flexi Positions (Multiple) Mode: [1st] [2nd] [3rd] Tactile Buttons */}
                        {mode === "flexi_positions" && (
                          <div className="grid grid-cols-3 gap-1 font-mono text-xs">
                            <button
                              type="button"
                              onClick={() => setFirstPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`py-1 rounded text-center font-bold text-[11px] cursor-pointer transition-colors ${
                                in1st
                                  ? "bg-[#10B981] text-[#070B09]"
                                  : "bg-[#111C16] text-[#8A9990] hover:text-[#10B981] border border-[#203328]"
                              }`}
                            >
                              1st
                            </button>
                            <button
                              type="button"
                              onClick={() => setSecondPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`py-1 rounded text-center font-bold text-[11px] cursor-pointer transition-colors ${
                                in2nd
                                  ? "bg-[#D4AF37] text-[#070B09]"
                                  : "bg-[#111C16] text-[#8A9990] hover:text-[#D4AF37] border border-[#203328]"
                              }`}
                            >
                              2nd
                            </button>
                            <button
                              type="button"
                              onClick={() => setThirdPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`py-1 rounded text-center font-bold text-[11px] cursor-pointer transition-colors ${
                                in3rd
                                  ? "bg-[#38BDF8] text-[#070B09]"
                                  : "bg-[#111C16] text-[#8A9990] hover:text-[#38BDF8] border border-[#203328]"
                              }`}
                            >
                              3rd
                            </button>
                          </div>
                        )}

                        {/* Boxed Flexi Mode */}
                        {mode === "flexi_boxed" && (
                          <button
                            type="button"
                            onClick={() => setBoxedTabs((prev) => toggleInArray(prev, runner.tabNumber))}
                            className={`w-full py-1.5 rounded font-mono font-bold text-xs cursor-pointer transition-colors ${
                              isBoxed
                                ? "bg-[#D4AF37] text-[#070B09]"
                                : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] border border-[#203328]"
                            }`}
                          >
                            {isBoxed ? "✓ In Boxed Trifecta" : "+ Add to Boxed"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* View B: Detailed List View */
              <div className="divide-y divide-[#1F2D26]">
                {sortedRunners.map((runner) => {
                  const odds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                  const isStandout = standoutTab === runner.tabNumber;
                  const isInStandoutOthers = standoutFlexiOthers.includes(runner.tabNumber);
                  const isSub19 = odds > 0 && odds < 1.9;

                  const in1st = firstPicks.includes(runner.tabNumber);
                  const in2nd = secondPicks.includes(runner.tabNumber);
                  const in3rd = thirdPicks.includes(runner.tabNumber);
                  const isBoxed = boxedTabs.includes(runner.tabNumber);

                  return (
                    <div
                      key={runner.tabNumber}
                      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isStandout && (mode === "flexi_standout" || mode === "standout_placing" || mode === "roving_banker")
                          ? "bg-[#162B20]/60"
                          : "hover:bg-[#121A16]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div className="w-7 h-7 rounded-lg bg-[#D4AF37] text-[#0B110E] font-mono font-bold flex items-center justify-center text-sm shadow shrink-0">
                          {runner.tabNumber}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#F3F4F0]">
                              {runner.horseName}
                            </span>
                            <span className="text-[11px] font-mono text-[#8A9990]">
                              (B{runner.barrier || 1})
                            </span>
                            {isSub19 && (
                              <span className="px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-mono text-[9px] font-bold">
                                SUB-$1.90
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#8A9990]">
                            {runner.jockey || "Jockey"} · {runner.trainer || "Trainer"}
                          </div>
                        </div>

                        <div className="ml-auto sm:ml-2 font-mono text-xs">
                          <TactileOddsFlucBadge currentOdds={odds > 0 ? odds : undefined} size="sm" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {(mode === "flexi_standout" || mode === "standout_placing" || mode === "roving_banker") && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setStandoutTab(runner.tabNumber);
                                setStandoutFlexiOthers((prev) => prev.filter((t) => t !== runner.tabNumber));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors flex items-center gap-1.5 ${
                                isStandout
                                  ? "bg-[#10B981] text-[#070B09] border-[#10B981]"
                                  : "bg-[#121A16] text-[#D5DDD8] border-[#23352C] hover:border-[#10B981]"
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>{isStandout ? `★ Standout` : "Make Standout"}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isStandout}
                              onClick={() => setStandoutFlexiOthers((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                                isStandout
                                  ? "opacity-30 cursor-not-allowed border-[#1F2D26] text-[#8A9990]"
                                  : isInStandoutOthers
                                  ? "bg-[#1D3326] text-[#10B981] border-[#10B981]"
                                  : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26] hover:text-[#F3F4F0]"
                              }`}
                            >
                              {isInStandoutOthers ? "✓ Flexi Leg" : "+ Add to Flexi"}
                            </button>
                          </div>
                        )}

                        {mode === "flexi_positions" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setFirstPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`w-12 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                                in1st ? "bg-[#10B981] text-[#070B09] border-[#10B981]" : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26]"
                              }`}
                            >
                              1st
                            </button>
                            <button
                              type="button"
                              onClick={() => setSecondPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`w-12 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                                in2nd ? "bg-[#D4AF37] text-[#070B09] border-[#D4AF37]" : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26]"
                              }`}
                            >
                              2nd
                            </button>
                            <button
                              type="button"
                              onClick={() => setThirdPicks((prev) => toggleInArray(prev, runner.tabNumber))}
                              className={`w-12 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                                in3rd ? "bg-[#38BDF8] text-[#070B09] border-[#38BDF8]" : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26]"
                              }`}
                            >
                              3rd
                            </button>
                          </div>
                        )}

                        {mode === "flexi_boxed" && (
                          <button
                            type="button"
                            onClick={() => setBoxedTabs((prev) => toggleInArray(prev, runner.tabNumber))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer transition-colors ${
                              isBoxed ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]" : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26]"
                            }`}
                          >
                            {isBoxed ? "✓ In Boxed Pool" : "+ Box Horse"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Live Bet Slip Summary Footer (Sticky) */}
        <div className="p-4 sm:p-5 border-t border-[#1F2D26] bg-[#0A100D] shrink-0 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Stake Input & Preset Buttons */}
            <div className="sm:col-span-5 space-y-1.5">
              <label className="block text-[11px] font-mono uppercase text-[#8A9990]">
                Syndicate Bet Stake:
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {PRESET_STAKES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBetStake(s)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold border cursor-pointer transition-colors ${
                      betStake === s
                        ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                        : "bg-[#121A16] text-[#D5DDD8] border-[#1F2D26] hover:border-[#D4AF37]"
                    }`}
                  >
                    ${s}
                  </button>
                ))}
                <div className="flex items-center gap-1 bg-[#121A16] border border-[#23352C] rounded px-2 py-0.5">
                  <span className="text-xs font-mono text-[#8A9990]">$</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={betStake}
                    onChange={(e) => setBetStake(Math.max(1, Number(e.target.value)))}
                    className="w-16 bg-transparent text-xs font-mono font-bold text-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Calculations: Combos, Flexi %, and Payout */}
            <div className="sm:col-span-7 flex flex-wrap items-center justify-between sm:justify-end gap-4 p-2.5 rounded-xl bg-[#121A16] border border-[#23352C] font-mono text-xs">
              <div>
                <div className="text-[10px] uppercase text-[#8A9990]">
                  Combinations
                </div>
                <div className="text-sm font-bold text-[#F3F4F0]">
                  {liveCombinations.count} Combos
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#8A9990]">
                  Flexi %
                </div>
                <div className="text-sm font-bold text-[#10B981]">
                  {liveCombinations.count > 0
                    ? `${liveFlexiMetrics.flexiPercentage}%`
                    : "0%"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#8A9990]">
                  Est. $1 Tote Div
                </div>
                <div className="text-sm font-bold text-[#D4AF37]">
                  {formatDollarReturn(evalData.estimatedUpcomingTrifectaDividend)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-[#8A9990]">
                  Est. Payout on ${betStake}
                </div>
                <div className="text-sm font-bold text-[#10B981]">
                  {liveCombinations.count > 0
                    ? formatDollarReturn(
                        (liveFlexiMetrics.flexiPercentage / 100) *
                          evalData.estimatedUpcomingTrifectaDividend
                      )
                    : "$0.00"}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Apply, Reset, Cancel */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-xs font-mono text-[#8A9990]">
              {mode === "flexi_standout" && (
                <span>
                  Anchor #{standoutTab} 1st · {standoutFlexiOthers.length} Runners
                  Flexi for 2nd &amp; 3rd ({liveCombinations.count} Combos)
                </span>
              )}
              {mode === "standout_placing" && (
                <span>
                  Anchor #{standoutTab} in {standoutPosition}
                  {standoutPosition === 1 ? "st" : standoutPosition === 2 ? "nd" : "rd"}{" "}
                  · {standoutFlexiOthers.length} Runners Flexi (
                  {liveCombinations.count} Combos)
                </span>
              )}
              {mode === "flexi_positions" && (
                <span>
                  1st: {firstPicks.length}H · 2nd: {secondPicks.length}H · 3rd:{" "}
                  {thirdPicks.length}H ({liveCombinations.count} Combos)
                </span>
              )}
              {mode === "flexi_boxed" && (
                <span>
                  Boxed: {boxedTabs.length} Horses ({liveCombinations.count} Combos)
                </span>
              )}
              {mode === "roving_banker" && (
                <span>
                  Roving Banker #{standoutTab} ({liveCombinations.count} Combos)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#14201A] hover:bg-[#1E3027] text-[#8A9990] hover:text-[#F3F4F0] border border-[#23352C] font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Reset Default
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#14201A] hover:bg-[#1E3027] text-[#8A9990] hover:text-[#F3F4F0] border border-[#23352C] font-mono text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={liveCombinations.count === 0}
                onClick={handleSave}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-lg ${
                  liveCombinations.count > 0
                    ? "bg-[#10B981] hover:bg-[#0EA271] text-[#0B110E] shadow-[#10B981]/20"
                    : "bg-[#1E3027] text-[#8A9990] cursor-not-allowed border border-[#23352C]"
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Apply Custom Trifecta ({liveCombinations.count} C)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
