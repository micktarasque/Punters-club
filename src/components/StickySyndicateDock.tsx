import React from "react";
import {
  RaceEvent,
  RaceRunner,
  RaceSelectionTrio,
  RaceMeeting,
} from "../types/racing";
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import { AutoPickStrategy } from "../utils/autoPick";

interface StickySyndicateDockProps {
  meeting: RaceMeeting;
  activeRace: RaceEvent;
  activeRaceNumber: number;
  totalRaces: number;
  completedRacesCount: number;
  activeTrio: RaceSelectionTrio | undefined;
  isJokerActive: boolean;
  activePunterName: string;
  onSelectRaceNumber: (raceNo: number) => void;
  onToggleJoker: () => void;
  onApplyStrategy: (strategy: AutoPickStrategy) => void;
  onClearActiveRace: () => void;
  onNavigateToResults?: () => void;
}

export const StickySyndicateDock: React.FC<StickySyndicateDockProps> = ({
  meeting,
  activeRace,
  activeRaceNumber,
  totalRaces,
  completedRacesCount,
  activeTrio,
  isJokerActive,
  activePunterName,
  onSelectRaceNumber,
  onToggleJoker,
  onApplyStrategy,
  onClearActiveRace,
  onNavigateToResults,
}) => {
  const getRunner = (tabNo: number | null): RaceRunner | undefined => {
    if (!tabNo) return undefined;
    return activeRace.runners.find((r) => r.tabNumber === tabNo);
  };

  const runner1 = getRunner(activeTrio?.firstPref ?? null);
  const runner2 = getRunner(activeTrio?.secondPref ?? null);
  const runner3 = getRunner(activeTrio?.thirdPref ?? null);

  const isComplete = Boolean(
    activeTrio?.firstPref && activeTrio?.secondPref && activeTrio?.thirdPref
  );

  const handlePrev = () => {
    if (activeRaceNumber > 1) {
      onSelectRaceNumber(activeRaceNumber - 1);
    }
  };

  const handleNext = () => {
    if (activeRaceNumber < totalRaces) {
      onSelectRaceNumber(activeRaceNumber + 1);
    }
  };

  return (
    <div
      role="region"
      aria-label="Active Race Syndicate Selection Dock"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-md border-t border-[#E5E5EA] shadow-lg transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Active Race Context & Stepper */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-[#F2F2F7] border border-[#E5E5EA] rounded-full p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={activeRaceNumber <= 1}
              className="p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Race"
              aria-label="Previous Race"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-semibold text-[#1D1D1F] px-2 tabular-nums">
              R{activeRaceNumber}
              <span className="text-[10px] text-[#86868B] font-normal">
                /{totalRaces}
              </span>
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={activeRaceNumber >= totalRaces}
              className="p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Next Race"
              aria-label="Next Race"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-[#1D1D1F] truncate max-w-[130px]">
              {meeting.venue} R{activeRaceNumber}
            </span>
            <span className="text-[10px] text-[#86868B] font-mono">
              {completedRacesCount}/{totalRaces} Tipped
            </span>
          </div>

          {/* Joker Toggle */}
          <button
            type="button"
            onClick={onToggleJoker}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer border ${
              isJokerActive
                ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                : "bg-white text-[#FF9500] border-[#FF9500]/40 hover:bg-[#FFF5E6]"
            }`}
            title="Double points if your selections win"
          >
            {isJokerActive ? "🃏 Joker 2× Active" : "🃏 Play Joker"}
          </button>
        </div>

        {/* Center: Selected Preference Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto justify-center py-0.5">
          {/* 1st Preference */}
          <div
            className={`px-3 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner1
                ? "bg-[#FFF5E6] border-[#FF9500]/40 text-[#1D1D1F]"
                : "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#FF9500] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              1
            </span>
            {runner1 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner1.tabNumber} {runner1.horseName}
              </span>
            ) : (
              <span className="text-[11px] text-[#86868B]">1st (3pts)</span>
            )}
          </div>

          {/* 2nd Preference */}
          <div
            className={`px-3 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner2
                ? "bg-[#EBF5FF] border-[#0071E3]/40 text-[#1D1D1F]"
                : "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#0071E3] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              2
            </span>
            {runner2 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner2.tabNumber} {runner2.horseName}
              </span>
            ) : (
              <span className="text-[11px] text-[#86868B]">2nd (2pts)</span>
            )}
          </div>

          {/* 3rd Preference */}
          <div
            className={`px-3 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner3
                ? "bg-[#EAFBF0] border-[#34C759]/40 text-[#1D1D1F]"
                : "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#34C759] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              3
            </span>
            {runner3 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner3.tabNumber} {runner3.horseName}
              </span>
            ) : (
              <span className="text-[11px] text-[#86868B]">3rd (1pt)</span>
            )}
          </div>
        </div>

        {/* Right: Smart Strategy Auto-Pick & Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => onApplyStrategy("market-consensus")}
              className="px-2.5 py-1 rounded-full bg-white border border-[#E5E5EA] text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3] transition cursor-pointer"
              title="Auto pick top 3 market favourites in order"
            >
              Consensus
            </button>
            <button
              type="button"
              onClick={() => onApplyStrategy("value-hunter")}
              className="px-2.5 py-1 rounded-full bg-white border border-[#E5E5EA] text-[#86868B] hover:text-[#34C759] hover:border-[#34C759] transition cursor-pointer"
              title="Auto pick sweet-spot value contenders"
            >
              Value
            </button>
            <button
              type="button"
              onClick={() => onApplyStrategy("front-runner")}
              className="px-2.5 py-1 rounded-full bg-white border border-[#E5E5EA] text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3] transition cursor-pointer"
              title="Auto pick on-pace runners"
            >
              Speed
            </button>
          </div>

          <button
            type="button"
            onClick={() => onApplyStrategy("balanced")}
            className="px-3 py-1 rounded-full bg-[#EBF5FF] border border-[#0071E3]/20 text-[#0071E3] text-xs font-medium hover:bg-[#D6EBFF] transition cursor-pointer inline-flex items-center gap-1.5"
            title="Auto pick consensus trio"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Pick</span>
          </button>

          {(runner1 || runner2 || runner3) && (
            <button
              type="button"
              onClick={onClearActiveRace}
              className="px-2.5 py-1 rounded-full text-xs font-mono text-[#86868B] hover:text-[#FF3B30] transition cursor-pointer"
              title="Clear selections for this race"
            >
              Clear
            </button>
          )}

          {isComplete && activeRaceNumber < totalRaces && (
            <button
              type="button"
              onClick={handleNext}
              className="apple-btn-primary"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isComplete && activeRaceNumber === totalRaces && onNavigateToResults && (
            <button
              type="button"
              onClick={onNavigateToResults}
              className="px-3.5 py-1.5 rounded-full bg-[#34C759] text-white text-xs font-semibold hover:bg-[#2EB84E] transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Results →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
