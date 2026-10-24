import React, { useState, useEffect } from "react";
import {
  RaceEvent,
  RaceRunner,
  RaceSelectionTrio,
  RaceMeeting,
} from "../types/racing";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Check,
  Star,
  Zap,
  Keyboard,
  X,
  Info,
} from "lucide-react";
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
  allMeetingSelections?: Record<number, RaceSelectionTrio>;
  jokerRaceNumber?: number | null;
  autoAdvanceEnabled?: boolean;
  onToggleAutoAdvance?: () => void;
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
  allMeetingSelections = {},
  jokerRaceNumber,
  autoAdvanceEnabled = true,
  onToggleAutoAdvance,
  onSelectRaceNumber,
  onToggleJoker,
  onApplyStrategy,
  onClearActiveRace,
  onNavigateToResults,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Global Keyboard Shortcuts for Race Navigation and Quick Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input, textarea, or select field
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "[" || (e.key === "ArrowLeft" && e.altKey)) {
        e.preventDefault();
        if (activeRaceNumber > 1) {
          onSelectRaceNumber(activeRaceNumber - 1);
        }
      } else if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) {
        e.preventDefault();
        if (activeRaceNumber < totalRaces) {
          onSelectRaceNumber(activeRaceNumber + 1);
        }
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        onToggleJoker();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        onApplyStrategy("balanced");
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        onClearActiveRace();
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key === "Escape") {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeRaceNumber,
    totalRaces,
    onSelectRaceNumber,
    onToggleJoker,
    onApplyStrategy,
    onClearActiveRace,
    showShortcutsModal,
  ]);

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
    <>
      <div
        role="region"
        aria-label="Active Race Syndicate Selection Dock"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0E1813]/90 backdrop-blur-md border-t border-[#E5E5EA] dark:border-[#23352C] shadow-xl transition-all"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 space-y-2">
          {/* Top Tier: Sticky Race Jump Track (R1..R10) with Real-Time Status & Shortcuts */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono font-semibold text-[#86868B] dark:text-[#9BA8A1] uppercase tracking-wider hidden sm:inline mr-1">
                Jump To:
              </span>
              <div className="flex items-center gap-1">
                {meeting.races.map((r) => {
                  const rNo = r.raceNumber;
                  const trio = allMeetingSelections[rNo];
                  const picksCount =
                    (trio?.firstPref ? 1 : 0) +
                    (trio?.secondPref ? 1 : 0) +
                    (trio?.thirdPref ? 1 : 0);
                  const isCur = rNo === activeRaceNumber;
                  const isRaceJoker = jokerRaceNumber === rNo;
                  const isDone = picksCount === 3;
                  const isPartial = picksCount > 0 && picksCount < 3;

                  return (
                    <button
                      key={rNo}
                      type="button"
                      onClick={() => onSelectRaceNumber(rNo)}
                      title={`Race ${rNo} (${picksCount}/3 picks)${isRaceJoker ? " · 🃏 Joker Active" : ""}`}
                      className={`relative min-w-[34px] sm:min-w-[40px] h-7 sm:h-8 px-1.5 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        isCur
                          ? "bg-[#0071E3] dark:bg-[#10B981] text-white shadow-sm ring-2 ring-[#0071E3]/40 dark:ring-[#10B981]/40 scale-105 z-10"
                          : isDone
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                          : isPartial
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                          : "bg-[#F2F2F7] dark:bg-[#16221C] text-[#86868B] dark:text-[#8A9990] border border-[#E5E5EA] dark:border-[#23352C] hover:bg-[#E5E5EA] dark:hover:bg-[#1E2E25]"
                      }`}
                    >
                      <span>R{rNo}</span>
                      {isDone && !isCur && (
                        <Check className="w-2.5 h-2.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                      )}
                      {isPartial && !isCur && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      )}
                      {isRaceJoker && (
                        <span
                          title="Joker 2× Points Race"
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center text-[8px] font-bold shadow-xs"
                        >
                          ★
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Status & Workflow Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Auto-Advance Toggle */}
              {onToggleAutoAdvance && (
                <button
                  type="button"
                  onClick={onToggleAutoAdvance}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition cursor-pointer border ${
                    autoAdvanceEnabled
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-[#F2F2F7] dark:bg-[#16221C] text-[#86868B] dark:text-[#8A9990] border-[#E5E5EA] dark:border-[#23352C]"
                  }`}
                  title={
                    autoAdvanceEnabled
                      ? "Auto-advance ON: Moves to next race when 3rd pick is set"
                      : "Auto-advance OFF: Click to automatically advance upon 3rd pick"
                  }
                >
                  <Zap
                    className={`w-3 h-3 ${
                      autoAdvanceEnabled ? "text-emerald-500" : "text-[#86868B]"
                    }`}
                  />
                  <span>
                    Auto-Advance:{" "}
                    <strong>{autoAdvanceEnabled ? "ON" : "OFF"}</strong>
                  </span>
                </button>
              )}

              {/* Keyboard Shortcuts Hint Button */}
              <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono text-[#86868B] dark:text-[#8A9990] hover:text-[#1D1D1F] dark:hover:text-[#F3F4F0] border border-[#E5E5EA] dark:border-[#23352C] bg-[#F2F2F7] dark:bg-[#16221C] transition cursor-pointer"
                title="View keyboard shortcuts (?)"
              >
                <Keyboard className="w-3 h-3" />
                <span>Shortcuts</span>
                <kbd className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px]">
                  ?
                </kbd>
              </button>
            </div>
          </div>

          {/* Bottom Tier: Selected Runner Chips, Stepper & Quick Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 border-t border-[#E5E5EA]/60 dark:border-[#23352C]/60">
            {/* Left: Active Race Context & Stepper */}
            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1 bg-[#F2F2F7] dark:bg-[#16221C] border border-[#E5E5EA] dark:border-[#23352C] rounded-full p-0.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={activeRaceNumber <= 1}
                  className="p-1 rounded-full text-[#86868B] dark:text-[#8A9990] hover:text-[#1D1D1F] dark:hover:text-[#F3F4F0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Race (or press [ )"
                  aria-label="Previous Race"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-semibold text-[#1D1D1F] dark:text-[#F3F4F0] px-2 tabular-nums">
                  R{activeRaceNumber}
                  <span className="text-[10px] text-[#86868B] dark:text-[#8A9990] font-normal">
                    /{totalRaces}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={activeRaceNumber >= totalRaces}
                  className="p-1 rounded-full text-[#86868B] dark:text-[#8A9990] hover:text-[#1D1D1F] dark:hover:text-[#F3F4F0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Race (or press ] )"
                  aria-label="Next Race"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F3F4F0] truncate max-w-[120px] sm:max-w-[140px]">
                  {meeting.venue} R{activeRaceNumber}
                </span>
                <span className="text-[10px] text-[#86868B] dark:text-[#8A9990] font-mono">
                  {completedRacesCount}/{totalRaces} Card Tipped
                </span>
              </div>

              {/* Joker Toggle */}
              <button
                type="button"
                onClick={onToggleJoker}
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer border inline-flex items-center gap-1 ${
                  isJokerActive
                    ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                    : "bg-white dark:bg-[#121A16] text-[#FF9500] border-[#FF9500]/40 hover:bg-[#FFF5E6] dark:hover:bg-[#FF9500]/10"
                }`}
                title="Double points if your selections win (or press J)"
              >
                <span>{isJokerActive ? "🃏 Joker 2× Active" : "🃏 Play Joker"}</span>
                <kbd className="hidden md:inline px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[9px]">
                  J
                </kbd>
              </button>
            </div>

            {/* Center: Selected Preference Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-center py-0.5">
              {/* 1st Preference */}
              <div
                className={`px-2.5 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
                  runner1
                    ? "bg-[#FFF5E6] dark:bg-amber-500/10 border-[#FF9500]/40 text-[#1D1D1F] dark:text-[#F3F4F0]"
                    : "bg-[#F2F2F7] dark:bg-[#16221C] border-[#E5E5EA] dark:border-[#23352C] text-[#86868B] border-dashed"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#FF9500] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  1
                </span>
                {runner1 ? (
                  <span className="truncate max-w-[100px] sm:max-w-[120px] font-semibold">
                    #{runner1.tabNumber} {runner1.horseName}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#86868B]">1st (3pts)</span>
                )}
              </div>

              {/* 2nd Preference */}
              <div
                className={`px-2.5 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
                  runner2
                    ? "bg-[#EBF5FF] dark:bg-blue-500/10 border-[#0071E3]/40 text-[#1D1D1F] dark:text-[#F3F4F0]"
                    : "bg-[#F2F2F7] dark:bg-[#16221C] border-[#E5E5EA] dark:border-[#23352C] text-[#86868B] border-dashed"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#0071E3] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  2
                </span>
                {runner2 ? (
                  <span className="truncate max-w-[100px] sm:max-w-[120px] font-semibold">
                    #{runner2.tabNumber} {runner2.horseName}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#86868B]">2nd (2pts)</span>
                )}
              </div>

              {/* 3rd Preference */}
              <div
                className={`px-2.5 py-1 rounded-full border text-xs font-mono flex items-center gap-1.5 shrink-0 ${
                  runner3
                    ? "bg-[#EAFBF0] dark:bg-emerald-500/10 border-[#34C759]/40 text-[#1D1D1F] dark:text-[#F3F4F0]"
                    : "bg-[#F2F2F7] dark:bg-[#16221C] border-[#E5E5EA] dark:border-[#23352C] text-[#86868B] border-dashed"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#34C759] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  3
                </span>
                {runner3 ? (
                  <span className="truncate max-w-[100px] sm:max-w-[120px] font-semibold">
                    #{runner3.tabNumber} {runner3.horseName}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#86868B]">3rd (1pt)</span>
                )}
              </div>
            </div>

            {/* Right: Quick Auto-Pick Strategies & Clear */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onApplyStrategy("balanced")}
                className="px-2.5 py-1 rounded-full bg-[#EBF5FF] dark:bg-blue-500/10 border border-[#0071E3]/20 dark:border-blue-500/30 text-[#0071E3] dark:text-blue-400 text-xs font-medium hover:bg-[#D6EBFF] dark:hover:bg-blue-500/20 transition cursor-pointer inline-flex items-center gap-1"
                title="Auto pick consensus trio (or press A)"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto</span>
                <kbd className="hidden lg:inline px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[9px]">
                  A
                </kbd>
              </button>

              {(runner1 || runner2 || runner3) && (
                <button
                  type="button"
                  onClick={onClearActiveRace}
                  className="px-2 py-1 rounded-full text-xs font-mono text-[#86868B] hover:text-[#FF3B30] transition cursor-pointer"
                  title="Clear selections for this race (or press C)"
                >
                  Clear
                </button>
              )}

              {isComplete && activeRaceNumber < totalRaces && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-3 py-1 rounded-full bg-[#0071E3] text-white text-xs font-semibold hover:bg-[#005bb5] transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                >
                  <span>Next R{activeRaceNumber + 1}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}

              {isComplete &&
                activeRaceNumber === totalRaces &&
                onNavigateToResults && (
                  <button
                    type="button"
                    onClick={onNavigateToResults}
                    className="px-3 py-1 rounded-full bg-[#34C759] text-white text-xs font-semibold hover:bg-[#2EB84E] transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Results →</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#121A16] rounded-2xl border border-[#E5E5EA] dark:border-[#23352C] shadow-2xl p-5 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E5EA] dark:border-[#23352C] pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[#0071E3] dark:text-[#10B981]" />
                <h3 className="font-semibold text-sm sm:text-base text-[#1D1D1F] dark:text-[#F3F4F0]">
                  Race Navigation &amp; Selection Hotkeys
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[#1D1D1F] dark:text-[#D5DDD8]">
              <div className="flex items-center justify-between py-1.5 border-b border-[#E5E5EA]/60 dark:border-[#23352C]/60">
                <span>Cycle to Previous Race</span>
                <kbd className="px-2 py-0.5 rounded bg-[#F2F2F7] dark:bg-[#1E2E25] font-mono font-bold border border-[#E5E5EA] dark:border-[#23352C]">
                  [
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E5E5EA]/60 dark:border-[#23352C]/60">
                <span>Cycle to Next Race</span>
                <kbd className="px-2 py-0.5 rounded bg-[#F2F2F7] dark:bg-[#1E2E25] font-mono font-bold border border-[#E5E5EA] dark:border-[#23352C]">
                  ]
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E5E5EA]/60 dark:border-[#23352C]/60">
                <span>Toggle Joker Race (2× Double Points)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#F2F2F7] dark:bg-[#1E2E25] font-mono font-bold border border-[#E5E5EA] dark:border-[#23352C]">
                  J
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E5E5EA]/60 dark:border-[#23352C]/60">
                <span>Quick Auto-Pick Consensus Trio</span>
                <kbd className="px-2 py-0.5 rounded bg-[#F2F2F7] dark:bg-[#1E2E25] font-mono font-bold border border-[#E5E5EA] dark:border-[#23352C]">
                  A
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E5E5EA]/60 dark:border-[#23352C]/60">
                <span>Clear Selections for Active Race</span>
                <kbd className="px-2 py-0.5 rounded bg-[#F2F2F7] dark:bg-[#1E2E25] font-mono font-bold border border-[#E5E5EA] dark:border-[#23352C]">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span>Auto-Advance to Next Race</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Triggered on 3rd Preference
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E5E5EA] dark:border-[#23352C] flex items-center justify-between">
              <span className="text-[11px] text-[#86868B]">
                Hotkeys work anywhere on the Selections tab.
              </span>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 rounded-lg bg-[#0071E3] dark:bg-[#10B981] text-white text-xs font-semibold hover:opacity-90"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
