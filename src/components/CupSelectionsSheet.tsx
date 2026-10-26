import React, { useState, useMemo, useEffect } from "react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import { CupTournamentState } from "../types/cupMode";
import {
  getRequiredRankCountForRace,
  isUserPreferencesCompleteForRace,
  checkAllPreferencesCompletion,
  checkMeetingPreferencesCompletion,
  resolveNextDraftStep,
  resolveAllDraftSteps,
  resolveNextSequentialDraftStep,
  resolveAllSequentialDraftSteps,
  resetDraftSelectionsKeepPreferences,
  getAllDraftStepsList,
  getAllSequentialDraftStepsList,
} from "../utils/cupMode";
import { getSydneyAndMelbourneMeetings } from "../data/seedNswTab";
import { audioAlerts } from "../utils/audioAlerts";
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  FastForward,
  Users,
  ShieldCheck,
  Flame,
  Info,
  MapPin,
  Calendar,
} from "lucide-react";
import { CupDraftRulesCard } from "./CupDraftRulesCard";

interface CupSelectionsSheetProps {
  meeting: RaceMeeting;
  meetings?: RaceMeeting[];
  onSelectMeeting?: (meetingId: string) => void;
  tournament: CupTournamentState;
  onUpdateTournament: (updated: CupTournamentState) => void;
  onNavigateToTournamentBoard: () => void;
  punters?: PunterProfile[];
  isApple?: boolean;
  isObsidian?: boolean;
}

