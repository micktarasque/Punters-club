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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B110E]/95 backdrop-blur-md border-t border-[#1F2D26] shadow-2xl transition-all"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Left: Active Race Context & Stepper */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-[#121A16] border border-[#1F2D26] rounded-lg p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={activeRaceNumber <= 1}
              className="p-1 rounded text-[#8A9990] hover:text-[#F3F4F0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Race"
              aria-label="Previous Race"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-bold text-[#F3F4F0] px-1.5 tabular-nums">
              R{activeRaceNumber}
              <span className="text-[10px] text-[#8A9990] font-normal">
                /{totalRaces}
              </span>
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={activeRaceNumber >= totalRaces}
              className="p-1 rounded text-[#8A9990] hover:text-[#F3F4F0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Next Race"
              aria-label="Next Race"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden md:flex flex-col text-left">
            <span className="text-[11px] font-mono text-[#D4AF37] font-semibold truncate max-w-[130px]">
              {meeting.venue} R{activeRaceNumber}
            </span>
            <span className="text-[10px] text-[#8A9990] font-mono">
              {completedRacesCount}/{totalRaces} Card Locked
            </span>
          </div>

          {/* Joker Toggle */}
          <button
            type="button"
            onClick={onToggleJoker}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer border ${
              isJokerActive
                ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                : "bg-[#121A16] text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15"
            }`}
            title="Double points if your 1st Preference horse wins"
          >
            {isJokerActive ? "🃏 Joker 2× Active" : "🃏 Play Joker (2×)"}
          </button>
        </div>

        {/* Center: Selected Preference Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-center py-0.5">
          {/* 1st Preference */}
          <div
            className={`px-2.5 py-1 rounded-md border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner1
                ? "bg-[#262010] border-[#D4AF37] text-[#F3F4F0]"
                : "bg-[#121A16] border-[#1F2D26] text-[#8A9990] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-[#0B110E] font-bold text-[10px] flex items-center justify-center shrink-0">
              1
            </span>
            {runner1 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner1.tabNumber} {runner1.horseName}
              </span>
            ) : (
              <span className="italic text-[11px]">1st Pref (3pts)</span>
            )}
          </div>

          {/* 2nd Preference */}
          <div
            className={`px-2.5 py-1 rounded-md border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner2
                ? "bg-[#1E2522] border-slate-300 text-[#F3F4F0]"
                : "bg-[#121A16] border-[#1F2D26] text-[#8A9990] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-slate-200 text-[#0B110E] font-bold text-[10px] flex items-center justify-center shrink-0">
              2
            </span>
            {runner2 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner2.tabNumber} {runner2.horseName}
              </span>
            ) : (
              <span className="italic text-[11px]">2nd Pref (2pts)</span>
            )}
          </div>

          {/* 3rd Preference */}
          <div
            className={`px-2.5 py-1 rounded-md border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
              runner3
                ? "bg-[#122219] border-[#10B981] text-[#F3F4F0]"
                : "bg-[#121A16] border-[#1F2D26] text-[#8A9990] border-dashed"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#10B981] text-[#0B110E] font-bold text-[10px] flex items-center justify-center shrink-0">
              3
            </span>
            {runner3 ? (
              <span className="truncate max-w-[110px] font-semibold">
                #{runner3.tabNumber} {runner3.horseName}
              </span>
            ) : (
              <span className="italic text-[11px]">3rd Pref (1pt)</span>
            )}
          </div>
        </div>

        {/* Right: Smart Strategy Auto-Pick & Action */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => onApplyStrategy("market-consensus")}
              className="px-2 py-1 rounded bg-[#121A16] border border-[#1F2D26] text-[#8A9990] hover:text-[#D4AF37] hover:border-[#D4AF37] transition cursor-pointer"
              title="Auto pick top 3 market favourites in order"
            >
              Consensus
            </button>
            <button
              type="button"
              onClick={() => onApplyStrategy("value-hunter")}
              className="px-2 py-1 rounded bg-[#121A16] border border-[#1F2D26] text-[#8A9990] hover:text-[#10B981] hover:border-[#10B981] transition cursor-pointer"
              title="Auto pick sweet-spot value contenders ($3.50-$12)"
            >
              Value
            </button>
            <button
              type="button"
              onClick={() => onApplyStrategy("front-runner")}
              className="px-2 py-1 rounded bg-[#121A16] border border-[#1F2D26] text-[#8A9990] hover:text-[#38BDF8] hover:border-[#38BDF8] transition cursor-pointer"
              title="Auto pick low barrier on-pace runners"
            >
              Speed
            </button>
          </div>

          <button
            type="button"
            onClick={() => onApplyStrategy("balanced")}
            className="px-2.5 py-1 rounded-md bg-[#192620] border border-[#10B981]/50 text-[#10B981] text-xs font-mono font-bold hover:bg-[#10B981]/20 transition cursor-pointer inline-flex items-center gap-1"
            title="Randomly pick 1 top-3 favourite + 2 other runners"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Pick</span>
          </button>

          {(runner1 || runner2 || runner3) && (
            <button
              type="button"
              onClick={onClearActiveRace}
              className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#EF4444] transition cursor-pointer"
              title="Clear selections for this race"
            >
              Clear
            </button>
          )}

          {isComplete && activeRaceNumber < totalRaces && (
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1 rounded-md bg-[#D4AF37] text-[#0B110E] text-xs font-mono font-bold hover:bg-[#e0bc46] transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isComplete && activeRaceNumber === totalRaces && onNavigateToResults && (
            <button
              type="button"
              onClick={onNavigateToResults}
              className="px-3 py-1 rounded-md bg-emerald-600 text-[#0B110E] text-xs font-mono font-bold hover:bg-emerald-500 transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
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
