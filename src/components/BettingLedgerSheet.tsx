import React, { useState, useEffect } from "react";
import {
  RaceMeeting,
  RaceEvent,
  RaceRunner,
  PunterProfile,
  RaceSelectionTrio,
} from "../types/racing";
import {
  getSydneyAndMelbourneMeetings,
  sortMeetingsByMetroPriority,
  isMainMetroVenue,
  isRaceOfficialOrCompleted,
} from "../data/seedNswTab";
import {
  computeRaceSpeedMapAndFlucs,
  getFeatureRaceForMeeting,
  getFeatureRaceNumberForMeeting,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
  resolveAutoSubForRaceTrio,
  SpeedMapLane,
  RunnerSpeedAndMarketFluc,
} from "../utils/scoring";
import { AutoPickStrategy, generateRaceAutoPickTrio } from "../utils/autoPick";
import {
  Trophy,
  UserPlus,
  UserMinus,
  Trash2,
  CheckCircle2,
  Check,
  Award,
  RotateCcw,
  Users,
  Sparkles,
  DollarSign,
  MapPin,
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  Swords,
  BarChart3,
  SlidersHorizontal,
  Table as TableIcon,
  Zap,
  LayoutList,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { HarvillePlackettLuceModel } from "./HarvillePlackettLuceModel";
import { StickySyndicateDock } from "./StickySyndicateDock";
import { TactileOddsFlucBadge, OddsTrendIndicator } from "./TactileOddsFlucBadge";
import { RunnerAiAnalysisButton } from "./RunnerAiAnalysisButton";

interface BettingLedgerSheetProps {
  meetings: RaceMeeting[];
  activeMeetingId?: string;
  selectedMeetingId?: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  selectedDate?: string;
  onChangeDate?: (newIsoDate: string) => void;
  onRefreshSelectedDay?: () => void;
  isScraping?: boolean;
  punters: PunterProfile[];
  activePunterId: string;
  onSelectPunter: (id: string) => void;
  onAddPunter: (name: string, role: string) => void;
  onRemovePunter?: (punterId: string) => void;
  onUpdateRaceSelection: (
    punterId: string,
    meetingId: string,
    raceNumber: number,
    preferenceRank: 1 | 2 | 3,
    tabNumber: number | null
  ) => void;
  onToggleJokerRace?: (
    punterId: string,
    meetingId: string,
    raceNumber: number | null
  ) => void;
  onAutoFillCardSelections?: (punterId: string, meetingId: string) => void;
  onAutoFillCardForPunter?: (punterId: string, meeting: RaceMeeting) => void;
  onClearCardSelections?: (punterId: string, meetingId: string) => void;
  onClearCardForPunter?: (punterId: string, meetingId: string) => void;
  onSaveConfirmation?: (msg: string) => void;
  cloudSyncState?: "synced" | "saving" | "local";
  lastSyncedTime?: string;
  onManualCloudSync?: () => void;
  scoringMode: "points" | "dollars";
  onToggleScoringMode: (mode: "points" | "dollars") => void;
  onJumpToSharedResults?: () => void;
  onNavigateToResults?: () => void;
}

export interface RacePointsBreakdown {
  preferenceRank: 1 | 2 | 3;
  tabNumber: number | null;
  runner?: RaceRunner;
  finishPosition: number;
  basePoints: number;
  points: number;
  dollarReturn: number;
}

export interface EvaluatedRaceTrio {
  picks: [RacePointsBreakdown, RacePointsBreakdown, RacePointsBreakdown];
  baseRacePointsTally: number;
  racePointsTally: number;
  jokerBonusPoints: number;
  raceDollarReturn: number;
  isComplete: boolean;
  hasAnySelection: boolean;
  isRaceResulted: boolean;
  isJokerRace: boolean;
  jokerTriggered: boolean;
}

/**
 * Evaluates a user's 3-horse preference trio for a single race.
 * Crucially checks `isRaceOfficialOrCompleted(race, meetingDate)` so uncompleted
 * or future races NEVER show premature results, "Unplaced", "$0", or "0 pts".
 * Also evaluates the Joker Round: if `isJokerRace` is true and the user's 1st Preference
 * horse wins (`finishPosition === 1`), the user receives DOUBLE POINTS (2x)!
 */
export function evaluateRaceTrio(
  race: RaceEvent,
  trio: RaceSelectionTrio | undefined,
  meetingDate?: string,
  isJokerRace: boolean = false
): EvaluatedRaceTrio {
  const isRaceResulted = isRaceOfficialOrCompleted(race, meetingDate);
  const prefs: Array<{ rank: 1 | 2 | 3; tab: number | null }> = [
    { rank: 1, tab: trio?.firstPref ?? null },
    { rank: 2, tab: trio?.secondPref ?? null },
    { rank: 3, tab: trio?.thirdPref ?? null },
  ];

  const picks = prefs.map(({ rank, tab }): RacePointsBreakdown => {
    if (tab === null) {
      return {
        preferenceRank: rank,
        tabNumber: null,
        finishPosition: 0,
        basePoints: 0,
        points: 0,
        dollarReturn: 0,
      };
    }
    const runner = race.runners.find((r) => r.tabNumber === tab);
    const finishPosition = isRaceResulted ? runner?.finishPosition ?? 0 : 0;

    // Points System: 1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt (only once race is official/completed)
    let basePoints = 0;
    if (isRaceResulted) {
      if (finishPosition === 1) basePoints = 3;
      else if (finishPosition === 2) basePoints = 2;
      else if (finishPosition === 3) basePoints = 1;
    }

    // Double points in Joker Round for all successful selections (first, second, or third)
    const points = isJokerRace && isRaceResulted && basePoints > 0 ? basePoints * 2 : basePoints;

    // Dollar Return System (1-Unit Win + 1-Unit Place = $1 Each-Way on EVERY selection):
    // - 1st finish: 1u Win + 1u Place dividend (or 1u Win if fieldSize <= 4)
    // - 2nd finish: 1u Place dividend (if fieldSize >= 5)
    // - 3rd finish: 1u Place dividend (if fieldSize >= 8; $0.00 on NTD races with 5-7 runners)
    let dollarReturn = 0;
    if (isRaceResulted && runner) {
      const fieldSize = (race.runners || []).length;
      const winDiv =
        Number(runner.nswTabWin) || Number(runner.fixedWin) || 0;
      const rawPlace =
        Number(runner.nswTabPlace) || Number(runner.fixedPlace) || 0;
      const placeDiv =
        rawPlace > 0
          ? rawPlace
          : winDiv > 1
          ? Number(
              (1 + (winDiv - 1) / (fieldSize <= 7 ? 3.5 : 4)).toFixed(2)
            )
          : 0;

      if (finishPosition === 1) {
        const placeCollect = fieldSize > 0 && fieldSize <= 4 ? 0 : placeDiv;
        dollarReturn = winDiv + placeCollect;
      } else if (finishPosition === 2) {
        dollarReturn = fieldSize > 0 && fieldSize <= 4 ? 0 : placeDiv;
      } else if (finishPosition === 3) {
        // NTD (No Third Dividend) when fieldSize <= 7
        dollarReturn = fieldSize > 0 && fieldSize <= 7 ? 0 : placeDiv;
      }
    }

    return {
      preferenceRank: rank,
      tabNumber: tab,
      runner,
      finishPosition,
      basePoints,
      points,
      dollarReturn: Number(dollarReturn.toFixed(2)),
    };
  }) as [RacePointsBreakdown, RacePointsBreakdown, RacePointsBreakdown];

  const baseRacePointsTally = picks.reduce((sum, p) => sum + p.basePoints, 0);
  const racePointsTally = picks.reduce((sum, p) => sum + p.points, 0);
  const jokerBonusPoints = Math.max(0, racePointsTally - baseRacePointsTally);
  const jokerTriggered = Boolean(
    isJokerRace && isRaceResulted && baseRacePointsTally > 0
  );
  const raceDollarReturn = Number(
    picks.reduce((sum, p) => sum + p.dollarReturn, 0).toFixed(2)
  );
  const isComplete = picks.every((p) => p.tabNumber !== null);
  const hasAnySelection = picks.some((p) => p.tabNumber !== null);

  return {
    picks,
    baseRacePointsTally,
    racePointsTally,
    jokerBonusPoints,
    raceDollarReturn,
    isComplete,
    hasAnySelection,
    isRaceResulted,
    isJokerRace,
    jokerTriggered,
  };
}

export function formatDollarReturn(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getRunnerBriefComment(
  runner: RaceRunner,
  speedMapPos: SpeedMapLane,
  flucData?: RunnerSpeedAndMarketFluc
): string {
  if (runner.isScratched || runner.margin === "SCR") {
    return "Scratched from this event (TAB auto-sub rules apply).";
  }

  const odds = Number(runner.fixedWin || runner.nswTabWin || 0);
  const formStr = (runner.form || "").trim();
  const lastStartWon = formStr.endsWith("1") || formStr.endsWith("1x");
  const lastStartPlaced = formStr.endsWith("2") || formStr.endsWith("3");
  const isFirming = flucData?.marketSupport === "Firming";
  const isDrifting = flucData?.marketSupport === "Drifting";

  if (odds > 0 && odds <= 2.2) {
    if (isFirming) return "Heavily backed odds-on elect. Top winning strike rate; clear standout.";
    return "Short-priced favourite. Ultra consistent and sets the benchmark here.";
  }
  if (isFirming && odds <= 5.5) {
    return "Well supported in early betting. Strong market push; maps right on speed.";
  }
  if (lastStartWon && (speedMapPos === "Leader" || speedMapPos === "On Pace")) {
    return "Impressive last-start winner. Possesses early dash; tough to reel in.";
  }
  if (lastStartWon) {
    return "Back in winning form last start. Finished strongly and primed to repeat.";
  }
  if (lastStartPlaced && odds <= 8.5) {
    return "Solid placing last time out. Honest type; reliable each-way candidate.";
  }
  if (speedMapPos === "Leader") {
    return "Likely front-runner. Will cross from barrier and control tempo from the lead.";
  }
  if (speedMapPos === "On Pace" && odds <= 12.0) {
    return "Handy racing pattern. Settles in box seat with a trailing run into the straight.";
  }
  if (isDrifting && odds >= 9.0) {
    return "Drifting in fixed odds. Capable at best but faces a competitive assignment.";
  }
  if (odds > 0 && odds <= 7.0) {
    return "Consistent metro competitor. Proven at distance with strong place claims.";
  }
  if (odds > 7.0 && odds <= 18.0) {
    return "Genuine each-way value. Capable of storming into the frame with clear running.";
  }
  return "Outside chance at longer odds; requires luck in running to challenge.";
}

export const BettingLedgerSheet: React.FC<BettingLedgerSheetProps> = ({
  meetings,
  activeMeetingId,
  selectedMeetingId,
  onSelectMeeting,
  selectedMeetingIds: controlledSelectedIds,
  onChangeSelectedMeetingIds,
  punters,
  activePunterId,
  onSelectPunter,
  onAddPunter,
  onRemovePunter,
  onUpdateRaceSelection,
  onToggleJokerRace,
  onAutoFillCardSelections,
  onAutoFillCardForPunter,
  onClearCardSelections,
  onClearCardForPunter,
  onSaveConfirmation,
  cloudSyncState = "synced",
  lastSyncedTime,
  onManualCloudSync,
  scoringMode,
  onToggleScoringMode,
  onJumpToSharedResults,
  onNavigateToResults,
}) => {
  const resolvedMeetingId = activeMeetingId || selectedMeetingId || "";
  const handleJumpToResults = () => {
    if (onJumpToSharedResults) onJumpToSharedResults();
    else if (onNavigateToResults) onNavigateToResults();
  };
  const [newPunterName, setNewPunterName] = useState("");
  const [newPunterRole, setNewPunterRole] = useState("Syndicate Member");
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAllSpeedMaps, setShowAllSpeedMaps] = useState(false);
  const [expandedSpeedMapRaces, setExpandedSpeedMapRaces] = useState<
    Record<string, boolean>
  >({});

  const toggleRaceSpeedMap = (meetingId: string, raceNumber: number) => {
    const key = `${meetingId}-${raceNumber}`;
    setExpandedSpeedMapRaces((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? showAllSpeedMaps),
    }));
  };

  const [selectionViewMode, setSelectionViewMode] = useState<"cards" | "stepper" | "table">("cards");
  const [activeRacePerMeeting, setActiveRacePerMeeting] = useState<Record<string, number>>({});
  const [expandedHarvilleRaces, setExpandedHarvilleRaces] = useState<Record<string, boolean>>({});

  const toggleHarvilleModel = (meetingId: string, raceNumber: number) => {
    const key = `${meetingId}-${raceNumber}`;
    setExpandedHarvilleRaces((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const triggerHaptic = (pattern: number | number[] = 15) => {
    try {
      if (typeof window !== "undefined" && "navigator" in window && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {}
  };

  const handleTogglePreferenceChip = (
    punterId: string,
    meetingId: string,
    raceNumber: number,
    rank: 1 | 2 | 3,
    tabNumber: number
  ) => {
    const p = punters.find((item) => item.id === punterId);
    const mSelections = p?.selectionsByMeeting[meetingId] || {};
    const currentTrio = mSelections[raceNumber];

    const currentAtRank =
      rank === 1
        ? currentTrio?.firstPref
        : rank === 2
        ? currentTrio?.secondPref
        : currentTrio?.thirdPref;

    // Toggle off if already selected
    if (currentAtRank === tabNumber) {
      onUpdateRaceSelection(punterId, meetingId, raceNumber, rank, null);
      triggerHaptic(10);
      return;
    }

    // Clear any previous rank this horse had in the same trio to prevent duplicate tabs
    if (currentTrio?.firstPref === tabNumber && rank !== 1) {
      onUpdateRaceSelection(punterId, meetingId, raceNumber, 1, null);
    }
    if (currentTrio?.secondPref === tabNumber && rank !== 2) {
      onUpdateRaceSelection(punterId, meetingId, raceNumber, 2, null);
    }
    if (currentTrio?.thirdPref === tabNumber && rank !== 3) {
      onUpdateRaceSelection(punterId, meetingId, raceNumber, 3, null);
    }

    // Set new preference
    onUpdateRaceSelection(punterId, meetingId, raceNumber, rank, tabNumber);
    triggerHaptic(20);
  };

  const handleApplyStrategyToRace = (
    punterId: string,
    meetingId: string,
    race: RaceEvent,
    strategy: AutoPickStrategy
  ) => {
    const res = generateRaceAutoPickTrio(race.runners, race.raceNumber, strategy);
    if (res.firstPref) {
      onUpdateRaceSelection(punterId, meetingId, race.raceNumber, 1, res.firstPref);
    }
    if (res.secondPref) {
      onUpdateRaceSelection(punterId, meetingId, race.raceNumber, 2, res.secondPref);
    }
    if (res.thirdPref) {
      onUpdateRaceSelection(punterId, meetingId, race.raceNumber, 3, res.thirdPref);
    }
    triggerHaptic([15, 20, 15]);
    onSaveConfirmation?.(res.summaryText);
  };

  const handleClearRacePicks = (
    punterId: string,
    meetingId: string,
    raceNumber: number
  ) => {
    onUpdateRaceSelection(punterId, meetingId, raceNumber, 1, null);
    onUpdateRaceSelection(punterId, meetingId, raceNumber, 2, null);
    onUpdateRaceSelection(punterId, meetingId, raceNumber, 3, null);
    triggerHaptic(10);
  };

  const evaluateSyndicateConsensus = (
    meeting: RaceMeeting,
    race: RaceEvent
  ) => {
    const steve = punters.find(
      (p) =>
        p.id === "punter-steve-f" ||
        (p.name || "").toLowerCase().includes("steve")
    );
    const mark = punters.find(
      (p) =>
        p.id === "punter-mark-s" ||
        (p.name || "").toLowerCase().includes("mark")
    );

    const steveTrio = steve
      ? (steve.selectionsByMeeting[meeting.id] || {})[race.raceNumber]
      : undefined;
    const markTrio = mark
      ? (mark.selectionsByMeeting[meeting.id] || {})[race.raceNumber]
      : undefined;

    const steve1stRunner = steveTrio?.firstPref
      ? race.runners.find((r) => r.tabNumber === steveTrio.firstPref)
      : null;
    const mark1stRunner = markTrio?.firstPref
      ? race.runners.find((r) => r.tabNumber === markTrio.firstPref)
      : null;

    if (
      steve1stRunner &&
      mark1stRunner &&
      steve1stRunner.tabNumber === mark1stRunner.tabNumber
    ) {
      return {
        type: "consensus" as const,
        headline: "Syndicate Consensus (High Conviction)",
        text: `Both Steve F and Mark S locked #${steve1stRunner.tabNumber} ${steve1stRunner.horseName} as their 1st Preference.`,
        tabNumber: steve1stRunner.tabNumber,
      };
    }

    if (steve1stRunner && mark1stRunner) {
      return {
        type: "clash" as const,
        headline: "Syndicate Head-to-Head Clash",
        text: `Steve F backing #${steve1stRunner.tabNumber} ${steve1stRunner.horseName} vs Mark S backing #${mark1stRunner.tabNumber} ${mark1stRunner.horseName}.`,
        steveTab: steve1stRunner.tabNumber,
        markTab: mark1stRunner.tabNumber,
      };
    }

    if (steve1stRunner || mark1stRunner) {
      const activeUser = steve1stRunner ? "Steve F" : "Mark S";
      const runner = steve1stRunner || mark1stRunner;
      const awaitingUser = steve1stRunner ? "Mark S" : "Steve F";
      return {
        type: "partial" as const,
        headline: `Syndicate Pick: ${activeUser}`,
        text: `${activeUser} locked #${runner?.tabNumber} ${runner?.horseName} as 1st Preference. Awaiting ${awaitingUser}.`,
        tabNumber: runner?.tabNumber,
      };
    }

    return {
      type: "none" as const,
      headline: "Awaiting Selections",
      text: "Nominate 1st, 2nd, and 3rd preference runners for this race.",
    };
  };

  const sortedMeetings = sortMeetingsByMetroPriority(meetings);
  const { sydneyMeeting, melbourneMeeting, combinedRequiredMeetings } =
    getSydneyAndMelbourneMeetings(sortedMeetings);

  const defaultSelectedIds =
    combinedRequiredMeetings.length > 0
      ? combinedRequiredMeetings.map((m) => m.id)
      : resolvedMeetingId
      ? [resolvedMeetingId]
      : sortedMeetings.slice(0, 2).map((m) => m.id);

  const [internalSelectedIds, setInternalSelectedIds] =
    useState<string[]>(defaultSelectedIds);

  useEffect(() => {
    setInternalSelectedIds((prev) => {
      const valid = prev.filter((id) => sortedMeetings.some((m) => m.id === id));
      return valid.length > 0 ? valid : defaultSelectedIds;
    });
  }, [meetings]);

  const activeSelectedIds = (
    controlledSelectedIds && controlledSelectedIds.length > 0
      ? controlledSelectedIds
      : internalSelectedIds
  ).filter((id) => sortedMeetings.some((m) => m.id === id));

  const effectiveSelectedIds =
    activeSelectedIds.length > 0 ? activeSelectedIds : defaultSelectedIds;

  const updateSelectedMeetingIds = (nextIds: string[]) => {
    const safeIds = nextIds.length > 0 ? nextIds : defaultSelectedIds;
    setInternalSelectedIds(safeIds);
    onChangeSelectedMeetingIds?.(safeIds);
    if (safeIds[0] && !safeIds.includes(resolvedMeetingId)) {
      onSelectMeeting(safeIds[0]);
    }
  };

  const toggleMeetingCheckbox = (id: string) => {
    if (effectiveSelectedIds.includes(id)) {
      if (effectiveSelectedIds.length > 1) {
        updateSelectedMeetingIds(
          effectiveSelectedIds.filter((item) => item !== id)
        );
      }
    } else {
      const nextSet = new Set([...effectiveSelectedIds, id]);
      const ordered = sortedMeetings
        .filter((m) => nextSet.has(m.id))
        .map((m) => m.id);
      updateSelectedMeetingIds(ordered);
    }
  };

  const activeMeetingsInScope: RaceMeeting[] = sortedMeetings.filter((m) =>
    effectiveSelectedIds.includes(m.id)
  );

  // Never cap at 8 races: always reflect all races scheduled for each location on that day
  const displayedMeetings: RaceMeeting[] = (
    activeMeetingsInScope.length > 0
      ? activeMeetingsInScope
      : sortedMeetings.slice(0, 1)
  ).map((m) => ({
    ...m,
    races: [...m.races].sort((a, b) => a.raceNumber - b.raceNumber),
  }));

  const activePunter =
    punters.find((p) => p.id === activePunterId) || punters[0];

  if (!activePunter || displayedMeetings.length === 0) return null;

  // Evaluate all punters across the active scope (only counting points/returns on completed races)
  const leaderboard = punters
    .map((punter) => {
      let totalPoints = 0;
      let totalDollarReturn = 0;
      let completedRaces = 0;
      let selectedRacesCount = 0;
      let resultedRacesCount = 0;
      let winnersPicked = 0;
      let podiumsPicked = 0;
      let totalRacesInScope = 0;

      const byVenue: Record<
        string,
        {
          points: number;
          dollars: number;
          completed: number;
          totalRaces: number;
          resultedRaces: number;
        }
      > = {};

      displayedMeetings.forEach((m) => {
        const mSelections = getPunterSelectionsForMeeting(punter, m);
        const jokerRaceNo = getPunterJokerForMeeting(punter, m);
        let vPoints = 0;
        let vDollars = 0;
        let vCompleted = 0;
        let vResulted = 0;

        m.races.forEach((race) => {
          totalRacesInScope += 1;
          const trio = mSelections[race.raceNumber];
          const isJoker = jokerRaceNo === race.raceNumber;
          const evaluated = evaluateRaceTrio(race, trio, m.date, isJoker);

          if (evaluated.isRaceResulted) {
            resultedRacesCount += 1;
            vResulted += 1;
          }
          if (evaluated.isComplete) {
            completedRaces += 1;
            vCompleted += 1;
          }
          if (evaluated.hasAnySelection) {
            selectedRacesCount += 1;
          }
          totalPoints += evaluated.racePointsTally;
          vPoints += evaluated.racePointsTally;
          totalDollarReturn = Number(
            (totalDollarReturn + evaluated.raceDollarReturn).toFixed(2)
          );
          vDollars = Number((vDollars + evaluated.raceDollarReturn).toFixed(2));

          if (evaluated.isRaceResulted) {
            evaluated.picks.forEach((pk) => {
              if (pk.finishPosition === 1) winnersPicked += 1;
              if (pk.finishPosition >= 1 && pk.finishPosition <= 3)
                podiumsPicked += 1;
            });
          }
        });

        byVenue[m.id] = {
          points: vPoints,
          dollars: vDollars,
          completed: vCompleted,
          totalRaces: m.races.length,
          resultedRaces: vResulted,
        };
      });

      return {
        punter,
        totalPoints,
        totalDollarReturn,
        completedRaces,
        selectedRacesCount,
        resultedRacesCount,
        totalRacesInScope,
        winnersPicked,
        podiumsPicked,
        byVenue,
      };
    })
    .sort((a, b) => {
      if (scoringMode === "dollars") {
        if (b.totalDollarReturn !== a.totalDollarReturn)
          return b.totalDollarReturn - a.totalDollarReturn;
        return b.totalPoints - a.totalPoints;
      }
      if (b.totalPoints !== a.totalPoints)
        return b.totalPoints - a.totalPoints;
      return b.totalDollarReturn - a.totalDollarReturn;
    });

  const activeSummary =
    leaderboard.find((l) => l.punter.id === activePunter.id) || leaderboard[0];

  const handleCreatePunter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPunterName.trim()) return;
    onAddPunter(newPunterName.trim(), newPunterRole.trim() || "Punter");
    setNewPunterName("");
    setShowAddMember(false);
  };

  const handleAutoFillRequiredScope = () => {
    displayedMeetings.forEach((m) => {
      if (onAutoFillCardForPunter) onAutoFillCardForPunter(activePunter.id, m);
      else if (onAutoFillCardSelections) onAutoFillCardSelections(activePunter.id, m.id);
    });
  };

  const handleClearRequiredScope = () => {
    displayedMeetings.forEach((m) => {
      if (onClearCardForPunter) onClearCardForPunter(activePunter.id, m.id);
      else if (onClearCardSelections) onClearCardSelections(activePunter.id, m.id);
    });
  };

  const handleAutoPickSingleRace = (race: RaceEvent, meetingId: string) => {
    const result = generateRaceAutoPickTrio(race.runners, race.raceNumber);
    if (result.firstPref) {
      onUpdateRaceSelection(
        activePunter.id,
        meetingId,
        race.raceNumber,
        1,
        result.firstPref
      );
    }
    if (result.secondPref) {
      onUpdateRaceSelection(
        activePunter.id,
        meetingId,
        race.raceNumber,
        2,
        result.secondPref
      );
    }
    if (result.thirdPref) {
      onUpdateRaceSelection(
        activePunter.id,
        meetingId,
        race.raceNumber,
        3,
        result.thirdPref
      );
    }
    onSaveConfirmation?.(`Auto-picked ${result.summaryText}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Venue Selection Scope Bar + Scoring Mode Toggle */}
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1F2D26] pb-4">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Select Race Cards / Locations (Check 1 or Multiple Cards):
                </span>
              </div>

              <RaceCardMultiSelectDropdown
                meetings={sortedMeetings}
                selectedMeetingIds={effectiveSelectedIds}
                onChangeSelectedMeetingIds={updateSelectedMeetingIds}
                punters={punters}
                labelPrefix="Betting Race Cards"
                compact
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Individual Venue Buttons with Checkboxes */}
              {sortedMeetings.map((m) => {
                const isChecked = effectiveSelectedIds.includes(m.id);
                const isMetro = isMainMetroVenue(m.venue, m.meetingCode);
                const firstR = m.races[0]?.raceNumber ?? 1;
                const lastR =
                  m.races[m.races.length - 1]?.raceNumber ?? m.races.length;

                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggleMeetingCheckbox(m.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 border cursor-pointer ${
                      isChecked
                        ? "bg-[#152920] text-[#F3F4F0] border-[#10B981] font-semibold shadow-sm"
                        : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26] hover:border-[#10B981] hover:text-[#F3F4F0]"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        isChecked
                          ? "bg-[#10B981] border-[#10B981] text-[#0B110E]"
                          : "bg-[#0B110E] border-[#52665B]"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isChecked
                          ? "bg-[#0B110E]/40 text-[#D4AF37]"
                          : isMetro
                          ? "bg-[#192620] text-[#D4AF37]"
                          : "bg-[#16201B] text-[#8A9990]"
                      }`}
                    >
                      {m.state} {isMetro ? "METRO" : "TAB"}
                    </span>
                    <span>{m.venue}</span>
                    <span className="font-mono text-[11px] opacity-85">
                      ({m.races.length}R · R{firstR}–R{lastR})
                    </span>
                  </button>
                );
              })}

              {/* Quick Preset: Sydney + Melbourne Default */}
              {combinedRequiredMeetings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedMeetingIds(
                      combinedRequiredMeetings.map((m) => m.id)
                    );
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border bg-[#0B110E] text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    Sydney &amp; Melb (
                    {sydneyMeeting ? sydneyMeeting.venue : "NSW"} +{" "}
                    {melbourneMeeting ? melbourneMeeting.venue : "VIC"})
                  </span>
                </button>
              )}

              {/* Quick Preset: Check All Cards */}
              {sortedMeetings.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedMeetingIds(sortedMeetings.map((m) => m.id))
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 border bg-[#0B110E] text-[#10B981] border-[#10B981]/40 hover:bg-[#10B981]/15 cursor-pointer"
                >
                  <span>Check All ({sortedMeetings.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Switch: Points vs $ Return */}
            <div
              role="group"
              aria-label="Scoring Mode Switch"
              className="flex items-center p-1 bg-[#0B110E] border border-[#1F2D26] rounded-md"
            >
              <button
                type="button"
                onClick={() => onToggleScoringMode("points")}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scoringMode === "points"
                    ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Points (3 / 2 / 1)</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleScoringMode("dollars")}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scoringMode === "dollars"
                    ? "bg-[#10B981] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>$ Return (Win/Place)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleJumpToResults}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#192620] border border-[#10B981]/50 text-[#10B981] text-xs font-semibold hover:bg-[#21332B] transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>View Selection Results Sheet</span>
            </button>
          </div>
        </div>

        {/* User / Punter Selector Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-[#8A9990]">
              Active Punter Making Selections
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {punters.map((p) => {
                const isSelected = p.id === activePunter.id;
                const summary = leaderboard.find((l) => l.punter.id === p.id);
                const metricBadge =
                  scoringMode === "dollars"
                    ? formatDollarReturn(summary?.totalDollarReturn ?? 0)
                    : `${summary?.totalPoints ?? 0} pts`;
                const normName = (p.name || "").trim().toLowerCase();
                const isDefaultCoreUser =
                  p.id === "punter-steve-f" ||
                  p.id === "punter-mark-s" ||
                  normName === "steve f" ||
                  normName === "mark s";
                const canRemoveUser =
                  Boolean(onRemovePunter) && !isDefaultCoreUser;

                return (
                  <div
                    key={p.id}
                    className={`min-h-[40px] rounded-md text-xs font-medium transition-colors flex items-center border overflow-hidden ${
                      isSelected
                        ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-semibold"
                        : "bg-[#0B110E] text-[#F3F4F0] border-[#1F2D26] hover:border-[#8A9990]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPunter(p.id)}
                      className="px-3.5 py-2 flex items-center gap-2 cursor-pointer"
                    >
                      <span>{p.name}</span>
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
                          isSelected
                            ? "bg-[#0B110E]/20 text-[#0B110E] font-bold"
                            : "bg-[#121A16] text-[#D4AF37]"
                        }`}
                      >
                        {summary?.completedRaces ?? 0}/
                        {summary?.totalRacesInScope ?? 8} R · {metricBadge}
                      </span>
                    </button>

                    {canRemoveUser && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePunter?.(p.id);
                        }}
                        title={`Remove user "${p.name}" from Punters Club`}
                        aria-label={`Remove user ${p.name}`}
                        className={`px-2 py-2 border-l transition-colors cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? "border-[#0B110E]/20 text-[#0B110E] hover:bg-[#EF4444] hover:text-white"
                            : "border-[#1F2D26] text-[#8A9990] hover:bg-[#EF4444]/20 hover:text-[#EF4444]"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowAddMember((prev) => !prev)}
                className="min-h-[40px] px-3 py-2 rounded-md text-xs font-medium bg-[#0B110E] text-[#10B981] border border-[#1F2D26] hover:border-[#10B981] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {showAddMember ? "Close User Manager" : "Add / Manage Users"}
                </span>
              </button>

              {onRemovePunter &&
                activePunter.id !== "punter-steve-f" &&
                activePunter.id !== "punter-mark-s" &&
                activePunter.name.trim().toLowerCase() !== "steve f" &&
                activePunter.name.trim().toLowerCase() !== "mark s" && (
                  <button
                    type="button"
                    onClick={() => onRemovePunter(activePunter.id)}
                    className="min-h-[40px] px-3 py-2 rounded-md text-xs font-medium bg-[#291414] text-[#EF4444] border border-[#EF4444]/40 hover:bg-[#EF4444] hover:text-[#0B110E] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title={`Remove user "${activePunter.name}"`}
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Remove {activePunter.name}</span>
                  </button>
                )}
            </div>
          </div>

          {/* Quick Actions for Active User's Scope */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onManualCloudSync?.()}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e3be42] transition-colors cursor-pointer shadow-sm"
              title="Immediately save and sync all user selections across all devices (iPad, Phone, Desktop)"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {cloudSyncState === "saving"
                  ? "Saving to Cloud..."
                  : `Save & Sync Selections${
                      lastSyncedTime ? ` (${lastSyncedTime})` : ""
                    }`}
              </span>
            </button>
            <button
              type="button"
              onClick={handleAutoFillRequiredScope}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#192620] border border-[#10B981]/40 text-[#10B981] text-xs font-medium hover:bg-[#21332B] transition-colors cursor-pointer"
              title="Auto-fill 3 top-rated TAB runners for every race in the selected scope"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Auto-Fill {displayedMeetings.length} Checked Card
                {displayedMeetings.length > 1 ? "s" : ""} (
                {activeSummary.totalRacesInScope} Races)
              </span>
            </button>
            <button
              type="button"
              onClick={handleClearRequiredScope}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:text-[#EF4444] hover:border-[#EF4444]/50 text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Scope Picks</span>
            </button>
          </div>
        </div>

        {showAddMember && (
          <div className="pt-3 border-t border-[#1F2D26] space-y-3">
            <form
              onSubmit={handleCreatePunter}
              className="flex flex-wrap items-end gap-3"
            >
              <div>
                <label className="block text-[11px] font-mono text-[#8A9990] mb-1">
                  New User Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Davo"
                  value={newPunterName}
                  onChange={(e) => setNewPunterName(e.target.value)}
                  className="bg-[#0B110E] border border-[#1F2D26] rounded px-3 py-1.5 text-xs text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#8A9990] mb-1">
                  Tag / Syndicate Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Form Analyst"
                  value={newPunterRole}
                  onChange={(e) => setNewPunterRole(e.target.value)}
                  className="bg-[#0B110E] border border-[#1F2D26] rounded px-3 py-1.5 text-xs text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#10B981] text-[#0B110E] text-xs font-semibold hover:bg-[#059669] transition-colors cursor-pointer"
              >
                Save &amp; Select User
              </button>
            </form>

            {onRemovePunter && punters.length > 1 && (
              <div className="p-2.5 rounded-md bg-[#0B110E] border border-[#1F2D26] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-[#8A9990]">
                  Manage / Remove Added Users:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {punters.map((p) => {
                    const normName = (p.name || "").trim().toLowerCase();
                    const isCore =
                      p.id === "punter-steve-f" ||
                      p.id === "punter-mark-s" ||
                      normName === "steve f" ||
                      normName === "mark s";
                    if (isCore) {
                      return (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 rounded bg-[#121A16] border border-[#1F2D26] text-[11px] font-mono text-[#8A9990]"
                        >
                          {p.name} (Core Syndicate Member — Protected)
                        </span>
                      );
                    }
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onRemovePunter(p.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#291414] border border-[#EF4444]/40 text-[11px] font-mono text-[#EF4444] hover:bg-[#EF4444] hover:text-[#0B110E] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove {p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active User Scope Summary & Progress Banner */}
        <div className="pt-3 border-t border-[#1F2D26] grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A9990]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[#F3F4F0] font-mono">
                1st = <strong className="text-[#D4AF37]">3 pts</strong> (+ 1u
                Win &amp; 1u Place $)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[#F3F4F0] font-mono">
                2nd = <strong className="text-[#F3F4F0]">2 pts</strong> (+ 1u
                Place $)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[#F3F4F0] font-mono">
                3rd = <strong className="text-[#10B981]">1 pt</strong> (+ 1u
                Place $, NTD if ≤7 runners)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#192620] border border-[#D4AF37]/50 text-[#D4AF37] font-mono font-semibold">
                🃏 Joker Round = <strong>2× Points</strong> for all successful selections (1st, 2nd, 3rd)!
              </span>
              <span className="text-[11px]">
                Showing {displayedMeetings.length} checked race card
                {displayedMeetings.length > 1 ? "s" : ""} (
                {displayedMeetings.map((m) => m.venue).join(" + ")} ·{" "}
                {activeSummary.totalRacesInScope} scheduled races).
              </span>
            </div>

            {/* Per-Venue Completion Progress Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {displayedMeetings.map((m) => {
                const vStat = activeSummary.byVenue[m.id] || {
                  points: 0,
                  dollars: 0,
                  completed: 0,
                  totalRaces: m.races.length,
                  resultedRaces: 0,
                };
                const isVenueDone =
                  vStat.completed === vStat.totalRaces && vStat.totalRaces > 0;

                return (
                  <div
                    key={m.id}
                    className={`px-3 py-1.5 rounded-md border text-xs font-mono flex items-center gap-2 ${
                      isVenueDone
                        ? "bg-[#152920] border-[#10B981]/50 text-[#10B981]"
                        : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        isVenueDone ? "text-[#10B981]" : "text-[#D4AF37]"
                      }`}
                    />
                    <span className="font-semibold">
                      {m.state === "NSW"
                        ? `NSW (${m.venue})`
                        : m.state === "VIC"
                        ? `VIC (${m.venue})`
                        : `${m.state} (${m.venue})`}
                      :
                    </span>
                    <span>
                      {vStat.completed}/{vStat.totalRaces} Races Picked
                    </span>
                    <span className="text-[#8A9990]">·</span>
                    <span className="text-[#8A9990]">
                      {vStat.resultedRaces}/{vStat.totalRaces} Completed
                    </span>
                    {vStat.resultedRaces > 0 && (
                      <>
                        <span className="text-[#8A9990]">·</span>
                        <span className="text-[#D4AF37] font-bold">
                          {scoringMode === "dollars"
                            ? formatDollarReturn(vStat.dollars)
                            : `${vStat.points} pts`}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] font-mono">
              <div className="text-[10px] uppercase text-[#8A9990]">
                {activePunter.name} {scoringMode === "dollars" ? "$ Return" : "Points"}
              </div>
              <div
                className={`text-lg font-bold tabular-nums mt-0.5 ${
                  activeSummary.resultedRacesCount === 0
                    ? "text-[#8A9990]"
                    : scoringMode === "dollars"
                    ? "text-[#10B981]"
                    : "text-[#D4AF37]"
                }`}
              >
                {activeSummary.resultedRacesCount === 0
                  ? "Pending"
                  : scoringMode === "dollars"
                  ? formatDollarReturn(activeSummary.totalDollarReturn)
                  : `${activeSummary.totalPoints} pts`}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] font-mono">
              <div className="text-[10px] uppercase text-[#8A9990]">
                Races Picked
              </div>
              <div
                className={`text-lg font-bold tabular-nums mt-0.5 ${
                  activeSummary.completedRaces ===
                  activeSummary.totalRacesInScope
                    ? "text-[#10B981]"
                    : "text-[#F3F4F0]"
                }`}
              >
                {activeSummary.completedRaces}/{activeSummary.totalRacesInScope}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] font-mono">
              <div className="text-[10px] uppercase text-[#8A9990]">
                Resulted Races
              </div>
              <div className="text-lg font-bold text-[#10B981] tabular-nums mt-0.5">
                {activeSummary.resultedRacesCount}/
                {activeSummary.totalRacesInScope}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Selection Matrix for Each Displayed Venue Card (All Scheduled Races 1..N) */}
      {displayedMeetings.map((meetingCard) => {
        const cardSelections = getPunterSelectionsForMeeting(
          activePunter,
          meetingCard
        );
        const activeJokerRaceNo = getPunterJokerForMeeting(
          activePunter,
          meetingCard
        );
        const featureRaceObj = getFeatureRaceForMeeting(meetingCard);
        const featureRaceNo = getFeatureRaceNumberForMeeting(meetingCard);
        const venueStat = activeSummary.byVenue[meetingCard.id] || {
          points: 0,
          dollars: 0,
          completed: 0,
          totalRaces: meetingCard.races.length,
          resultedRaces: 0,
        };
        const firstRaceNum = meetingCard.races[0]?.raceNumber ?? 1;
        const lastRaceNum =
          meetingCard.races[meetingCard.races.length - 1]?.raceNumber ??
          meetingCard.races.length;

        return (
          <div
            key={meetingCard.id}
            className="bg-[#121A16] border border-[#1F2D26] rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#1F2D26] space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-[#192620] border border-[#10B981]/40 text-[#10B981] font-mono text-xs font-bold">
                    {meetingCard.state} · {meetingCard.races.length} RACES (R
                    {firstRaceNum}–R{lastRaceNum})
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[#F3F4F0]">
                      {meetingCard.venue} ({meetingCard.date}) —{" "}
                      <span className="text-[#D4AF37]">
                        {activePunter.name}
                      </span>
                    </h2>
                    <p className="text-xs text-[#8A9990]">
                      Select 3 horses in order of preference (1st, 2nd, 3rd)
                      across all {meetingCard.races.length} scheduled races at{" "}
                      {meetingCard.venue} ({venueStat.resultedRaces} of{" "}
                      {meetingCard.races.length} races completed).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher */}
                  <div className="flex items-center gap-0.5 bg-[#0B110E] p-0.5 rounded-lg border border-[#1F2D26]">
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("cards")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        selectionViewMode === "cards"
                          ? "bg-[#D4AF37] text-[#0B110E] shadow-sm"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>All Race Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("stepper")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        selectionViewMode === "stepper"
                          ? "bg-[#D4AF37] text-[#0B110E] shadow-sm"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Race Focus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("table")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        selectionViewMode === "table"
                          ? "bg-[#D4AF37] text-[#0B110E] shadow-sm"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Full Table</span>
                    </button>
                  </div>

                  <span className="px-2 py-1 rounded bg-[#0B110E] border border-[#10B981]/40 text-[11px] font-mono text-[#10B981]">
                    ✓ TAB Auto-Sub Active
                  </span>
                  <span className="font-mono text-xs text-[#D4AF37] font-semibold">
                    {venueStat.completed}/{venueStat.totalRaces} Picked ·{" "}
                    {venueStat.resultedRaces === 0
                      ? "Awaiting Result"
                      : scoringMode === "dollars"
                      ? formatDollarReturn(venueStat.dollars)
                      : `${venueStat.points} pts`}
                  </span>
                  <button
                    type="button"
                    onClick={handleJumpToResults}
                    className="text-xs font-semibold text-[#10B981] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Live Results →
                  </button>
                </div>
              </div>

              {/* JOKER ROUND SELECTOR BAR FOR THIS MEETING */}
              <div className="p-2.5 rounded-lg bg-[#0B110E] border border-[#D4AF37]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#0B110E] font-mono text-[11px] font-bold uppercase whitespace-nowrap">
                    🃏 Joker Round (2× Points)
                  </span>
                  <span className="text-xs text-[#D5DDD8]">
                    Defaults to{" "}
                    <strong className="text-[#D4AF37]">
                      Feature Race R{featureRaceNo ?? "-"}
                      {featureRaceObj ? ` (${featureRaceObj.raceName})` : ""}
                    </strong>{" "}
                    for <strong className="text-[#D4AF37]">{activePunter.name}</strong>{" "}
                    — earn{" "}
                    <strong className="text-[#10B981]">
                      double points (2×)
                    </strong>{" "}
                    for all successful selections (1st, 2nd, or 3rd)!
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {meetingCard.races.map((r) => {
                    const isJokerSelected = activeJokerRaceNo === r.raceNumber;
                    const isFeature = featureRaceNo === r.raceNumber;
                    return (
                      <button
                        key={r.raceNumber}
                        type="button"
                        onClick={() =>
                          onToggleJokerRace?.(
                            activePunter.id,
                            meetingCard.id,
                            isJokerSelected ? null : r.raceNumber
                          )
                        }
                        className={`px-2.5 py-1 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border ${
                          isJokerSelected
                            ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-bold shadow-sm"
                            : isFeature
                            ? "bg-[#192620] text-[#D4AF37] border-[#D4AF37]/50 hover:border-[#D4AF37]"
                            : "bg-[#121A16] text-[#8A9990] border-[#1F2D26] hover:border-[#D4AF37] hover:text-[#F3F4F0]"
                        }`}
                        title={
                          isJokerSelected
                            ? `Race ${r.raceNumber}${isFeature ? " (Feature Race)" : ""} is ${activePunter.name}'s Joker Round (Click to clear)`
                            : `Set Race ${r.raceNumber}${isFeature ? " (Feature Race)" : ""} as ${activePunter.name}'s Joker Round (2× Points for all successful selections)`
                        }
                      >
                        {isJokerSelected
                          ? `🃏 R${r.raceNumber}${isFeature ? " ★" : ""} (2×)`
                          : `R${r.raceNumber}${isFeature ? " ★" : ""}`}
                      </button>
                    );
                  })}
                  {featureRaceNo !== null &&
                    activeJokerRaceNo !== featureRaceNo && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleJokerRace?.(
                            activePunter.id,
                            meetingCard.id,
                            featureRaceNo
                          )
                        }
                        className="px-2 py-1 rounded text-[11px] font-mono text-[#D4AF37] hover:underline cursor-pointer"
                      >
                        Reset to Feature (R{featureRaceNo})
                      </button>
                    )}
                  {activeJokerRaceNo !== null && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleJokerRace?.(activePunter.id, meetingCard.id, null)
                      }
                      className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#EF4444] cursor-pointer"
                    >
                      Clear Joker
                    </button>
                  )}
                </div>
              </div>

              {/* Race Stepper Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {meetingCard.races.map((r) => {
                  const isJoker = activeJokerRaceNo === r.raceNumber;
                  const isFeature = featureRaceNo === r.raceNumber;
                  const isCurrentActive =
                    (activeRacePerMeeting[meetingCard.id] ??
                      meetingCard.races[0]?.raceNumber) === r.raceNumber;
                  const ev = evaluateRaceTrio(
                    r,
                    cardSelections[r.raceNumber],
                    meetingCard.date,
                    isJoker
                  );
                  const pickCount = [
                    cardSelections[r.raceNumber]?.firstPref,
                    cardSelections[r.raceNumber]?.secondPref,
                    cardSelections[r.raceNumber]?.thirdPref,
                  ].filter(Boolean).length;

                  return (
                    <button
                      key={r.raceNumber}
                      type="button"
                      onClick={() => {
                        setActiveRacePerMeeting((prev) => ({
                          ...prev,
                          [meetingCard.id]: r.raceNumber,
                        }));
                        if (selectionViewMode === "cards") {
                          const el = document.getElementById(
                            `race-card-${meetingCard.id}-${r.raceNumber}`
                          );
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-mono text-xs tabular-nums shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrentActive
                          ? "bg-[#262010] border-[#D4AF37] text-[#D4AF37] font-bold shadow-sm"
                          : ev.isComplete
                          ? "bg-[#152920] border-[#10B981]/40 text-[#10B981] hover:border-[#10B981]"
                          : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37]/40 hover:text-[#F3F4F0]"
                      }`}
                    >
                      <span>
                        {isJoker ? "🃏 " : ""}R{r.raceNumber}
                        {isFeature ? " ★" : ""}
                      </span>
                      <span className="text-[10px]">
                        {ev.isComplete ? (
                          <strong className="text-[#10B981]">3/3 ✓</strong>
                        ) : pickCount > 0 ? (
                          <span className="text-[#D4AF37]">{pickCount}/3</span>
                        ) : (
                          "Pick 3"
                        )}
                        {ev.isRaceResulted ? " • Fin" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* View Mode Switching: Cards (Default) vs Stepper vs Table */}
            {selectionViewMode === "cards" ? (
              <div className="p-3 sm:p-4 space-y-4">
                {meetingCard.races.map((race) => {
                  const rawTrio = cardSelections[race.raceNumber];
                  const { effectiveTrio: trio } = resolveAutoSubForRaceTrio(
                    race,
                    rawTrio,
                    true
                  );
                  const isJokerRace = activeJokerRaceNo === race.raceNumber;
                  const isFeature = featureRaceNo === race.raceNumber;
                  const evaluated = evaluateRaceTrio(
                    race,
                    trio,
                    meetingCard.date,
                    isJokerRace
                  );
                  const speedAndFlucs = computeRaceSpeedMapAndFlucs(race);
                  const pickCount = [
                    trio?.firstPref,
                    trio?.secondPref,
                    trio?.thirdPref,
                  ].filter(Boolean).length;

                  const sel1Runner = race.runners.find(
                    (r) => r.tabNumber === trio?.firstPref
                  );
                  const sel2Runner = race.runners.find(
                    (r) => r.tabNumber === trio?.secondPref
                  );
                  const sel3Runner = race.runners.find(
                    (r) => r.tabNumber === trio?.thirdPref
                  );

                  return (
                    <div
                      key={race.raceNumber}
                      id={`race-card-${meetingCard.id}-${race.raceNumber}`}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isJokerRace
                          ? "border-[#D4AF37]/70 bg-[#0F1713] shadow-[0_4px_24px_rgba(212,175,55,0.08)] ring-1 ring-[#D4AF37]/30"
                          : "border-[#1F2D26] bg-[#0E1612] hover:border-[#2E4237]"
                      }`}
                    >
                      {/* Race Card Header */}
                      <div className="px-4 py-3 bg-[#080E0B] border-b border-[#1F2D26] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-md bg-[#192620] border border-[#2A3F33] text-[#F3F4F0] font-mono font-black text-sm tracking-wide">
                            R{race.raceNumber}
                          </span>
                          <span className="font-display font-bold text-base text-[#F3F4F0]">
                            {race.raceName}
                          </span>

                          {isFeature && (
                            <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37] text-[10px] font-mono font-bold uppercase tracking-wider">
                              ★ FEATURE RACE
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              evaluated.isRaceResulted
                                ? "bg-[#152920] text-[#10B981] border border-[#10B981]/40"
                                : "bg-[#192620] text-[#D4AF37] border border-[#D4AF37]/40"
                            }`}
                          >
                            {evaluated.isRaceResulted ? "OFFICIAL FINAL" : "UPCOMING"}
                          </span>

                          <span className="text-xs text-[#8A9990] font-mono">
                            Jumps {race.startTime} · {race.distance}m · Track: {meetingCard.trackCondition || "Good 4"} · Rail: {meetingCard.railPosition || "True"}
                          </span>
                        </div>

                        {/* Quick Controls & Joker Toggle */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Pick Count Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F1B15] border border-[#23352C] text-xs font-mono">
                            <span className="text-[#8A9990]">Picks:</span>
                            {pickCount === 3 ? (
                              <span className="text-[#10B981] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>3/3 Complete</span>
                              </span>
                            ) : (
                              <span className="text-[#D4AF37] font-semibold">
                                {pickCount}/3 Selected
                              </span>
                            )}
                          </div>

                          {/* Joker Toggle */}
                          <button
                            type="button"
                            onClick={() =>
                              onToggleJokerRace?.(
                                activePunter.id,
                                meetingCard.id,
                                isJokerRace ? null : race.raceNumber
                              )
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                              isJokerRace
                                ? "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                                : "bg-[#0B110E] text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15"
                            }`}
                          >
                            <span>🃏</span>
                            <span>{isJokerRace ? "Joker 2× Active" : "Set Joker 2×"}</span>
                          </button>

                          {/* Auto Pick Top 3 Consensus */}
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyStrategyToRace(
                                activePunter.id,
                                meetingCard.id,
                                race,
                                "market-consensus"
                              )
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-mono text-[#8A9990] hover:text-[#D4AF37] bg-[#0B110E] border border-[#1F2D26] hover:border-[#D4AF37]/40 transition cursor-pointer"
                            title="Auto-select top 3 market favourites"
                          >
                            Consensus
                          </button>

                          {/* Clear Picks for this race */}
                          {pickCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleClearRacePicks(
                                  activePunter.id,
                                  meetingCard.id,
                                  race.raceNumber
                                )
                              }
                              className="px-2 py-1 rounded-lg text-xs font-mono text-[#8A9990] hover:text-rose-400 bg-[#0B110E] border border-[#1F2D26] hover:border-rose-500/40 transition cursor-pointer"
                              title="Clear picks for this race"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Selection Summary Pill Bar */}
                      {pickCount > 0 && (
                        <div className="px-4 py-2 bg-[#0B1410] border-b border-[#1A2820] flex items-center gap-2.5 text-xs font-mono overflow-x-auto">
                          <span className="text-[#8A9990] shrink-0 font-medium">Your Selections:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                                sel1Runner
                                  ? "bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]"
                                  : "bg-[#14201A] text-[#6E8075]"
                              }`}
                            >
                              <strong className="text-[#D4AF37]">1st:</strong>{" "}
                              {sel1Runner
                                ? `#${sel1Runner.tabNumber} ${sel1Runner.horseName}`
                                : "—"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                                sel2Runner
                                  ? "bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8]"
                                  : "bg-[#14201A] text-[#6E8075]"
                              }`}
                            >
                              <strong className="text-[#38BDF8]">2nd:</strong>{" "}
                              {sel2Runner
                                ? `#${sel2Runner.tabNumber} ${sel2Runner.horseName}`
                                : "—"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                                sel3Runner
                                  ? "bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981]"
                                  : "bg-[#14201A] text-[#6E8075]"
                              }`}
                            >
                              <strong className="text-[#10B981]">3rd:</strong>{" "}
                              {sel3Runner
                                ? `#${sel3Runner.tabNumber} ${sel3Runner.horseName}`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Result Banner if resulted */}
                      {evaluated.isRaceResulted && (
                        <div className="px-4 py-2 bg-[#12221A] border-b border-[#10B981]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[#10B981] font-bold">Official Placings:</span>
                            <span className="text-[#F3F4F0]">
                              1st #{race.runners.find((r) => r.finishPosition === 1)?.tabNumber}{" "}
                              {race.runners.find((r) => r.finishPosition === 1)?.horseName} ·{" "}
                              2nd #{race.runners.find((r) => r.finishPosition === 2)?.tabNumber}{" "}
                              {race.runners.find((r) => r.finishPosition === 2)?.horseName} ·{" "}
                              3rd #{race.runners.find((r) => r.finishPosition === 3)?.tabNumber}{" "}
                              {race.runners.find((r) => r.finishPosition === 3)?.horseName}
                            </span>
                          </div>
                          <div className="text-right font-bold text-[#D4AF37]">
                            {scoringMode === "dollars"
                              ? formatDollarReturn(evaluated.raceDollarReturn)
                              : `${evaluated.racePointsTally} pts`}
                            {evaluated.jokerTriggered && " (🃏 2× Joker!)"}
                          </div>
                        </div>
                      )}

                      {/* Runners Table with 3 Selection Columns on Far Right */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#1F2D26] bg-[#0A120E] text-[11px] font-mono text-[#8A9990] uppercase tracking-wider">
                              <th className="py-2.5 px-3 w-12 text-center">#</th>
                              <th className="py-2.5 px-3 min-w-[170px]">Runner</th>
                              <th className="py-2.5 px-3 min-w-[220px]">Form &amp; Brief Analysis</th>
                              <th className="py-2.5 px-3 w-36 text-center">Odds &amp; Dynamics</th>
                              <th className="py-2.5 px-2 w-24 text-center bg-[#16140C]/80 border-l border-[#262010]">
                                <span className="text-[#D4AF37] font-bold block">1st Pref</span>
                                <span className="text-[9px] text-[#A6882C] lowercase font-normal">Selection 1</span>
                              </th>
                              <th className="py-2.5 px-2 w-24 text-center bg-[#0B1520]/80 border-l border-[#142334]">
                                <span className="text-[#38BDF8] font-bold block">2nd Pref</span>
                                <span className="text-[9px] text-[#227299] lowercase font-normal">Selection 2</span>
                              </th>
                              <th className="py-2.5 px-2 w-24 text-center bg-[#0B1A14]/80 border-l border-[#132A22]">
                                <span className="text-[#10B981] font-bold block">3rd Pref</span>
                                <span className="text-[9px] text-[#0C805A] lowercase font-normal">Selection 3</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#17231D] text-xs">
                            {race.runners.map((runner) => {
                              const isScratched =
                                runner.isScratched || runner.margin === "SCR";
                              const fluc = speedAndFlucs.byTabNumber[runner.tabNumber];
                              const speedMapPos =
                                fluc?.speedMapPosition ||
                                runner.speedMapPosition ||
                                "Midfield";
                              const comment = getRunnerBriefComment(
                                runner,
                                speedMapPos,
                                fluc
                              );

                              const is1st = trio?.firstPref === runner.tabNumber;
                              const is2nd = trio?.secondPref === runner.tabNumber;
                              const is3rd = trio?.thirdPref === runner.tabNumber;
                              const isSelected = is1st || is2nd || is3rd;

                              const winOdds =
                                Number(runner.fixedWin || runner.nswTabWin) || 0;
                              const placeOdds =
                                Number(runner.fixedPlace || runner.nswTabPlace) ||
                                (winOdds > 1
                                  ? Number((1 + (winOdds - 1) * 0.25).toFixed(2))
                                  : 0);

                              const finishPos = evaluated.isRaceResulted
                                ? runner.finishPosition
                                : 0;

                              return (
                                <tr
                                  key={runner.tabNumber}
                                  className={`transition-colors ${
                                    isScratched
                                      ? "opacity-40 bg-[#080D0B]"
                                      : isSelected
                                      ? is1st
                                        ? "bg-[#211B0D]/70 hover:bg-[#282110]"
                                        : is2nd
                                        ? "bg-[#0F1D2A]/70 hover:bg-[#142537]"
                                        : "bg-[#0E221B]/70 hover:bg-[#122A22]"
                                      : "hover:bg-[#121B16]"
                                  }`}
                                >
                                  {/* Tab Number Badge */}
                                  <td className="py-3 px-3 text-center align-middle">
                                    <span
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded font-mono font-black text-xs ${
                                        isSelected
                                          ? is1st
                                            ? "bg-[#D4AF37] text-[#070B09] shadow-sm font-black"
                                            : is2nd
                                            ? "bg-[#38BDF8] text-[#070B09] shadow-sm font-black"
                                            : "bg-[#10B981] text-[#070B09] shadow-sm font-black"
                                          : "bg-[#15221B] text-[#D5DDD8] border border-[#23352C]"
                                      }`}
                                    >
                                      {runner.tabNumber}
                                    </span>
                                  </td>

                                  {/* Runner Info */}
                                  <td className="py-3 px-3 align-middle">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`font-display font-bold text-sm ${
                                          isSelected
                                            ? "text-[#F3F4F0]"
                                            : "text-[#E1E7E3]"
                                        }`}
                                      >
                                        {runner.horseName}
                                      </span>
                                      {isScratched && (
                                        <span className="px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-mono text-[9px] font-bold">
                                          SCR
                                        </span>
                                      )}
                                      {finishPos === 1 && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                          1st 🏆
                                        </span>
                                      )}
                                      {finishPos === 2 && (
                                        <span className="px-1.5 py-0.2 rounded bg-slate-500/20 text-slate-300 font-mono text-[10px] font-bold">
                                          2nd 🥈
                                        </span>
                                      )}
                                      {finishPos === 3 && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-700/20 text-amber-400 font-mono text-[10px] font-bold">
                                          3rd 🥉
                                        </span>
                                      )}
                                      <RunnerAiAnalysisButton
                                        runner={runner}
                                        race={race}
                                        meeting={meetingCard}
                                        size="xs"
                                      />
                                    </div>
                                    <div className="text-[11px] text-[#8A9990] font-mono mt-0.5">
                                      <span>
                                        B{runner.barrier} ·{" "}
                                        {runner.weight ? `${runner.weight}kg · ` : ""}
                                        {runner.jockey || "Jockey TBA"}
                                      </span>
                                      {runner.trainer && (
                                        <span className="text-[#64756B]">
                                          {" "}
                                          (T: {runner.trainer})
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Form & Brief Analysis */}
                                  <td className="py-3 px-3 align-middle">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-1.5 py-0.5 rounded bg-[#16231D] border border-[#26382F] font-mono text-[10px] font-semibold text-[#D5DDD8]">
                                          Form: {runner.form || "—"}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                            speedMapPos === "Leader"
                                              ? "bg-amber-950/60 text-amber-300 border border-amber-600/30"
                                              : speedMapPos === "On Pace"
                                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-600/30"
                                              : speedMapPos === "Midfield"
                                              ? "bg-sky-950/60 text-sky-300 border border-sky-600/30"
                                              : "bg-purple-950/60 text-purple-300 border border-purple-600/30"
                                          }`}
                                        >
                                          {speedMapPos}
                                        </span>
                                        <RunnerAiAnalysisButton
                                          runner={runner}
                                          race={race}
                                          meeting={meetingCard}
                                          size="xs"
                                        />
                                      </div>
                                      <p className="text-[11px] text-[#A6B5AD] leading-relaxed">
                                        {comment}
                                      </p>
                                    </div>
                                  </td>

                                  {/* Odds Dynamics & Current Price */}
                                  <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                    <div className="font-mono">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className="font-bold text-sm text-[#F3F4F0]">
                                          {winOdds > 0 ? `$${winOdds.toFixed(2)}` : "—"}
                                        </span>
                                        {placeOdds > 0 && (
                                          <span className="text-[10px] text-[#8A9990]">
                                            / ${placeOdds.toFixed(2)}
                                          </span>
                                        )}
                                        <OddsTrendIndicator
                                          currentOdds={winOdds}
                                          previousOdds={runner.previousOdds}
                                          openingOdds={runner.openingOdds || fluc?.openingOdds}
                                          marketSupport={fluc?.marketSupport || runner.marketSupport}
                                          flucs={runner.flucs}
                                          size="xs"
                                          showLabel={false}
                                        />
                                      </div>
                                      <div className="mt-1 flex items-center justify-center">
                                        <TactileOddsFlucBadge
                                          openingOdds={runner.openingOdds || fluc?.openingOdds}
                                          previousOdds={runner.previousOdds}
                                          currentOdds={winOdds}
                                          marketSupport={fluc?.marketSupport || runner.marketSupport}
                                          flucs={runner.flucs}
                                          size="sm"
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Selection 1 Column Checkbox */}
                                  <td className="py-3 px-2 text-center align-middle bg-[#16140C]/50 border-l border-[#262010]">
                                    <button
                                      type="button"
                                      disabled={isScratched}
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          race.raceNumber,
                                          1,
                                          runner.tabNumber
                                        )
                                      }
                                      aria-label={`Select #${runner.tabNumber} ${runner.horseName} as Selection 1`}
                                      className={`w-14 h-9 mx-auto rounded-lg border font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#1F2D26]"
                                          : is1st
                                          ? "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.5)] scale-105"
                                          : "bg-[#0B120E] border-[#2A3F33] text-[#6E8075] hover:border-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#1A180E]"
                                      }`}
                                    >
                                      {is1st ? (
                                        <>
                                          <Check className="w-4 h-4 stroke-[3]" />
                                          <span>1st</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#55695D]">1st</span>
                                      )}
                                    </button>
                                  </td>

                                  {/* Selection 2 Column Checkbox */}
                                  <td className="py-3 px-2 text-center align-middle bg-[#0B1520]/50 border-l border-[#142334]">
                                    <button
                                      type="button"
                                      disabled={isScratched}
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          race.raceNumber,
                                          2,
                                          runner.tabNumber
                                        )
                                      }
                                      aria-label={`Select #${runner.tabNumber} ${runner.horseName} as Selection 2`}
                                      className={`w-14 h-9 mx-auto rounded-lg border font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#1F2D26]"
                                          : is2nd
                                          ? "bg-[#38BDF8] text-[#070B09] border-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.5)] scale-105"
                                          : "bg-[#0B120E] border-[#2A3F33] text-[#6E8075] hover:border-[#38BDF8] hover:text-[#38BDF8] hover:bg-[#0E1A26]"
                                      }`}
                                    >
                                      {is2nd ? (
                                        <>
                                          <Check className="w-4 h-4 stroke-[3]" />
                                          <span>2nd</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#55695D]">2nd</span>
                                      )}
                                    </button>
                                  </td>

                                  {/* Selection 3 Column Checkbox */}
                                  <td className="py-3 px-2 text-center align-middle bg-[#0B1A14]/50 border-l border-[#132A22]">
                                    <button
                                      type="button"
                                      disabled={isScratched}
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          race.raceNumber,
                                          3,
                                          runner.tabNumber
                                        )
                                      }
                                      aria-label={`Select #${runner.tabNumber} ${runner.horseName} as Selection 3`}
                                      className={`w-14 h-9 mx-auto rounded-lg border font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#1F2D26]"
                                          : is3rd
                                          ? "bg-[#10B981] text-[#070B09] border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-105"
                                          : "bg-[#0B120E] border-[#2A3F33] text-[#6E8075] hover:border-[#10B981] hover:text-[#10B981] hover:bg-[#0E1E18]"
                                      }`}
                                    >
                                      {is3rd ? (
                                        <>
                                          <Check className="w-4 h-4 stroke-[3]" />
                                          <span>3rd</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#55695D]">3rd</span>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : selectionViewMode === "stepper" ? (
              (() => {
                const curActiveRaceNo =
                  activeRacePerMeeting[meetingCard.id] ??
                  meetingCard.races[0]?.raceNumber ??
                  1;
                const activeRace =
                  meetingCard.races.find(
                    (r) => r.raceNumber === curActiveRaceNo
                  ) || meetingCard.races[0];
                const activeTrio = cardSelections[activeRace.raceNumber];
                const isJokerOnActiveRace =
                  activeJokerRaceNo === activeRace.raceNumber;
                const consensusInfo = evaluateSyndicateConsensus(
                  meetingCard,
                  activeRace
                );
                const isHarvilleExpanded = Boolean(
                  expandedHarvilleRaces[
                    `${meetingCard.id}-${activeRace.raceNumber}`
                  ]
                );
                const speedAndFlucs = computeRaceSpeedMapAndFlucs(activeRace);
                const activeEvaluated = evaluateRaceTrio(
                  activeRace,
                  activeTrio,
                  meetingCard.date,
                  isJokerOnActiveRace
                );

                return (
                  <div className="p-4 space-y-3.5">
                    {/* Active Race Header Strip */}
                    <div className="rounded-xl border border-[#23352C] bg-[#0E1813] p-4 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1F2D26] pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-base font-bold text-[#F3F4F0]">
                              Race {activeRace.raceNumber}: {activeRace.raceName}
                            </span>
                            {featureRaceNo === activeRace.raceNumber && (
                              <span className="px-2 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] text-[10px] font-mono font-bold uppercase">
                                ★ FEATURE RACE
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                activeEvaluated.isRaceResulted
                                  ? "bg-[#152920] text-[#10B981] border border-[#10B981]/40"
                                  : "bg-[#192620] text-[#D4AF37] border border-[#D4AF37]/40"
                              }`}
                            >
                              {activeEvaluated.isRaceResulted
                                ? "OFFICIAL FINAL"
                                : "UPCOMING"}
                            </span>
                          </div>
                          <p className="text-xs text-[#8A9990] font-mono mt-1">
                            Jumps {activeRace.startTime} · {activeRace.distance}m · Track:{" "}
                            {meetingCard.trackCondition || "Good 4"} · Rail:{" "}
                            {meetingCard.railPosition || "True"}
                          </p>
                        </div>

                        {/* Quick Action Controls */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleJokerRace?.(
                                activePunter.id,
                                meetingCard.id,
                                isJokerOnActiveRace ? null : activeRace.raceNumber
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                              isJokerOnActiveRace
                                ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                                : "bg-[#0B110E] text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15"
                            }`}
                          >
                            {isJokerOnActiveRace
                              ? "🃏 Joker 2× Active"
                              : "🃏 Play Joker (2×)"}
                          </button>

                          {/* Smart Strategy Auto-Pick Bar */}
                          <div className="flex items-center gap-1 bg-[#0B110E] p-1 rounded-lg border border-[#1F2D26]">
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyStrategyToRace(
                                  activePunter.id,
                                  meetingCard.id,
                                  activeRace,
                                  "market-consensus"
                                )
                              }
                              className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#D4AF37] hover:bg-[#192620] transition cursor-pointer"
                              title="Pick top 3 favourites in market order"
                            >
                              Consensus
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyStrategyToRace(
                                  activePunter.id,
                                  meetingCard.id,
                                  activeRace,
                                  "value-hunter"
                                )
                              }
                              className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#10B981] hover:bg-[#192620] transition cursor-pointer"
                              title="Pick $3.50-$12 value contenders"
                            >
                              Value
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyStrategyToRace(
                                  activePunter.id,
                                  meetingCard.id,
                                  activeRace,
                                  "front-runner"
                                )
                              }
                              className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#38BDF8] hover:bg-[#192620] transition cursor-pointer"
                              title="Pick low barrier speed map leaders"
                            >
                              Speed
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyStrategyToRace(
                                  activePunter.id,
                                  meetingCard.id,
                                  activeRace,
                                  "balanced"
                                )
                              }
                              className="px-2.5 py-1 rounded text-[11px] font-mono font-bold text-[#10B981] bg-[#152920] hover:bg-[#1c362a] transition cursor-pointer inline-flex items-center gap-1"
                              title="Randomly pick 1 top-3 favourite + 2 other runners"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Auto</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleHarvilleModel(meetingCard.id, activeRace.raceNumber)
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer inline-flex items-center gap-1.5 ${
                              isHarvilleExpanded
                                ? "bg-[#152920] border-[#10B981] text-[#10B981]"
                                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                            }`}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>{isHarvilleExpanded ? "Hide Analytics" : "Win Likelihood"}</span>
                          </button>

                          {(activeTrio?.firstPref ||
                            activeTrio?.secondPref ||
                            activeTrio?.thirdPref) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleClearRacePicks(
                                  activePunter.id,
                                  meetingCard.id,
                                  activeRace.raceNumber
                                )
                              }
                              className="px-2 py-1 rounded text-[11px] font-mono text-[#8A9990] hover:text-[#EF4444] transition cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Official Placegetters (if resulted) */}
                      {activeEvaluated.isRaceResulted && (
                        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#10B981]/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[#10B981] font-bold">Official Placings:</span>
                            {activeRace.runners
                              .filter((r) => r.finishPosition >= 1 && r.finishPosition <= 3)
                              .sort((a, b) => a.finishPosition - b.finishPosition)
                              .map((r) => (
                                <span key={r.tabNumber} className="text-[#F3F4F0]">
                                  <strong
                                    className={
                                      r.finishPosition === 1
                                        ? "text-[#D4AF37]"
                                        : r.finishPosition === 2
                                        ? "text-slate-200"
                                        : "text-[#10B981]"
                                    }
                                  >
                                    {r.finishPosition === 1
                                      ? "1st"
                                      : r.finishPosition === 2
                                      ? "2nd"
                                      : "3rd"}
                                    :
                                  </strong>{" "}
                                  #{r.tabNumber} {r.horseName} (W $
                                  {(Number(r.nswTabWin) || 0).toFixed(2)} / P $
                                  {(Number(r.nswTabPlace) || 0).toFixed(2)})
                                </span>
                              ))}
                          </div>
                          <div className="text-right">
                            <span className="text-[#8A9990]">Punter Return: </span>
                            <strong className="text-[#10B981] text-sm">
                              {scoringMode === "dollars"
                                ? formatDollarReturn(activeEvaluated.raceDollarReturn)
                                : `${activeEvaluated.racePointsTally} pts`}
                            </strong>
                          </div>
                        </div>
                      )}

                      {/* Syndicate Consensus & Clash Banner */}
                      {consensusInfo && (
                        <div
                          className={`px-3.5 py-2.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-2.5 ${
                            consensusInfo.type === "consensus"
                              ? "bg-[#262010] border-[#D4AF37] text-[#D4AF37]"
                              : consensusInfo.type === "clash"
                              ? "bg-[#1E1925] border-purple-500/50 text-purple-200"
                              : "bg-[#121A16] border-[#1F2D26] text-[#8A9990]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {consensusInfo.type === "consensus" ? (
                              <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
                            ) : consensusInfo.type === "clash" ? (
                              <Swords className="w-4 h-4 text-purple-400 shrink-0" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-[#8A9990] shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-[#F3F4F0] mr-2">
                                {consensusInfo.headline}:
                              </span>
                              <span>{consensusInfo.text}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Deep Analysis Drawer (Harville Win Probabilities) */}
                      {isHarvilleExpanded && (
                        <div className="p-3 bg-[#0B110E] rounded-lg border border-[#1F2D26] space-y-3">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#10B981] font-bold">
                              Runner Win Likelihood Analytics
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                toggleHarvilleModel(meetingCard.id, activeRace.raceNumber)
                              }
                              className="text-[#8A9990] hover:text-[#F3F4F0] text-[11px] cursor-pointer"
                            >
                              Close Analytics ✕
                            </button>
                          </div>
                          <HarvillePlackettLuceModel race={activeRace} compact />
                        </div>
                      )}

                      {/* High-Density Quick-Pick Runner Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                        {activeRace.runners.map((runner) => {
                          const is1st = activeTrio?.firstPref === runner.tabNumber;
                          const is2nd = activeTrio?.secondPref === runner.tabNumber;
                          const is3rd = activeTrio?.thirdPref === runner.tabNumber;
                          const rf = speedAndFlucs.byTabNumber[runner.tabNumber];
                          const mapShort = rf
                            ? rf.speedMapPosition === "Leader"
                              ? "Lead"
                              : rf.speedMapPosition === "On Pace"
                              ? "Pace"
                              : rf.speedMapPosition === "Midfield"
                              ? "Mid"
                              : "Back"
                            : "";

                          // Syndicate user picks on this runner
                          const steve = punters.find((p) =>
                            (p.name || "").toLowerCase().includes("steve")
                          );
                          const mark = punters.find((p) =>
                            (p.name || "").toLowerCase().includes("mark")
                          );
                          const steveSel = steve
                            ? (steve.selectionsByMeeting[meetingCard.id] || {})[
                                activeRace.raceNumber
                              ]
                            : undefined;
                          const markSel = mark
                            ? (mark.selectionsByMeeting[meetingCard.id] || {})[
                                activeRace.raceNumber
                              ]
                            : undefined;

                          const isStevePick =
                            steveSel?.firstPref === runner.tabNumber
                              ? "1st"
                              : steveSel?.secondPref === runner.tabNumber
                              ? "2nd"
                              : steveSel?.thirdPref === runner.tabNumber
                              ? "3rd"
                              : null;

                          const isMarkPick =
                            markSel?.firstPref === runner.tabNumber
                              ? "1st"
                              : markSel?.secondPref === runner.tabNumber
                              ? "2nd"
                              : markSel?.thirdPref === runner.tabNumber
                              ? "3rd"
                              : null;

                          return (
                            <div
                              key={runner.tabNumber}
                              className={`p-3 rounded-lg border transition-all ${
                                is1st
                                  ? "bg-[#1E190E] border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                                  : is2nd
                                  ? "bg-[#161B19] border-slate-300/60"
                                  : is3rd
                                  ? "bg-[#121E18] border-[#10B981]/60"
                                  : runner.isScratched
                                  ? "bg-[#0B110E]/60 border-[#1F2D26]/60 opacity-50"
                                  : "bg-[#0B110E] border-[#1F2D26] hover:border-[#2F4538]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="w-6 h-6 rounded-md bg-[#121A16] border border-[#1F2D26] font-mono font-bold text-xs flex items-center justify-center text-[#F3F4F0]">
                                      {runner.tabNumber}
                                    </span>
                                    <span className="font-bold text-sm text-[#F3F4F0]">
                                      {runner.horseName}
                                    </span>
                                    <span className="text-[11px] font-mono text-[#8A9990]">
                                      (B{runner.barrier})
                                    </span>
                                    {runner.form && (
                                      <span className="text-[11px] font-mono text-[#10B981] font-semibold">
                                        {runner.form}
                                      </span>
                                    )}
                                    {mapShort && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#121A16] text-[#8A9990]">
                                        {mapShort}
                                      </span>
                                    )}
                                    <RunnerAiAnalysisButton
                                      runner={runner}
                                      race={activeRace}
                                      meeting={meetingCard}
                                      size="xs"
                                    />
                                  </div>
                                  <div className="text-[11px] text-[#8A9990] font-mono">
                                    J: {runner.jockey} · {runner.weight}kg · T:{" "}
                                    {runner.trainer || "Stable"}
                                  </div>
                                </div>

                                {/* Odds & Flucs */}
                                <div className="text-right font-mono shrink-0">
                                  <div className="text-sm font-bold text-[#F3F4F0] tabular-nums">
                                    ${(Number(runner.nswTabWin) || 0).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-[#8A9990] tabular-nums">
                                    Plc $
                                    {(Number(runner.nswTabPlace) || 0).toFixed(2)}
                                  </div>
                                  <div className="mt-0.5">
                                    <TactileOddsFlucBadge
                                      openingOdds={
                                        runner.openingOdds || runner.nswTabWin
                                      }
                                      currentOdds={runner.nswTabWin}
                                      marketSupport={runner.marketSupport}
                                      heatGlow={true}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Preference Selectors */}
                              <div className="mt-3 pt-2 border-t border-[#1F2D26] flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                  {isStevePick && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#262010] border border-[#D4AF37]/50 text-[#D4AF37] font-semibold">
                                      Steve F ({isStevePick})
                                    </span>
                                  )}
                                  {isMarkPick && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#1A2520] border border-[#10B981]/50 text-[#10B981] font-semibold">
                                      Mark S ({isMarkPick})
                                    </span>
                                  )}
                                  {runner.isScratched && (
                                    <span className="text-[#EF4444] font-bold">
                                      SCRATCHED (Late SCR → Fav Auto-Sub)
                                    </span>
                                  )}
                                </div>

                                {!runner.isScratched && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          activeRace.raceNumber,
                                          1,
                                          runner.tabNumber
                                        )
                                      }
                                      className={`min-h-[28px] px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                                        is1st
                                          ? "bg-[#D4AF37] text-[#0B110E] shadow-[0_0_8px_rgba(212,175,55,0.4)] font-black"
                                          : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                                      }`}
                                      title="Nominate as 1st Preference (3 pts)"
                                    >
                                      1st (3pts)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          activeRace.raceNumber,
                                          2,
                                          runner.tabNumber
                                        )
                                      }
                                      className={`min-h-[28px] px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                                        is2nd
                                          ? "bg-slate-200 text-[#0B110E] shadow-[0_0_8px_rgba(255,255,255,0.3)] font-black"
                                          : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-slate-300 hover:text-[#F3F4F0]"
                                      }`}
                                      title="Nominate as 2nd Preference (2 pts)"
                                    >
                                      2nd (2pts)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTogglePreferenceChip(
                                          activePunter.id,
                                          meetingCard.id,
                                          activeRace.raceNumber,
                                          3,
                                          runner.tabNumber
                                        )
                                      }
                                      className={`min-h-[28px] px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                                        is3rd
                                          ? "bg-[#10B981] text-[#0B110E] shadow-[0_0_8px_rgba(16,185,129,0.4)] font-black"
                                          : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-[#10B981] hover:text-[#10B981]"
                                      }`}
                                      title="Nominate as 3rd Preference (1 pt)"
                                    >
                                      3rd (1pt)
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Stepper Bottom Navigation */}
                      <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#1F2D26]">
                        <button
                          type="button"
                          disabled={activeRace.raceNumber <= 1}
                          onClick={() =>
                            setActiveRacePerMeeting((prev) => ({
                              ...prev,
                              [meetingCard.id]: activeRace.raceNumber - 1,
                            }))
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1F2D26] bg-[#0B110E] text-xs font-mono font-semibold text-[#8A9990] hover:text-[#F3F4F0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Previous Race</span>
                        </button>

                        <span className="text-xs font-mono text-[#8A9990]">
                          Race {activeRace.raceNumber} of {meetingCard.races.length} ·{" "}
                          {activeEvaluated.isComplete ? (
                            <strong className="text-[#10B981]">3/3 Picked</strong>
                          ) : (
                            <span className="text-[#D4AF37]">Incomplete</span>
                          )}
                        </span>

                        <button
                          type="button"
                          disabled={
                            activeRace.raceNumber >= meetingCard.races.length
                          }
                          onClick={() =>
                            setActiveRacePerMeeting((prev) => ({
                              ...prev,
                              [meetingCard.id]: activeRace.raceNumber + 1,
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                            activeEvaluated.isComplete
                              ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-bold shadow-sm"
                              : "border-[#1F2D26] bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0]"
                          }`}
                        >
                          <span>Next Race</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Full Table View */
              <div className="space-y-0">
                <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1F2D26] bg-[#0B110E] text-[12px] text-[#8A9990] font-medium">
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Race · Time
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Race Status / Official 1st–2nd–3rd
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      1st Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      2nd Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      3rd Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      {scoringMode === "dollars"
                        ? "Completed Race $ Return"
                        : "Completed Race Points"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2D26] text-xs">
                  {meetingCard.races.map((race) => {
                    const rawTrio = cardSelections[race.raceNumber];
                    const { effectiveTrio: trio, autoSubReplacements } =
                      resolveAutoSubForRaceTrio(race, rawTrio, true);
                    const isJokerRace = activeJokerRaceNo === race.raceNumber;
                    const evaluated = evaluateRaceTrio(
                      race,
                      trio,
                      meetingCard.date,
                      isJokerRace
                    );
                    const speedAndFlucs = computeRaceSpeedMapAndFlucs(race);
                    const mapKey = `${meetingCard.id}-${race.raceNumber}`;
                    const isMapExpanded =
                      expandedSpeedMapRaces[mapKey] ?? showAllSpeedMaps;

                    const firstPlace = evaluated.isRaceResulted
                      ? race.runners.find((r) => r.finishPosition === 1)
                      : undefined;
                    const secondPlace = evaluated.isRaceResulted
                      ? race.runners.find((r) => r.finishPosition === 2)
                      : undefined;
                    const thirdPlace = evaluated.isRaceResulted
                      ? race.runners.find((r) => r.finishPosition === 3)
                      : undefined;

                    return (
                      <React.Fragment key={race.raceNumber}>
                      <tr
                        id={`selection-${meetingCard.id}-race-${race.raceNumber}`}
                        className={`transition-colors align-top ${
                          isJokerRace
                            ? "bg-[#1E1A0F]/90 hover:bg-[#262113]"
                            : "hover:bg-[#16201B]"
                        }`}
                      >
                        {/* Race Info + Joker Toggle */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-[#F3F4F0] text-sm">
                              R{race.raceNumber}
                            </span>
                            <span className="font-mono text-xs text-[#8A9990]">
                              {race.startTime} · {race.distance}m
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                evaluated.isRaceResulted
                                  ? "bg-[#152920] text-[#10B981]"
                                  : "bg-[#192620] text-[#D4AF37]"
                              }`}
                            >
                              {evaluated.isRaceResulted ? "FINAL" : "UPCOMING"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-[#F3F4F0] font-medium mt-0.5 max-w-[190px] truncate">
                              {race.raceName}
                            </div>
                            {featureRaceNo === race.raceNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] text-[9px] font-mono font-bold uppercase shrink-0">
                                ★ FEATURE
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onToggleJokerRace?.(
                                  activePunter.id,
                                  meetingCard.id,
                                  isJokerRace ? null : race.raceNumber
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                isJokerRace
                                  ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                                  : "bg-[#0B110E] text-[#D4AF37] border-[#D4AF37]/40 hover:bg-[#D4AF37]/15"
                              }`}
                              title="Nominate this race as your Joker Round (Double points for all successful selections: 1st, 2nd, or 3rd)"
                            >
                              {isJokerRace
                                ? `🃏 JOKER 2× ACTIVE${featureRaceNo === race.raceNumber ? " (FEATURE)" : ""}`
                                : "🃏 Play Joker (2×)"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAutoPickSingleRace(
                                  race,
                                  meetingCard.id
                                )
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#152920] border border-[#10B981]/50 text-[#10B981] hover:bg-[#1C3327] transition-colors cursor-pointer"
                              title="Auto-pick this race: randomly select at least 1 of top 3 favourites + 2 other runners"
                            >
                              🎲 Auto Pick
                            </button>
                            <span className="text-[11px] font-mono">
                              {evaluated.isComplete ? (
                                <span className="text-[#10B981]">3/3</span>
                              ) : evaluated.hasAnySelection ? (
                                <span className="text-[#D4AF37]">Partial</span>
                              ) : (
                                <span className="text-[#8A9990]">Pick 3</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                toggleRaceSpeedMap(
                                  meetingCard.id,
                                  race.raceNumber
                                )
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                                isMapExpanded
                                  ? "bg-[#152920] text-[#10B981] border-[#10B981]/60 font-semibold"
                                  : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26] hover:text-[#F3F4F0]"
                              }`}
                              title="Toggle Speed Map (Leader/On-Pace/Midfield/Back) and Market Flucs for this race"
                            >
                              {isMapExpanded
                                ? "▾ Speed Map & Flucs"
                                : "▸ Speed Map & Flucs"}
                            </button>
                          </div>
                          {autoSubReplacements.length > 0 && (
                            <div className="mt-1 text-[10px] font-mono text-[#10B981]">
                              {autoSubReplacements.map((sub) => (
                                <div key={sub.preferenceRank}>
                                  Auto-Sub #{sub.scratchedTab} SCR → #
                                  {sub.replacementTab} {sub.replacementHorseName}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Official TAB Placegetters — ONLY shown if race is completed */}
                        <td className="py-3 px-3 font-mono text-[11px] tabular-nums whitespace-nowrap">
                          {!evaluated.isRaceResulted ? (
                            <div className="space-y-1 py-0.5">
                              <div className="inline-flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Race Not Complete ({race.startTime})</span>
                              </div>
                              <div className="text-[#8A9990] text-[10px]">
                                {race.bettingForecast
                                  ? `Favs: ${race.bettingForecast}`
                                  : "Results appear upon official All-Clear"}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-[#D4AF37] font-semibold">
                                1st:{" "}
                                {firstPlace
                                  ? `#${firstPlace.tabNumber} ${firstPlace.horseName} (W $${(
                                      Number(firstPlace.nswTabWin) || 0
                                    ).toFixed(2)} / P $${(
                                      Number(firstPlace.nswTabPlace) || 0
                                    ).toFixed(2)})`
                                  : "Official Pending"}
                              </div>
                              <div className="text-[#F3F4F0] mt-0.5">
                                2nd:{" "}
                                {secondPlace
                                  ? `#${secondPlace.tabNumber} ${secondPlace.horseName} (P $${(
                                      Number(secondPlace.nswTabPlace) || 0
                                    ).toFixed(2)})`
                                  : "Official Pending"}
                              </div>
                              <div className="text-[#10B981] mt-0.5">
                                3rd:{" "}
                                {thirdPlace
                                  ? `#${thirdPlace.tabNumber} ${thirdPlace.horseName} (P $${(
                                      Number(thirdPlace.nswTabPlace) || 0
                                    ).toFixed(2)})`
                                  : "Official Pending"}
                              </div>
                            </>
                          )}
                        </td>

                        {/* 1st, 2nd, 3rd Preference Selectors */}
                        {evaluated.picks.map((pick) => {
                          const rankLabel =
                            pick.preferenceRank === 1
                              ? "1st Pref"
                              : pick.preferenceRank === 2
                              ? "2nd Pref"
                              : "3rd Pref";

                          return (
                            <td
                              key={pick.preferenceRank}
                              className="py-3 px-3 min-w-[215px]"
                            >
                              <select
                                aria-label={`${meetingCard.venue} Race ${race.raceNumber} ${rankLabel}`}
                                value={pick.tabNumber ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value
                                    ? Number(e.target.value)
                                    : null;
                                  onUpdateRaceSelection(
                                    activePunter.id,
                                    meetingCard.id,
                                    race.raceNumber,
                                    pick.preferenceRank,
                                    val
                                  );
                                }}
                                className="w-full bg-[#0B110E] border border-[#1F2D26] rounded px-2.5 py-2 text-xs text-[#F3F4F0] font-mono focus:outline-none focus:border-[#D4AF37]"
                              >
                                <option value="">
                                  -- Select {rankLabel} --
                                </option>
                                {race.runners.map((rn) => {
                                  const rf =
                                    speedAndFlucs.byTabNumber[rn.tabNumber];
                                  const mapShort = rf
                                    ? rf.speedMapPosition === "Leader"
                                      ? "Lead"
                                      : rf.speedMapPosition === "On Pace"
                                      ? "Pace"
                                      : rf.speedMapPosition === "Midfield"
                                      ? "Mid"
                                      : "Back"
                                    : "";
                                  const flucTag =
                                    rf && rf.marketSupport === "Firming"
                                      ? " [FIRM]"
                                      : rf && rf.marketSupport === "Drifting"
                                      ? " [DRIFT]"
                                      : "";
                                  return (
                                    <option
                                      key={rn.tabNumber}
                                      value={rn.tabNumber}
                                    >
                                      #{rn.tabNumber} {rn.horseName} (W $
                                      {(Number(rn.nswTabWin) || 0).toFixed(2)}{" "}
                                      / P $
                                      {(Number(rn.nswTabPlace) || 0).toFixed(2)}
                                      {mapShort ? ` · ${mapShort}` : ""}
                                      {flucTag})
                                    </option>
                                  );
                                })}
                              </select>

                              {/* Status of this Preference Pick: Pending if race not complete, Result if complete */}
                              {pick.runner && (
                                <div className="mt-1.5 space-y-0.5 text-[11px] font-mono tabular-nums px-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[#8A9990]">
                                      J: {pick.runner.jockey} (B
                                      {pick.runner.barrier})
                                    </span>
                                    {!evaluated.isRaceResulted ? (
                                      <span className="text-[#D4AF37]">
                                        Locked · W $
                                        {(
                                          Number(pick.runner.nswTabWin) || 0
                                        ).toFixed(2)}
                                      </span>
                                    ) : scoringMode === "dollars" ? (
                                      pick.dollarReturn > 0 ? (
                                        <span className="font-semibold text-[#10B981]">
                                          {pick.finishPosition === 1
                                            ? `1st (W+P) · ${formatDollarReturn(
                                                pick.dollarReturn
                                              )}`
                                            : `${
                                                pick.finishPosition === 2
                                                  ? "2nd"
                                                  : "3rd"
                                              } (Plc) · ${formatDollarReturn(
                                                pick.dollarReturn
                                              )}`}
                                        </span>
                                      ) : (
                                        <span className="text-[#8A9990]">
                                          Unp · $0
                                        </span>
                                      )
                                    ) : pick.finishPosition === 1 ? (
                                      <span className="font-semibold text-[#D4AF37]">
                                        Finished 1st · +{pick.points} pts
                                        {evaluated.jokerTriggered &&
                                        pick.preferenceRank === 1
                                          ? " (2× JOKER!)"
                                          : ""}
                                      </span>
                                    ) : pick.finishPosition === 2 ? (
                                      <span className="font-semibold text-[#F3F4F0]">
                                        Finished 2nd · +{pick.points} pts
                                      </span>
                                    ) : pick.finishPosition === 3 ? (
                                      <span className="font-semibold text-[#10B981]">
                                        Finished 3rd · +{pick.points} pt
                                        {pick.points > 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[#8A9990]">
                                        Unplaced · 0 pts
                                      </span>
                                    )}
                                  </div>
                                  {speedAndFlucs.byTabNumber[
                                    pick.runner.tabNumber
                                  ] && (
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-[#9BA8A1]">
                                        Map:{" "}
                                        {
                                          speedAndFlucs.byTabNumber[
                                            pick.runner.tabNumber
                                          ].speedMapPosition
                                        }
                                      </span>
                                      <span
                                        className={
                                          speedAndFlucs.byTabNumber[
                                            pick.runner.tabNumber
                                          ].marketSupport === "Firming"
                                            ? "text-[#10B981] font-semibold"
                                            : speedAndFlucs.byTabNumber[
                                                pick.runner.tabNumber
                                              ].marketSupport === "Drifting"
                                            ? "text-[#D4AF37]"
                                            : "text-[#8A9990]"
                                        }
                                      >
                                        {
                                          speedAndFlucs.byTabNumber[
                                            pick.runner.tabNumber
                                          ].flucLabel
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Race Points or $ Return Tally (Only scored when race is complete!) */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {!evaluated.hasAnySelection ? (
                            <div className="text-xs text-[#8A9990]">
                              — No selection
                              {isJokerRace && (
                                <div className="text-[10px] text-[#D4AF37] font-bold mt-0.5">
                                  🃏 Joker Active (2×)
                                </div>
                              )}
                            </div>
                          ) : !evaluated.isRaceResulted ? (
                            <div>
                              <div className="text-xs font-semibold text-[#D4AF37]">
                                {isJokerRace
                                  ? "🃏 Joker 2× Pending"
                                  : "Awaiting Result"}
                              </div>
                              <div className="text-[11px] text-[#8A9990]">
                                Jumps {race.startTime}
                              </div>
                            </div>
                          ) : scoringMode === "dollars" ? (
                            <>
                              <div
                                className={`text-base font-bold ${
                                  evaluated.raceDollarReturn > 0
                                    ? "text-[#10B981]"
                                    : "text-[#8A9990]"
                                }`}
                              >
                                {formatDollarReturn(evaluated.raceDollarReturn)}
                              </div>
                              <div className="text-[11px] text-[#8A9990]">
                                {evaluated.picks
                                  .map((p) =>
                                    p.tabNumber !== null
                                      ? formatDollarReturn(p.dollarReturn)
                                      : "—"
                                  )
                                  .join(" + ")}
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className={`text-base font-bold ${
                                  evaluated.jokerTriggered
                                    ? "text-[#D4AF37]"
                                    : evaluated.racePointsTally >= 4
                                    ? "text-[#D4AF37]"
                                    : evaluated.racePointsTally > 0
                                    ? "text-[#10B981]"
                                    : "text-[#8A9990]"
                                }`}
                              >
                                {evaluated.racePointsTally} pts
                                {evaluated.jokerTriggered && (
                                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#0B110E] font-bold">
                                    🃏 2× HIT
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#8A9990]">
                                {evaluated.picks
                                  .map((p) =>
                                    p.tabNumber !== null ? `${p.points}` : "—"
                                  )
                                  .join(" + ")}{" "}
                                pts
                                {isJokerRace && !evaluated.jokerTriggered && (
                                  <span className="block text-[10px] text-[#8A9990]">
                                    (Joker: No selections placed in top 3)
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                      {isMapExpanded && (
                        <tr className="bg-[#0B110E] border-b border-[#1F2D26]">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#D4AF37] font-bold">
                                    R{race.raceNumber} Speed Map &amp; Market
                                    Flucs ({race.distance}m)
                                  </span>
                                  <span className="text-[#8A9990]">·</span>
                                  <span className="text-[#10B981] font-semibold">
                                    {speedAndFlucs.tempoLabel}
                                  </span>
                                  <span className="text-[#8A9990] font-sans">
                                    — {speedAndFlucs.tempoAdvisory}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                  {speedAndFlucs.topFirmer && (
                                    <span className="text-[#10B981]">
                                      ★ Top Firmer: #
                                      {speedAndFlucs.topFirmer.tabNumber}{" "}
                                      {speedAndFlucs.topFirmer.horseName} (
                                      {speedAndFlucs.topFirmer.flucLabel})
                                    </span>
                                  )}
                                  {speedAndFlucs.biggestDrifter && (
                                    <span className="text-[#D4AF37]">
                                      ▾ Market Drifter: #
                                      {speedAndFlucs.biggestDrifter.tabNumber}{" "}
                                      {speedAndFlucs.biggestDrifter.horseName} (
                                      {speedAndFlucs.biggestDrifter.flucLabel})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                {(
                                  [
                                    "Leader",
                                    "On Pace",
                                    "Midfield",
                                    "Backmarker",
                                  ] as SpeedMapLane[]
                                ).map((lane) => {
                                  const laneRunners = speedAndFlucs.lanes[lane];
                                  return (
                                    <div
                                      key={lane}
                                      className="p-2.5 rounded bg-[#121A16] border border-[#1F2D26] space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="font-bold text-[#F3F4F0]">
                                          {lane}
                                        </span>
                                        <span className="text-[#8A9990]">
                                          {laneRunners.length} runner
                                          {laneRunners.length === 1 ? "" : "s"}
                                        </span>
                                      </div>
                                      {laneRunners.length === 0 ? (
                                        <div className="text-[11px] font-mono text-[#8A9990]">
                                          — No dedicated {lane.toLowerCase()}
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          {laneRunners.map((lr) => {
                                            const isPicked =
                                              trio?.firstPref ===
                                                lr.tabNumber ||
                                              trio?.secondPref ===
                                                lr.tabNumber ||
                                              trio?.thirdPref === lr.tabNumber;
                                            return (
                                              <div
                                                key={lr.tabNumber}
                                                className={`px-2 py-1 rounded text-[11px] font-mono flex items-center justify-between gap-1.5 border ${
                                                  isPicked
                                                    ? "bg-[#152920] border-[#10B981]/50 text-[#F3F4F0]"
                                                    : "bg-[#0B110E] border-[#1F2D26] text-[#D5DDD8]"
                                                }`}
                                              >
                                                <span className="truncate">
                                                  <strong className="text-[#D4AF37]">
                                                    #{lr.tabNumber}
                                                  </strong>{" "}
                                                  {lr.horseName} (B{lr.barrier})
                                                </span>
                                                <span
                                                  className={`shrink-0 tabular-nums ${
                                                    lr.marketSupport ===
                                                    "Firming"
                                                      ? "text-[#10B981] font-semibold"
                                                      : lr.marketSupport ===
                                                        "Drifting"
                                                      ? "text-[#D4AF37]"
                                                      : "text-[#8A9990]"
                                                  }`}
                                                >
                                                  ${lr.openingOdds.toFixed(2)}→$
                                                  {lr.currentOdds.toFixed(2)}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch View (< 768px) */}
            <div className="md:hidden divide-y divide-[#1F2D26]">
              {meetingCard.races.map((race) => {
                const trio = cardSelections[race.raceNumber];
                const isJokerRace = activeJokerRaceNo === race.raceNumber;
                const evaluated = evaluateRaceTrio(
                  race,
                  trio,
                  meetingCard.date,
                  isJokerRace
                );

                return (
                  <div
                    key={race.raceNumber}
                    className={`p-4 space-y-3 ${
                      isJokerRace ? "bg-[#1E1A0F]/80" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold text-[#F3F4F0]">
                          Race {race.raceNumber}: {race.raceName}
                        </span>
                        <div className="text-xs text-[#8A9990] font-mono">
                          {race.startTime} · {race.distance}m ·{" "}
                          {evaluated.isRaceResulted ? (
                            <span className="text-[#10B981]">FINAL</span>
                          ) : (
                            <span className="text-[#D4AF37]">UPCOMING</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleJokerRace?.(
                                activePunter.id,
                                meetingCard.id,
                                isJokerRace ? null : race.raceNumber
                              )
                            }
                            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
                              isJokerRace
                                ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                                : "bg-[#0B110E] text-[#D4AF37] border-[#D4AF37]/40"
                            }`}
                          >
                            {isJokerRace
                              ? "🃏 JOKER 2× ACTIVE"
                              : "🃏 Play Joker (2×)"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAutoPickSingleRace(
                                race,
                                meetingCard.id
                              )
                            }
                            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#152920] border border-[#10B981]/50 text-[#10B981] hover:bg-[#1C3327] cursor-pointer"
                            title="Auto Pick 1 Favourite + 2 Random Runners"
                          >
                            🎲 Auto Pick
                          </button>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        {!evaluated.hasAnySelection ? (
                          <div className="text-xs text-[#8A9990]">
                            — No selection
                          </div>
                        ) : !evaluated.isRaceResulted ? (
                          <>
                            <div className="text-xs font-semibold text-[#D4AF37]">
                              {isJokerRace ? "🃏 2× Pending" : "Pending Result"}
                            </div>
                            <div className="text-[11px] text-[#8A9990]">
                              Jumps {race.startTime}
                            </div>
                          </>
                        ) : scoringMode === "dollars" ? (
                          <>
                            <div className="text-sm font-bold text-[#10B981]">
                              {formatDollarReturn(evaluated.raceDollarReturn)}
                            </div>
                            <div className="text-[11px] text-[#8A9990]">
                              Race $ Return
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-[#D4AF37]">
                              {evaluated.racePointsTally} pts
                              {evaluated.jokerTriggered ? " (2×!)" : ""}
                            </div>
                            <div className="text-[11px] text-[#8A9990]">
                              Race Tally
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {evaluated.picks.map((pick) => {
                        const rankTitle =
                          pick.preferenceRank === 1
                            ? "1st Preference (1u Win + 1u Place)"
                            : pick.preferenceRank === 2
                            ? "2nd Preference (1u Win + 1u Place)"
                            : "3rd Preference (1u Win + 1u Place)";

                        return (
                          <div key={pick.preferenceRank} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8A9990] font-medium">
                                {rankTitle}
                              </span>
                              {pick.runner && (
                                <span
                                  className={`font-mono font-semibold ${
                                    !evaluated.isRaceResulted
                                      ? "text-[#D4AF37]"
                                      : scoringMode === "dollars"
                                      ? pick.dollarReturn > 0
                                        ? "text-[#10B981]"
                                        : "text-[#8A9990]"
                                      : pick.points > 0
                                      ? "text-[#D4AF37]"
                                      : "text-[#8A9990]"
                                  }`}
                                >
                                  {!evaluated.isRaceResulted
                                    ? `W $${(Number(pick.runner.nswTabWin) || 0).toFixed(2)}`
                                    : scoringMode === "dollars"
                                    ? formatDollarReturn(pick.dollarReturn)
                                    : `${pick.points} pts`}
                                </span>
                              )}
                            </div>
                            <select
                              value={pick.tabNumber ?? ""}
                              onChange={(e) => {
                                const val = e.target.value
                                  ? Number(e.target.value)
                                  : null;
                                onUpdateRaceSelection(
                                  activePunter.id,
                                  meetingCard.id,
                                  race.raceNumber,
                                  pick.preferenceRank,
                                  val
                                );
                              }}
                              className="min-h-[44px] w-full bg-[#0B110E] border border-[#1F2D26] rounded-md px-3 py-2 text-xs text-[#F3F4F0] font-mono"
                            >
                              <option value="">-- Choose Horse --</option>
                              {race.runners.map((rn) => (
                                <option key={rn.tabNumber} value={rn.tabNumber}>
                                  #{rn.tabNumber} {rn.horseName} (W $
                                  {(Number(rn.nswTabWin) || 0).toFixed(2)} / P $
                                  {(Number(rn.nswTabPlace) || 0).toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            )}
          </div>
        );
      })}

      {/* Persistent Sticky Syndicate Selection Dock */}
      {displayedMeetings.length > 0 && (
        <StickySyndicateDock
          meeting={displayedMeetings[0]}
          activeRace={
            displayedMeetings[0].races.find(
              (r) =>
                r.raceNumber ===
                (activeRacePerMeeting[displayedMeetings[0].id] ??
                  displayedMeetings[0].races[0]?.raceNumber)
            ) || displayedMeetings[0].races[0]
          }
          activeRaceNumber={
            activeRacePerMeeting[displayedMeetings[0].id] ??
            displayedMeetings[0].races[0]?.raceNumber ??
            1
          }
          totalRaces={displayedMeetings[0].races.length}
          completedRacesCount={
            activeSummary.byVenue[displayedMeetings[0].id]?.completed ?? 0
          }
          activeTrio={
            getPunterSelectionsForMeeting(activePunter, displayedMeetings[0])[
              activeRacePerMeeting[displayedMeetings[0].id] ??
                displayedMeetings[0].races[0]?.raceNumber ??
                1
            ]
          }
          isJokerActive={
            getPunterJokerForMeeting(activePunter, displayedMeetings[0]) ===
            (activeRacePerMeeting[displayedMeetings[0].id] ??
              displayedMeetings[0].races[0]?.raceNumber)
          }
          activePunterName={activePunter.name}
          onSelectRaceNumber={(raceNo) =>
            setActiveRacePerMeeting((prev) => ({
              ...prev,
              [displayedMeetings[0].id]: raceNo,
            }))
          }
          onToggleJoker={() => {
            const curRace =
              activeRacePerMeeting[displayedMeetings[0].id] ??
              displayedMeetings[0].races[0]?.raceNumber ??
              1;
            const curJoker = getPunterJokerForMeeting(
              activePunter,
              displayedMeetings[0]
            );
            onToggleJokerRace?.(
              activePunter.id,
              displayedMeetings[0].id,
              curJoker === curRace ? null : curRace
            );
          }}
          onApplyStrategy={(strat) => {
            const curRace =
              displayedMeetings[0].races.find(
                (r) =>
                  r.raceNumber ===
                  (activeRacePerMeeting[displayedMeetings[0].id] ??
                    displayedMeetings[0].races[0]?.raceNumber)
              ) || displayedMeetings[0].races[0];
            handleApplyStrategyToRace(
              activePunter.id,
              displayedMeetings[0].id,
              curRace,
              strat
            );
          }}
          onClearActiveRace={() => {
            const curRace =
              activeRacePerMeeting[displayedMeetings[0].id] ??
              displayedMeetings[0].races[0]?.raceNumber ??
              1;
            handleClearRacePicks(activePunter.id, displayedMeetings[0].id, curRace);
          }}
          onNavigateToResults={handleJumpToResults}
        />
      )}
    </div>
  );
};