export const CupSelectionsSheet: React.FC<CupSelectionsSheetProps> = ({
  meeting,
  meetings,
  onSelectMeeting,
  tournament,
  onUpdateTournament,
  onNavigateToTournamentBoard,
  punters = [],
  isApple = false,
  isObsidian = false,
}) => {
  const participants = tournament.participants || ["Steve F", "Mark S", "Dave W"];

  // Active viewing punter and race
  const [selectedPunter, setSelectedPunter] = useState<string>(participants[0] || "Steve F");
  const [selectedRaceNo, setSelectedRaceNo] = useState<number>(1);

  // Available meetings and Sydney/Melbourne identification
  const allAvailableMeetings = useMemo(() => {
    if (meetings && meetings.length > 0) return meetings;
    return [meeting];
  }, [meetings, meeting]);

  const { melbourneMeeting, sydneyMeeting } = useMemo(() => {
    return getSydneyAndMelbourneMeetings(allAvailableMeetings);
  }, [allAvailableMeetings]);

  const isMelbourneActive = useMemo(() => {
    if (!melbourneMeeting) return false;
    return meeting.id === melbourneMeeting.id;
  }, [meeting.id, melbourneMeeting]);

  const isSydneyActive = useMemo(() => {
    if (!sydneyMeeting) return false;
    return meeting.id === sydneyMeeting.id;
  }, [meeting.id, sydneyMeeting]);

  // Active race object
  const activeRace = useMemo(() => {
    return (
      meeting.races.find((r) => r.raceNumber === selectedRaceNo) ||
      meeting.races[0] || {
        raceNumber: 1,
        raceName: "Race 1",
        distance: 1200,
        startTime: "12:00",
        runners: [],
        status: "Open",
      }
    );
  }, [meeting, selectedRaceNo]);

  // Active runners excluding scratched
  const activeRunners = useMemo(() => {
    return [...activeRace.runners]
      .filter((r) => !r.isScratched)
      .sort((a, b) => a.tabNumber - b.tabNumber);
  }, [activeRace]);

  const requiredRanks = useMemo(() => {
    return getRequiredRankCountForRace(activeRace);
  }, [activeRace]);

  // Current punter's preferences for this race (checks meeting partition first)
  const currentPreferences: number[] = useMemo(() => {
    return (
      tournament.userPreferencesByMeeting?.[meeting.id]?.[selectedRaceNo]?.[selectedPunter] ||
      (tournament.meetingId === meeting.id
        ? tournament.userPreferencesByRace?.[selectedRaceNo]?.[selectedPunter]
        : []) ||
      []
    );
  }, [
    tournament.userPreferencesByMeeting,
    tournament.userPreferencesByRace,
    tournament.meetingId,
    meeting.id,
    selectedRaceNo,
    selectedPunter,
  ]);

  // Meeting completion statistics
  const currentMeetingStats = useMemo(() => {
    return checkMeetingPreferencesCompletion(meeting, participants, tournament);
  }, [meeting, participants, tournament]);

  const melbourneStats = useMemo(() => {
    if (!melbourneMeeting) return null;
    return checkMeetingPreferencesCompletion(melbourneMeeting, participants, tournament);
  }, [melbourneMeeting, participants, tournament]);

  const sydneyStats = useMemo(() => {
    if (!sydneyMeeting) return null;
    return checkMeetingPreferencesCompletion(sydneyMeeting, participants, tournament);
  }, [sydneyMeeting, participants, tournament]);

  // Active punter completion status for Melbourne
  const isPunterMelbourneComplete = useMemo(() => {
    if (!melbourneMeeting) return false;
    const melbPrefs =
      tournament.userPreferencesByMeeting?.[melbourneMeeting.id] ||
      (tournament.meetingId === melbourneMeeting.id ? tournament.userPreferencesByRace : undefined);
    return melbourneMeeting.races.every((r) =>
      isUserPreferencesCompleteForRace(r, melbPrefs?.[r.raceNumber]?.[selectedPunter])
    );
  }, [melbourneMeeting, tournament, selectedPunter]);

  // Active punter completion for current active race
  const isCurrentRaceComplete = useMemo(() => {
    return isUserPreferencesCompleteForRace(activeRace, currentPreferences);
  }, [activeRace, currentPreferences]);

  // Sequential meetings for drafting (Melbourne first, then Sydney)
  const sequentialMeetings = useMemo(() => {
    const list: RaceMeeting[] = [];
    if (melbourneMeeting) list.push(melbourneMeeting);
    if (sydneyMeeting && sydneyMeeting.id !== melbourneMeeting?.id) list.push(sydneyMeeting);
    if (list.length === 0) list.push(meeting);
    return list;
  }, [melbourneMeeting, sydneyMeeting, meeting]);

  // Sequential draft steps status
  const allDraftSteps = useMemo(() => {
    return getAllSequentialDraftStepsList(sequentialMeetings, participants, tournament.draftType);
  }, [sequentialMeetings, participants, tournament.draftType]);

  const draftedCount = useMemo(() => {
    let count = 0;
    for (const step of allDraftSteps) {
      const picks =
        tournament.selectionsByMeeting?.[step.meetingId] ||
        (tournament.meetingId === step.meetingId ? tournament.selectionsByRace : {}) ||
        {};
      if (picks[step.raceNumber]?.[step.punterName] !== undefined) {
        count++;
      }
    }
    return count;
  }, [allDraftSteps, tournament.selectionsByMeeting, tournament.selectionsByRace, tournament.meetingId]);

  const isDraftFullyResolved = allDraftSteps.length > 0 && draftedCount >= allDraftSteps.length;

  // Next draft step info across sequential meetings
  const nextPendingStep = useMemo(() => {
    return allDraftSteps.find((step) => {
      const picks =
        tournament.selectionsByMeeting?.[step.meetingId] ||
        (tournament.meetingId === step.meetingId ? tournament.selectionsByRace : {}) ||
        {};
      return picks[step.raceNumber]?.[step.punterName] === undefined;
    });
  }, [allDraftSteps, tournament.selectionsByMeeting, tournament.selectionsByRace, tournament.meetingId]);

  // Check if both Melbourne and Sydney are completed and ready for draft
  const isSyndicateReadyForDraft = useMemo(() => {
    if (melbourneStats && !melbourneStats.isComplete) return false;
    if (sydneyStats && !sydneyStats.isComplete) return false;
    return currentMeetingStats.isComplete;
  }, [melbourneStats, sydneyStats, currentMeetingStats]);

  // Helper: Persist updated preferences into state partitioned per meeting
  const savePreferences = (raceNo: number, punter: string, nextList: number[]) => {
    const meetingPrefs = {
      ...(tournament.userPreferencesByMeeting?.[meeting.id] || {}),
      [raceNo]: {
        ...((tournament.userPreferencesByMeeting?.[meeting.id] || {})[raceNo] || {}),
        [punter]: nextList,
      },
    };

    const updatedByMeeting = {
      ...(tournament.userPreferencesByMeeting || {}),
      [meeting.id]: meetingPrefs,
    };

    // If this is the active tournament meeting, also keep userPreferencesByRace in sync
    const updatedByRace: Record<number, Record<string, number[]>> = {
      ...(tournament.userPreferencesByRace || {}),
    };
    if (tournament.meetingId === meeting.id) {
      if (!updatedByRace[raceNo]) {
        updatedByRace[raceNo] = {};
      }
      updatedByRace[raceNo][punter] = nextList;
    }

    onUpdateTournament({
      ...tournament,
      userPreferencesByMeeting: updatedByMeeting,
      userPreferencesByRace:
        tournament.meetingId === meeting.id ? updatedByRace : tournament.userPreferencesByRace,
      updatedAt: new Date().toISOString(),
    });
  };

  // Handler: Add runner to next available preference rank
  const handleAddRunner = (tabNumber: number) => {
    if (currentPreferences.includes(tabNumber)) return;
    if (currentPreferences.length >= requiredRanks) return;

    const nextList = [...currentPreferences, tabNumber];
    savePreferences(selectedRaceNo, selectedPunter, nextList);
    audioAlerts.playTapClick();
    audioAlerts.triggerHapticFeedback(12);
  };

  // Handler: Remove runner from preference list
  const handleRemoveRunner = (tabNumber: number) => {
    const nextList = currentPreferences.filter((t) => t !== tabNumber);
    savePreferences(selectedRaceNo, selectedPunter, nextList);
    audioAlerts.playTapClick();
  };

  // Handler: Move rank position up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const nextList = [...currentPreferences];
    const temp = nextList[index - 1];
    nextList[index - 1] = nextList[index];
    nextList[index] = temp;
    savePreferences(selectedRaceNo, selectedPunter, nextList);
    audioAlerts.playTapClick();
  };

  // Handler: Move rank position down
  const handleMoveDown = (index: number) => {
    if (index >= currentPreferences.length - 1) return;
    const nextList = [...currentPreferences];
    const temp = nextList[index + 1];
    nextList[index + 1] = nextList[index];
    nextList[index] = temp;
    savePreferences(selectedRaceNo, selectedPunter, nextList);
    audioAlerts.playTapClick();
  };

  // Handler: Auto-fill remaining preference slots by market odds
  const handleAutoFillByOdds = () => {
    const unpicked = activeRunners
      .filter((r) => !currentPreferences.includes(r.tabNumber))
      .sort((a, b) => {
        const aOdds = a.fixedWin > 1 ? a.fixedWin : a.nswTabWin || 999;
        const bOdds = b.fixedWin > 1 ? b.fixedWin : b.nswTabWin || 999;
        return aOdds - bOdds;
      });

    const needed = requiredRanks - currentPreferences.length;
    if (needed <= 0) return;

    const toAdd = unpicked.slice(0, needed).map((r) => r.tabNumber);
    const nextList = [...currentPreferences, ...toAdd];
    savePreferences(selectedRaceNo, selectedPunter, nextList);
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(16);
  };

  // Handler: Auto-fill all races for this punter on active meeting
  const handleAutoFillAllRacesForPunter = () => {
    const meetingPrefs: Record<number, Record<string, number[]>> = {
      ...(tournament.userPreferencesByMeeting?.[meeting.id] || {}),
    };

    for (const race of meeting.races) {
      const active = race.runners
        .filter((r) => !r.isScratched)
        .sort((a, b) => {
          const aOdds = a.fixedWin > 1 ? a.fixedWin : a.nswTabWin || 999;
          const bOdds = b.fixedWin > 1 ? b.fixedWin : b.nswTabWin || 999;
          return aOdds - bOdds;
        });
      const req = getRequiredRankCountForRace(race);
      const rankedTabs = active.slice(0, req).map((r) => r.tabNumber);

      if (!meetingPrefs[race.raceNumber]) {
        meetingPrefs[race.raceNumber] = {};
      }
      meetingPrefs[race.raceNumber][selectedPunter] = rankedTabs;
    }

    const updatedByMeeting = {
      ...(tournament.userPreferencesByMeeting || {}),
      [meeting.id]: meetingPrefs,
    };

    onUpdateTournament({
      ...tournament,
      userPreferencesByMeeting: updatedByMeeting,
      userPreferencesByRace:
        tournament.meetingId === meeting.id ? meetingPrefs : tournament.userPreferencesByRace,
      updatedAt: new Date().toISOString(),
    });
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(20);
  };

  // Handler: Clear rankings for current race
  const handleClearRaceRankings = () => {
    savePreferences(selectedRaceNo, selectedPunter, []);
    audioAlerts.playTapClick();
  };

  // Handler: Step-by-step sequential draft resolution
  const handleNextDraftStep = () => {
    const result = resolveNextSequentialDraftStep(tournament, sequentialMeetings);
    onUpdateTournament(result.tournament);
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(16);
  };

  // Handler: Resolve all sequential draft steps in one click
  const handleResolveAllDraftSteps = () => {
    const fullyResolved = resolveAllSequentialDraftSteps(tournament, sequentialMeetings);
    onUpdateTournament(fullyResolved);
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(25);
  };

  // Handler: Reset draft assignments
  const handleResetDraft = () => {
    if (window.confirm("Reset all drafted runners? (Your 8-preference rankings will be kept)")) {
      const resetState = resetDraftSelectionsKeepPreferences(tournament);
      onUpdateTournament(resetState);
      audioAlerts.playTapClick();
    }
  };

  // Handler: Direct user straight from Melbourne card to Sydney card
  const handleProceedToSydneyCard = () => {
    if (!sydneyMeeting) return;
    if (onSelectMeeting) {
      onSelectMeeting(sydneyMeeting.id);
    }
    setSelectedRaceNo(1);
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(25);
    const el = document.getElementById("cup-selections-root") || document.getElementById("section-cup-mode");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handler: Switch back to Melbourne card
  const handleProceedToMelbourneCard = () => {
    if (!melbourneMeeting) return;
    if (onSelectMeeting) {
      onSelectMeeting(melbourneMeeting.id);
    }
    setSelectedRaceNo(1);
    audioAlerts.playRaceWinnerChime();
    audioAlerts.triggerHapticFeedback(20);
    const el = document.getElementById("cup-selections-root") || document.getElementById("section-cup-mode");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div id="cup-selections-root" className="space-y-6">
      {/* ====================================================================
          MEETING CARD SELECTOR TABS: MELBOURNE CARD & SYDNEY CARD
         ==================================================================== */}
      <div className={`p-3 sm:p-4 rounded-2xl border transition shadow-sm ${
        isApple
          ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
          : isObsidian
          ? "bg-[#111827] border-[#1E293B] text-[#F1F5F9]"
          : "bg-[#0E1512] border-[#2A3F33] text-[#F3F4F0]"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-[#D4AF37]">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
                Cup Mode Race Cards
              </div>
              <div className="text-xs opacity-75">
                Sequential Priority Draft: <strong>Melbourne Card</strong> → <strong>Sydney Card</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {melbourneMeeting && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectMeeting) onSelectMeeting(melbourneMeeting.id);
                  setSelectedRaceNo(1);
                  audioAlerts.playTapClick();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 cursor-pointer border ${
                  isMelbourneActive
                    ? isApple
                      ? "bg-[#0071E3] text-white border-[#0071E3] shadow-sm"
                      : "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] shadow-sm"
                    : isApple
                    ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-current/5 border-current/10 hover:bg-current/10"
                }`}
              >
                <span>🏇 Melbourne ({melbourneMeeting.venue})</span>
                {melbourneStats?.isComplete ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isMelbourneActive ? "bg-white/25 text-white" : "bg-[#10B981]/20 text-[#10B981]"
                  }`}>
                    ✓ Done
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isMelbourneActive ? "bg-black/20 text-white" : "bg-amber-500/20 text-amber-500"
                  }`}>
                    {melbourneMeeting.races.length - (melbourneStats?.missing.length || 0)}/{melbourneMeeting.races.length}R
                  </span>
                )}
              </button>
            )}

            {sydneyMeeting && (
              <button
                type="button"
                onClick={() => {
                  if (onSelectMeeting) onSelectMeeting(sydneyMeeting.id);
                  setSelectedRaceNo(1);
                  audioAlerts.playTapClick();
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 cursor-pointer border ${
                  isSydneyActive
                    ? isApple
                      ? "bg-[#0071E3] text-white border-[#0071E3] shadow-sm"
                      : "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] shadow-sm"
                    : isApple
                    ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-current/5 border-current/10 hover:bg-current/10"
                }`}
              >
                <span>🏇 Sydney ({sydneyMeeting.venue})</span>
                {sydneyStats?.isComplete ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSydneyActive ? "bg-white/25 text-white" : "bg-[#10B981]/20 text-[#10B981]"
                  }`}>
                    ✓ Done
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isSydneyActive ? "bg-black/20 text-white" : "bg-amber-500/20 text-amber-500"
                  }`}>
                    {sydneyMeeting.races.length - (sydneyStats?.missing.length || 0)}/{sydneyMeeting.races.length}R
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          PROMINENT TRANSITION CALLOUT: MELBOURNE COMPLETE -> NEXT: SYDNEY CARD
         ==================================================================== */}
      {isMelbourneActive && sydneyMeeting && (isPunterMelbourneComplete || melbourneStats?.isComplete) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0071E3]/20 via-[#10B981]/25 to-[#D4AF37]/25 border-2 border-[#10B981] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#10B981] text-[#070B09] flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              ✓
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-[#10B981]">
                  Melbourne Card Completed!
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-bold">
                  {meeting.venue} (All {meeting.races.length} Races Done)
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                You're through the Melbourne race card! Take your selections straight to the Sydney card at <strong>{sydneyMeeting.venue}</strong> to complete the syndicate priority draft.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleProceedToSydneyCard}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#005bb5] text-white font-bold text-xs sm:text-sm font-mono shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            <span>Next: Sydney Card ({sydneyMeeting.venue})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Back button when on Sydney card */}
      {isSydneyActive && melbourneMeeting && (
        <div className="p-3 rounded-xl bg-current/5 border border-current/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 opacity-80">
            <span>📍 Currently viewing:</span>
            <strong className="text-[#0071E3]">Sydney Card ({sydneyMeeting?.venue || "Sydney"})</strong>
            <span>· Melbourne ({melbourneMeeting.venue}) status:</span>
            <span className="text-[#10B981] font-bold">
              {melbourneStats?.isComplete ? "✓ All Races Complete" : `${melbourneStats?.percentage}% Ranked`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleProceedToMelbourneCard}
            className="px-3 py-1 rounded-lg bg-current/10 hover:bg-current/15 text-[11px] font-semibold cursor-pointer"
          >
            ← Return to Melbourne Card ({melbourneMeeting.venue})
          </button>
        </div>
      )}

      {/* ====================================================================
          HEADER: TITLE & TOURNAMENT STATS BANNER
         ==================================================================== */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition shadow-sm ${
          isApple
            ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
            : isObsidian
            ? "bg-[#111827] border-[#1E293B] text-[#F1F5F9]"
            : "bg-[#0E1512] border-[#2A3F33] text-[#F3F4F0]"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold uppercase tracking-wider font-mono border border-[#D4AF37]/30">
                <Trophy className="h-3.5 w-3.5" />
                Cup Mode · Priority Selections
              </span>
              <span className="opacity-40">•</span>
              <span className="font-mono text-xs opacity-80">
                {meeting.venue} ({meeting.races.length} Races)
              </span>
              <span className="opacity-40">•</span>
              <span className="font-mono text-xs text-[#10B981] font-semibold">
                Rank 8 Preferences per Race
              </span>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Order Your 8 Horse Preferences
            </h2>
            <p className="mt-1 text-xs sm:text-sm opacity-75 max-w-3xl leading-relaxed">
              For every participating race, rank up to <strong>8 horses in order of preference</strong> (1st being your top pick).
              During the draft, if your 1st choice is already drafted by another user, you will automatically fall back to your 2nd, 3rd, or next available preference.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
            <button
              type="button"
              onClick={onNavigateToTournamentBoard}
              className="apple-btn-secondary flex items-center gap-1.5 font-mono text-xs cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>Tournament Board</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Global Selections Completion Meter */}
        <div className="mt-5 pt-4 border-t border-current/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-2">
            <span className="font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>{meeting.venue} Preference Status:</span>
              <strong className={currentMeetingStats.isComplete ? "text-[#10B981]" : "text-[#D4AF37]"}>
                {currentMeetingStats.totalCompleted}/{currentMeetingStats.totalRequired} Slots Ranked ({currentMeetingStats.percentage}%)
              </strong>
            </span>
            <span>
              {currentMeetingStats.isComplete ? (
                <span className="inline-flex items-center gap-1 text-[#10B981] font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All Punters Complete at {meeting.venue}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {currentMeetingStats.missing.length} race selections still required
                </span>
              )}
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-current/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                currentMeetingStats.isComplete ? "bg-[#10B981]" : "bg-gradient-to-r from-[#D4AF37] to-[#10B981]"
              }`}
              style={{ width: `${currentMeetingStats.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cup Draft Rules & Mechanics Reference Card */}
      <CupDraftRulesCard
        tournament={tournament}
        isApple={isApple}
        isObsidian={isObsidian}
        defaultExpanded={false}
      />

      {/* ====================================================================
          DRAFT CONSOLE: SEQUENTIAL PRIORITY RESOLVER (MELBOURNE -> SYDNEY)
         ==================================================================== */}
      {(currentMeetingStats.isComplete || melbourneStats?.isComplete) && (
        <div
          className={`rounded-2xl border p-5 transition shadow-md animate-fadeIn ${
            isApple
              ? "bg-[#F2F7FF] border-[#0071E3]/30 text-[#1D1D1F]"
              : isObsidian
              ? "bg-[#1E293B]/60 border-[#38BDF8]/40 text-[#F1F5F9]"
              : "bg-[#102018] border-[#10B981]/40 text-[#F3F4F0]"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10B981] text-white">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <h3 className="font-bold text-base sm:text-lg">
                  Sequential Priority Draft Console
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-current/10 font-semibold">
                  {draftedCount}/{allDraftSteps.length} Picks Resolved
                </span>
              </div>
              <p className="mt-1 text-xs opacity-80 leading-relaxed">
                Drafts sequentially starting with the <strong>Melbourne card</strong> ({melbourneMeeting?.venue || "Melbourne"}), then proceeds directly to the <strong>Sydney card</strong> ({sydneyMeeting?.venue || "Sydney"}).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isDraftFullyResolved && nextPendingStep && (
                <button
                  type="button"
                  onClick={handleNextDraftStep}
                  className="px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0058B0] text-white font-mono text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>
                    Next Pick (Turn {draftedCount + 1}/{allDraftSteps.length}: {nextPendingStep.punterName} · {nextPendingStep.meetingVenue} R{nextPendingStep.raceNumber})
                  </span>
                </button>
              )}

              {!isDraftFullyResolved && (
                <button
                  type="button"
                  onClick={handleResolveAllDraftSteps}
                  className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#0D9668] text-[#070B09] font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <FastForward className="h-3.5 w-3.5" />
                  <span>Fast-Forward Draft</span>
                </button>
              )}

              {draftedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-mono text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Clear drafted picks to run the draft again"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Draft</span>
                </button>
              )}
            </div>
          </div>

          {/* Announcer Callout Banner */}
          {tournament.lastDraftStepCallout && (
            <div className="mt-3.5 p-3 rounded-xl bg-black/20 border border-current/10 flex items-center gap-2 text-xs sm:text-sm font-mono animate-fadeIn">
              <span className="shrink-0 text-base">📢</span>
              <span className="font-semibold">{tournament.lastDraftStepCallout}</span>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          PUNTER SWITCHER TABS & COMPLETION INDICATORS
         ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-60 mr-1 shrink-0">
            Punter:
          </span>
          {participants.map((punter) => {
            const isSelected = selectedPunter === punter;
            // Check completion for this punter across all races
            const punterMissing = currentMeetingStats.missing.filter((m) => m.punter === punter);
            const isPunterComplete = punterMissing.length === 0;

            return (
              <button
                key={punter}
                type="button"
                onClick={() => {
                  setSelectedPunter(punter);
                  audioAlerts.playTapClick();
                }}
                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? isApple
                      ? "bg-[#0071E3] text-white border-[#0071E3] shadow-sm"
                      : "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] shadow-sm"
                    : isApple
                    ? "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7]"
                    : "bg-current/5 border-current/10 text-current hover:bg-current/10"
                }`}
              >
                <span>{punter}</span>
                {isPunterComplete ? (
                  <span
                    className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${
                      isSelected
                        ? "bg-white text-[#0071E3]"
                        : "bg-[#10B981] text-white"
                    }`}
                  >
                    ✓
                  </span>
                ) : (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? "bg-black/20 text-white" : "bg-amber-500/20 text-amber-500"
                    }`}
                  >
                    {meeting.races.length - punterMissing.length}/{meeting.races.length}R
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoFillAllRacesForPunter}
            className="apple-btn-secondary text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Auto-fill 8 preferences for all races based on verified market odds"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" />
            <span>Auto-fill All Races for {selectedPunter}</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          RACE RIBBON SELECTOR (R1 .. RN)
         ==================================================================== */}
      <div
        className={`p-2.5 rounded-2xl border flex items-center gap-1.5 overflow-x-auto shadow-xs ${
          isApple
            ? "bg-white border-[#E5E5EA]"
            : isObsidian
            ? "bg-[#111827] border-[#1E293B]"
            : "bg-[#0E1512] border-[#2A3F33]"
        }`}
      >
        {meeting.races.map((r) => {
          const isSelected = selectedRaceNo === r.raceNumber;
          const userPrefs = tournament.userPreferencesByRace?.[r.raceNumber]?.[selectedPunter] || [];
          const reqCount = getRequiredRankCountForRace(r);
          const isComplete = userPrefs.length >= reqCount;
          const assignedPick = tournament.selectionsByRace?.[r.raceNumber]?.[selectedPunter];

          return (
            <button
              key={r.raceNumber}
              type="button"
              onClick={() => {
                setSelectedRaceNo(r.raceNumber);
                audioAlerts.playTapClick();
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                isSelected
                  ? isApple
                    ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                    : isObsidian
                    ? "bg-[#38BDF8] text-[#0F172A] border-[#38BDF8] shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] shadow-xs"
                  : isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                  : "bg-current/5 border-current/10 text-current hover:bg-current/10"
              }`}
            >
              <span>R{r.raceNumber}</span>
              {isComplete ? (
                <span className={`text-[10px] ${isSelected ? "opacity-90" : "text-[#10B981]"}`}>
                  ✓
                </span>
              ) : (
                <span className={`text-[10px] ${isSelected ? "opacity-80" : "text-amber-500"}`}>
                  {userPrefs.length}/{reqCount}
                </span>
              )}
              {assignedPick !== undefined && (
                <span
                  className={`text-[9px] px-1 rounded-sm font-bold ${
                    isSelected ? "bg-black/30 text-white" : "bg-[#10B981]/20 text-[#10B981]"
                  }`}
                  title={`Drafted pick: Runner #${assignedPick}`}
                >
                  #{assignedPick}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          RACE DETAIL BANNER & QUICK ACTIONS
         ==================================================================== */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isApple
            ? "bg-[#FAF9FA] border-[#E5E5EA] text-[#1D1D1F]"
            : isObsidian
            ? "bg-[#161F30] border-[#1E293B] text-[#F1F5F9]"
            : "bg-[#121A16] border-[#22352B] text-[#F3F4F0]"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-[#0071E3] text-white font-mono text-xs font-bold">
              Race {activeRace.raceNumber}
            </span>
            <h3 className="font-bold text-base sm:text-lg">
              {activeRace.raceName}
            </h3>
          </div>
          <p className="mt-1 text-xs opacity-70 font-mono">
            {activeRace.distance}m · Start: {activeRace.startTime} AEDT · Field Size: {activeRunners.length} active runners
            · Required Rankings: <strong>{requiredRanks} horses</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAutoFillByOdds}
            className="apple-btn-secondary text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Auto-fill remaining slots with top market favourites"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" />
            <span>Auto-fill Remaining by Odds</span>
          </button>
          {currentPreferences.length > 0 && (
            <button
              type="button"
              onClick={handleClearRaceRankings}
              className="text-xs text-red-400 hover:text-red-300 font-mono px-2 py-1 cursor-pointer"
            >
              Clear Rankings
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          TWO-COLUMN WORKSPACE:
          Left: 8-Horse Ordered Preference List (Favorites -> Fallbacks)
          Right: Available Field to Pick From
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 8-Rank Ordered Slot List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>
                {selectedPunter}'s Ordered Ranking ({currentPreferences.length}/{requiredRanks} Picked)
              </span>
            </h4>
            <span className="text-[11px] font-mono opacity-60">
              #1 = Top Favorite Pick · #2..#8 = Fallbacks
            </span>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: requiredRanks }).map((_, rankIndex) => {
              const prefRank = rankIndex + 1;
              const tabNumber = currentPreferences[rankIndex];
              const runner = tabNumber !== undefined ? activeRunners.find((r) => r.tabNumber === tabNumber) : null;
              const isAssignedAsFinalPick =
                tournament.selectionsByRace?.[selectedRaceNo]?.[selectedPunter] === tabNumber &&
                tabNumber !== undefined;

              // Check if another punter in this race was assigned this horse
              let takenByOther: string | null = null;
              if (tabNumber !== undefined) {
                const picksInRace = tournament.selectionsByRace?.[selectedRaceNo] || {};
                for (const [punter, takenTab] of Object.entries(picksInRace)) {
                  if (takenTab === tabNumber && punter !== selectedPunter) {
                    takenByOther = punter;
                    break;
                  }
                }
              }

              return (
                <div
                  key={prefRank}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    runner
                      ? isAssignedAsFinalPick
                        ? "bg-[#10B981]/15 border-[#10B981] shadow-xs"
                        : takenByOther
                        ? "bg-red-500/10 border-red-500/30 opacity-80"
                        : isApple
                        ? "bg-white border-[#E5E5EA] shadow-xs"
                        : isObsidian
                        ? "bg-[#1E293B] border-[#334155]"
                        : "bg-[#132019] border-[#243A2F]"
                      : isApple
                      ? "bg-[#FAF9FA] border-dashed border-[#D1D1D6] text-[#86868B]"
                      : "bg-current/5 border-dashed border-current/20 text-current opacity-70"
                  }`}
                >
                  {/* Left: Rank Badge */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs ${
                        prefRank === 1
                          ? "bg-[#D4AF37] text-[#070B09] shadow-xs ring-2 ring-[#D4AF37]/30"
                          : prefRank === 2
                          ? "bg-[#0071E3] text-white"
                          : prefRank === 3
                          ? "bg-[#FF9500] text-white"
                          : "bg-current/10 text-current"
                      }`}
                    >
                      <span>#{prefRank}</span>
                      <span className="text-[8px] font-sans uppercase leading-none opacity-80">
                        {prefRank === 1 ? "Top" : "Pref"}
                      </span>
                    </div>

                    {runner ? (
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="h-5 w-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white shadow-xs"
                            style={{
                              background: `linear-gradient(135deg, ${runner.silkPrimary} 55%, ${runner.silkSecondary} 45%)`,
                              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                            }}
                          >
                            {runner.tabNumber}
                          </span>
                          <span className="font-bold text-sm truncate">
                            #{runner.tabNumber} {runner.horseName}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#10B981]">
                            ${(runner.fixedWin || runner.nswTabWin || 0).toFixed(2)}
                          </span>

                          {isAssignedAsFinalPick && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10B981] text-[#070B09] font-mono text-[10px] font-bold">
                              ✓ Drafted Pick
                            </span>
                          )}

                          {takenByOther && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono text-[10px] font-semibold">
                              Drafted by {takenByOther} (Fell back)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-70 truncate font-mono mt-0.5">
                          Barrier {runner.barrier} · Jockey: {runner.jockey} · Trainer: {runner.trainer}
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-xs italic opacity-60">
                        Slot #{prefRank} empty — click a runner from the field to assign
                      </div>
                    )}
                  </div>

                  {/* Right: Actions (Up, Down, Remove) */}
                  {runner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(rankIndex)}
                        disabled={rankIndex === 0}
                        className="p-1.5 rounded-lg hover:bg-current/10 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(rankIndex)}
                        disabled={rankIndex >= currentPreferences.length - 1}
                        className="p-1.5 rounded-lg hover:bg-current/10 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRunner(runner.tabNumber)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 cursor-pointer"
                        title="Remove from rankings"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isCurrentRaceComplete && (
            <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#10B981]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Full {requiredRanks} preferences completed for Race {activeRace.raceNumber}!</span>
              </div>
              {selectedRaceNo < meeting.races.length && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRaceNo((prev) => prev + 1);
                    audioAlerts.playTapClick();
                    const el = document.getElementById("cup-selections-root");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#0ea372] text-[#070B09] font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 transition shadow-xs"
                >
                  <span>Next: Race {selectedRaceNo + 1}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Prompt with Next: Sydney Card button upon completing Melbourne */}
          {isMelbourneActive && sydneyMeeting && (
            <>
              {isCurrentRaceComplete && selectedRaceNo === meeting.races.length ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#10B981]/20 via-[#0071E3]/25 to-[#D4AF37]/20 border-2 border-[#10B981] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in zoom-in-95">
                  <div>
                    <div className="font-bold text-xs font-mono text-[#10B981] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Melbourne Final Race Ranked (Race {selectedRaceNo})!</span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      You've reached the end of the Melbourne card. Proceed straight to Race 1 of the Sydney card at <strong>{sydneyMeeting.venue}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleProceedToSydneyCard}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#005bb5] text-white font-bold text-xs font-mono flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
                  >
                    <span>Next: Sydney Card ({sydneyMeeting.venue})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : isPunterMelbourneComplete ? (
                <div className="p-3.5 rounded-xl bg-[#0071E3]/15 border border-[#0071E3]/30 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-mono">
                  <span className="text-[#0071E3] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All Melbourne races completed for {selectedPunter}!</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleProceedToSydneyCard}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0071E3] hover:bg-[#005bb5] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Proceed to Sydney Card ({sydneyMeeting.venue})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Completion Callout on Sydney Card final race */}
          {isSydneyActive && isCurrentRaceComplete && selectedRaceNo === meeting.races.length && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#10B981]/20 via-[#D4AF37]/25 to-[#0071E3]/20 border-2 border-[#D4AF37] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in zoom-in-95">
              <div>
                <div className="font-bold text-xs font-mono text-[#D4AF37] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Sydney Card Complete (Race {selectedRaceNo})!</span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Both Melbourne and Sydney race card preferences are set. Run the priority draft sequentially to assign horses!
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToTournamentBoard}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2e] text-[#070B09] font-bold text-xs font-mono flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
              >
                <span>Go to Tournament Board</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Available Runners Field */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-[#0071E3]" />
              <span>Field of Runners ({activeRunners.length})</span>
            </h4>
            <span className="text-[11px] font-mono opacity-60">
              Click to rank in priority order
            </span>
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {activeRunners.map((r) => {
              const isRanked = currentPreferences.includes(r.tabNumber);
              const rankPosition = currentPreferences.indexOf(r.tabNumber);
              const isFull = currentPreferences.length >= requiredRanks;

              return (
                <div
                  key={r.tabNumber}
                  onClick={() => {
                    if (!isRanked && !isFull) {
                      handleAddRunner(r.tabNumber);
                    }
                  }}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                    isRanked
                      ? "opacity-60 bg-current/5 border-current/10 cursor-default"
                      : isFull
                      ? "opacity-40 cursor-not-allowed border-current/10"
                      : isApple
                      ? "bg-white border-[#E5E5EA] hover:border-[#0071E3] hover:shadow-xs cursor-pointer active:scale-98"
                      : isObsidian
                      ? "bg-[#1E293B] border-[#334155] hover:border-[#38BDF8] cursor-pointer active:scale-98"
                      : "bg-[#132019] border-[#22352B] hover:border-[#D4AF37] cursor-pointer active:scale-98"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-mono text-xs font-bold text-white shadow-xs"
                      style={{
                        background: `linear-gradient(135deg, ${r.silkPrimary} 55%, ${r.silkSecondary} 45%)`,
                        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                      }}
                    >
                      {r.tabNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">
                        #{r.tabNumber} {r.horseName}
                      </div>
                      <div className="text-[10px] opacity-70 truncate font-mono">
                        B{r.barrier} · {r.jockey}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right font-mono text-xs">
                      <div className="font-bold text-[#10B981]">
                        ${(r.fixedWin || r.nswTabWin || 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] opacity-60">
                        ${(r.fixedPlace || r.nswTabPlace || 0).toFixed(2)}P
                      </div>
                    </div>

                    {isRanked ? (
                      <span className="px-2 py-1 rounded-md bg-[#D4AF37] text-[#070B09] font-mono text-[10px] font-bold">
                        Rank #{rankPosition + 1}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isFull}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddRunner(r.tabNumber);
                        }}
                        className="px-2 py-1 rounded-md bg-current/10 hover:bg-current/20 font-mono text-[10px] font-semibold cursor-pointer disabled:opacity-20"
                      >
                        + Rank
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
