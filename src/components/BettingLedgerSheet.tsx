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
  ChevronUp,
  ChevronDown,
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
import { audioAlerts } from "../utils/audioAlerts";

interface BettingLedgerSheetProps {
  meetings: RaceMeeting[];
  activeMeetingId?: string;
  selectedMeetingId?: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  selectedRaceNumber?: number;
  onSelectRaceNumber?: (raceNo: number) => void;
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
  selectedRaceNumber,
  onSelectRaceNumber,
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

  const [selectionViewMode, setSelectionViewMode] = useState<"cards" | "stepper" | "table">("stepper");
  const [activeRacePerMeeting, setActiveRacePerMeeting] = useState<Record<string, number>>({});
  const [expandedHarvilleRaces, setExpandedHarvilleRaces] = useState<Record<string, boolean>>({});

  const toggleHarvilleModel = (meetingId: string, raceNumber: number) => {
    const key = `${meetingId}-${raceNumber}`;
    setExpandedHarvilleRaces((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // State to track manually collapsed race cards (once all 3 picks are chosen)
  const [collapsedRaces, setCollapsedRaces] = useState<Record<string, boolean>>({});

  const toggleRaceCollapse = (meetingId: string, raceNumber: number) => {
    const key = `${meetingId}_R${raceNumber}`;
    setCollapsedRaces((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const collapseAllCompletedRaces = (meetingCard: RaceMeeting) => {
    const cardSelections = activePunter.selectionsByMeeting[meetingCard.id] || {};
    const updates: Record<string, boolean> = {};
    meetingCard.races.forEach((race) => {
      const rawTrio = cardSelections[race.raceNumber];
      const pickCount = [rawTrio?.firstPref, rawTrio?.secondPref, rawTrio?.thirdPref].filter(Boolean).length;
      if (pickCount === 3) {
        updates[`${meetingCard.id}_R${race.raceNumber}`] = true;
      }
    });
    setCollapsedRaces((prev) => ({ ...prev, ...updates }));
  };

  const expandAllRaces = (meetingCard: RaceMeeting) => {
    const updates: Record<string, boolean> = {};
    meetingCard.races.forEach((race) => {
      updates[`${meetingCard.id}_R${race.raceNumber}`] = false;
    });
    setCollapsedRaces((prev) => ({ ...prev, ...updates }));
  };

  const triggerHaptic = (pattern: number | number[] = 15) => {
    audioAlerts.triggerHapticFeedback(pattern);
  };

  // Touch Swipe & Keyboard Navigation Engine for Focused Single-Race View
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, meeting: RaceMeeting) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Must be predominantly horizontal gesture (> 45px and > 1.3x deltaY)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        // Swiped left -> Next Race
        handleStepRace(meeting, 1);
      } else {
        // Swiped right -> Previous Race
        handleStepRace(meeting, -1);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const selectRace = (meetingId: string, raceNo: number) => {
    setActiveRacePerMeeting((prev) => ({
      ...prev,
      [meetingId]: raceNo,
    }));
    onSelectRaceNumber?.(raceNo);
    audioAlerts.playTapClick();
    triggerHaptic(10);

    setTimeout(() => {
      const chip = document.getElementById(`ribbon-race-btn-${meetingId}-${raceNo}`);
      if (chip) {
        chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }, 40);
  };

  const handleStepRace = (meeting: RaceMeeting, delta: number) => {
    const curRaceNo =
      activeRacePerMeeting[meeting.id] ??
      (selectedRaceNumber && meeting.races.some((r) => r.raceNumber === selectedRaceNumber)
        ? selectedRaceNumber
        : meeting.races[0]?.raceNumber ?? 1);
    const currentIndex = meeting.races.findIndex((r) => r.raceNumber === curRaceNo);
    const targetIndex = currentIndex + delta;
    if (targetIndex >= 0 && targetIndex < meeting.races.length) {
      selectRace(meeting.id, meeting.races[targetIndex].raceNumber);
    }
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
      audioAlerts.playTapClick();
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

    // Set new preference with crisp click audio and haptic pulse
    onUpdateRaceSelection(punterId, meetingId, raceNumber, rank, tabNumber);
    audioAlerts.playSelectionClick(rank);
    triggerHaptic(rank === 1 ? [18, 12] : 15);
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
    audioAlerts.playSelectionClick(1);
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
    audioAlerts.playTapClick();
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

  // Desktop keyboard ArrowLeft / ArrowRight navigation in Focused Single-Race mode
  useEffect(() => {
    if (selectionViewMode !== "stepper") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const targetMeeting = displayedMeetings[0];
      if (!targetMeeting || !targetMeeting.races.length) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleStepRace(targetMeeting, -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleStepRace(targetMeeting, 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionViewMode, displayedMeetings, activeRacePerMeeting, selectedRaceNumber]);

  return (
    <div className="space-y-6">
      {/* 1. Venue Selection Scope Bar + Scoring Mode Toggle */}
      <div className="apple-card p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F2F2F7] pb-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0071E3]" />
                <span className="text-xs uppercase tracking-wider text-[#86868B] font-semibold">
                  Select Race Cards / Venues:
                </span>
              </div>

              <RaceCardMultiSelectDropdown
                meetings={sortedMeetings}
                selectedMeetingIds={effectiveSelectedIds}
                onChangeSelectedMeetingIds={updateSelectedMeetingIds}
                punters={punters}
                labelPrefix="Race Cards"
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
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer ${
                      isChecked
                        ? "bg-[#0071E3] text-white border-[#0071E3] font-semibold shadow-xs"
                        : "bg-[#F2F2F7] text-[#1D1D1F] border-[#E5E5EA] hover:bg-[#E5E5EA]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                        isChecked
                          ? "bg-white border-white text-[#0071E3]"
                          : "bg-white border-[#D2D2D7]"
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isChecked
                          ? "bg-white/20 text-white"
                          : isMetro
                          ? "bg-white text-[#0071E3]"
                          : "bg-white text-[#86868B]"
                      }`}
                    >
                      {m.state} {isMetro ? "METRO" : "TAB"}
                    </span>
                    <span>{m.venue}</span>
                    <span className="font-mono text-[11px] opacity-85">
                      ({m.races.length}R)
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
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border bg-[#EBF5FF] text-[#0071E3] border-[#0071E3]/20 hover:bg-[#D6EBFF] cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    Syd &amp; Melb (
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
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border bg-[#F2F2F7] text-[#1D1D1F] border-[#E5E5EA] hover:bg-[#E5E5EA] cursor-pointer"
                >
                  <span>Check All ({sortedMeetings.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Switch: Points vs $ Return (Apple Segmented Control) */}
            <div
              role="group"
              aria-label="Scoring Mode Switch"
              className="flex items-center p-0.5 bg-[#E5E5EA]/70 rounded-full border border-black/[0.04]"
            >
              <button
                type="button"
                onClick={() => onToggleScoringMode("points")}
                className={`min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                  scoringMode === "points"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Points (3/2/1)</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleScoringMode("dollars")}
                className={`min-h-[32px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                  scoringMode === "dollars"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>$ Return</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleJumpToResults}
              className="apple-btn-secondary"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Results Sheet</span>
            </button>
          </div>
        </div>

        {/* User / Punter Selector Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-[#86868B]">
              Active Punter
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
                    className={`min-h-[38px] rounded-full text-xs font-medium transition-all flex items-center border overflow-hidden ${
                      isSelected
                        ? "bg-[#0071E3] text-white border-[#0071E3] font-semibold shadow-xs"
                        : "bg-[#F2F2F7] text-[#1D1D1F] border-[#E5E5EA] hover:bg-[#E5E5EA]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPunter(p.id)}
                      className="px-3.5 py-1.5 flex items-center gap-2 cursor-pointer"
                    >
                      <span>{p.name}</span>
                      <span
                        className={`font-mono px-2 py-0.5 rounded-full text-[11px] tabular-nums ${
                          isSelected
                            ? "bg-white/20 text-white font-bold"
                            : "bg-white text-[#1D1D1F] border border-[#E5E5EA]"
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
                        className={`px-2.5 py-1.5 border-l transition-colors cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? "border-white/20 text-white hover:bg-rose-500"
                            : "border-[#E5E5EA] text-[#86868B] hover:text-[#FF3B30]"
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
                className="apple-btn-secondary"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {showAddMember ? "Close Member Manager" : "Add Member"}
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
                    className="min-h-[38px] px-3 py-1.5 rounded-full text-xs font-medium bg-[#FEECEB] text-[#FF3B30] border border-[#FF3B30]/30 hover:bg-[#FF3B30] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
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
              className="apple-btn-primary"
              title="Immediately save and sync all user selections across all devices"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {cloudSyncState === "saving"
                  ? "Saving to Cloud..."
                  : `Save Selections${
                      lastSyncedTime ? ` (${lastSyncedTime})` : ""
                    }`}
              </span>
            </button>
            <button
              type="button"
              onClick={handleAutoFillRequiredScope}
              className="apple-btn-secondary"
              title="Auto-fill 3 top-rated TAB runners for every race in the selected scope"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>
                Auto-Fill {displayedMeetings.length} Cards (
                {activeSummary.totalRacesInScope} Races)
              </span>
            </button>
            <button
              type="button"
              onClick={handleClearRequiredScope}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[#86868B] hover:text-[#FF3B30] hover:border-[#FF3B30]/30 text-xs font-medium transition-colors cursor-pointer"
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

          <div className="lg:col-span-5 grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] font-mono">
              <div className="text-[10px] uppercase font-semibold text-[#86868B]">
                {activePunter.name} {scoringMode === "dollars" ? "$ Return" : "Points"}
              </div>
              <div
                className={`text-lg font-bold tabular-nums mt-1 ${
                  activeSummary.resultedRacesCount === 0
                    ? "text-[#86868B]"
                    : scoringMode === "dollars"
                    ? "text-[#34C759]"
                    : "text-[#0071E3]"
                }`}
              >
                {activeSummary.resultedRacesCount === 0
                  ? "Pending"
                  : scoringMode === "dollars"
                  ? formatDollarReturn(activeSummary.totalDollarReturn)
                  : `${activeSummary.totalPoints} pts`}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] font-mono">
              <div className="text-[10px] uppercase font-semibold text-[#86868B]">
                Picks Logged
              </div>
              <div
                className={`text-lg font-bold tabular-nums mt-1 ${
                  activeSummary.completedRaces ===
                  activeSummary.totalRacesInScope
                    ? "text-[#34C759]"
                    : "text-[#1D1D1F]"
                }`}
              >
                {activeSummary.completedRaces}/{activeSummary.totalRacesInScope}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] font-mono">
              <div className="text-[10px] uppercase font-semibold text-[#86868B]">
                Resulted
              </div>
              <div className="text-lg font-bold text-[#34C759] tabular-nums mt-1">
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
            className="apple-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E5EA] bg-[#FAF9FA] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#0071E3] font-mono text-xs font-semibold">
                    {meetingCard.state} · {meetingCard.races.length} RACES (R
                    {firstRaceNum}–R{lastRaceNum})
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-[#1D1D1F]">
                      {meetingCard.venue} ({meetingCard.date}) —{" "}
                      <span className="text-[#0071E3]">
                        {activePunter.name}
                      </span>
                    </h2>
                    <p className="text-xs text-[#86868B]">
                      Select 3 horses in order of preference (1st, 2nd, 3rd)
                      across all {meetingCard.races.length} scheduled races at{" "}
                      {meetingCard.venue} ({venueStat.resultedRaces} of{" "}
                      {meetingCard.races.length} races completed).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Switcher (Apple Segmented Control) */}
                  <div className="flex items-center p-0.5 bg-[#E5E5EA]/70 rounded-full border border-black/[0.04]">
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("stepper")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                        selectionViewMode === "stepper"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-[#0071E3]" />
                      <span>Focused Race</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("cards")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                        selectionViewMode === "cards"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>All Races</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionViewMode("table")}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                        selectionViewMode === "table"
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                  </div>

                  {/* Batch Collapse/Expand for completed races */}
                  {selectionViewMode === "cards" && (() => {
                    const cardSels = activePunter.selectionsByMeeting[meetingCard.id] || {};
                    const completedCount = meetingCard.races.filter((r) => {
                      const trio = cardSels[r.raceNumber];
                      return [trio?.firstPref, trio?.secondPref, trio?.thirdPref].filter(Boolean).length === 3;
                    }).length;
                    const anyCollapsed = meetingCard.races.some(
                      (r) => collapsedRaces[`${meetingCard.id}_R${r.raceNumber}`]
                    );

                    if (completedCount === 0) return null;

                    return anyCollapsed ? (
                      <button
                        type="button"
                        onClick={() => expandAllRaces(meetingCard)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA] text-xs font-mono font-medium transition cursor-pointer"
                        title="Expand all race cards"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-[#0071E3]" />
                        <span>Expand All</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => collapseAllCompletedRaces(meetingCard)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF5FF] border border-[#0071E3]/20 text-[#0071E3] hover:bg-[#D6EBFF] text-xs font-mono font-semibold transition cursor-pointer shadow-xs"
                        title="Collapse all fully tipped races into simplified summary cards"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Collapse Completed ({completedCount})</span>
                      </button>
                    );
                  })()}

                  <span className="px-2.5 py-1 rounded-full bg-[#EAFBF0] border border-[#34C759]/30 text-[11px] font-mono text-[#34C759] font-medium">
                    ✓ TAB Auto-Sub Active
                  </span>
                  <span className="font-mono text-xs text-[#1D1D1F] font-semibold">
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
                    className="text-xs font-semibold text-[#0071E3] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Live Results →
                  </button>
                </div>
              </div>

              {/* JOKER ROUND SELECTOR BAR FOR THIS MEETING */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#FF9500]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FF9500] text-white font-mono text-[11px] font-bold uppercase whitespace-nowrap shadow-xs">
                    🃏 Joker Round (2× Points)
                  </span>
                  <span className="text-xs text-[#1D1D1F]">
                    Defaults to{" "}
                    <strong className="text-[#FF9500]">
                      Feature Race R{featureRaceNo ?? "-"}
                      {featureRaceObj ? ` (${featureRaceObj.raceName})` : ""}
                    </strong>{" "}
                    for <strong className="text-[#0071E3]">{activePunter.name}</strong>{" "}
                    — earn{" "}
                    <strong className="text-[#34C759]">
                      double points (2×)
                    </strong>{" "}
                    for all successful selections!
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
                        className={`px-3 py-1 rounded-full font-mono text-xs font-semibold transition-all cursor-pointer border ${
                          isJokerSelected
                            ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                            : isFeature
                            ? "bg-white text-[#FF9500] border-[#FF9500]/40 hover:border-[#FF9500]"
                            : "bg-white text-[#86868B] border-[#E5E5EA] hover:border-[#FF9500] hover:text-[#1D1D1F]"
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
                        className="px-2.5 py-1 rounded-full text-[11px] font-mono text-[#0071E3] hover:underline cursor-pointer"
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
                      className="px-2.5 py-1 rounded-full text-[11px] font-mono text-[#86868B] hover:text-[#FF3B30] cursor-pointer"
                    >
                      Clear Joker
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* STICKY QUICK-JUMP RACE RIBBON (Pinned below header during scroll) */}
            <div className="sticky top-[var(--app-header-height,68px)] z-20 bg-white/95 backdrop-blur-md dark:bg-[#0E1512]/95 border-b border-[#E5E5EA] dark:border-[#1F2D26] px-4 sm:px-5 py-2.5 shadow-xs transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1D1D1F] dark:text-[#F3F4F0] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#0071E3]" />
                    Race Navigation Ribbon
                  </span>
                  <span className="hidden sm:inline-block text-[11px] text-[#86868B] font-mono">
                    · Tap to jump or swipe ← → on race card
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={
                      (activeRacePerMeeting[meetingCard.id] ??
                        meetingCard.races[0]?.raceNumber ??
                        1) <= (meetingCard.races[0]?.raceNumber ?? 1)
                    }
                    onClick={() => handleStepRace(meetingCard, -1)}
                    className="p-1 rounded-full border border-[#E5E5EA] dark:border-[#1F2D26] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition active:scale-95"
                    title="Previous Race"
                    aria-label="Previous Race"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-[#1D1D1F] dark:text-[#F3F4F0] px-1">
                    R
                    {activeRacePerMeeting[meetingCard.id] ??
                      meetingCard.races[0]?.raceNumber ??
                      1}
                    /{meetingCard.races.length}
                  </span>
                  <button
                    type="button"
                    disabled={
                      (activeRacePerMeeting[meetingCard.id] ??
                        meetingCard.races[0]?.raceNumber ??
                        1) >=
                      (meetingCard.races[meetingCard.races.length - 1]?.raceNumber ??
                        meetingCard.races.length)
                    }
                    onClick={() => handleStepRace(meetingCard, 1)}
                    className="p-1 rounded-full border border-[#E5E5EA] dark:border-[#1F2D26] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition active:scale-95"
                    title="Next Race"
                    aria-label="Next Race"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Race Navigation Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                {meetingCard.races.map((r) => {
                  const isJoker = activeJokerRaceNo === r.raceNumber;
                  const isFeature = featureRaceNo === r.raceNumber;
                  const curActive =
                    (activeRacePerMeeting[meetingCard.id] ??
                      (selectedRaceNumber && meetingCard.races.some((rc) => rc.raceNumber === selectedRaceNumber)
                        ? selectedRaceNumber
                        : meetingCard.races[0]?.raceNumber ?? 1)) === r.raceNumber;
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
                      id={`ribbon-race-btn-${meetingCard.id}-${r.raceNumber}`}
                      type="button"
                      onClick={() => {
                        selectRace(meetingCard.id, r.raceNumber);
                        if (selectionViewMode === "cards") {
                          const el = document.getElementById(
                            `race-card-${meetingCard.id}-${r.raceNumber}`
                          );
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full border font-mono text-xs tabular-nums shrink-0 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                        curActive
                          ? "bg-[#0071E3] border-[#0071E3] text-white font-bold shadow-sm scale-102 ring-2 ring-[#0071E3]/35"
                          : ev.isComplete
                          ? "bg-[#EAFBF0] border-[#34C759]/40 text-[#34C759] hover:border-[#34C759]"
                          : pickCount > 0
                          ? "bg-[#FFF9F2] border-[#FF9500]/40 text-[#FF9500] hover:border-[#FF9500]"
                          : "bg-white border-[#E5E5EA] text-[#86868B] hover:border-[#D2D2D7] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>
                        {isJoker ? "🃏 " : ""}R{r.raceNumber}
                        {isFeature ? " ★" : ""}
                      </span>
                      <span className="text-[10px]">
                        {ev.isComplete ? (
                          <strong className={curActive ? "text-white" : "text-[#34C759]"}>
                            3/3 ✓
                          </strong>
                        ) : pickCount > 0 ? (
                          <span className={curActive ? "text-white" : "text-[#FF9500]"}>
                            {pickCount}/3
                          </span>
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

                  const isRaceCollapsed = Boolean(
                    collapsedRaces[`${meetingCard.id}_R${race.raceNumber}`] &&
                      pickCount === 3
                  );

                  // Simplified Collapsed View (once all 3 tips entered)
                  if (isRaceCollapsed) {
                    return (
                      <div
                        key={race.raceNumber}
                        id={`race-card-${meetingCard.id}-${race.raceNumber}`}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isJokerRace
                            ? "border-[#FF9500]/50 bg-white shadow-xs ring-1 ring-[#FF9500]/30"
                            : "border-[#E5E5EA] bg-white hover:border-[#D2D2D7] shadow-xs"
                        }`}
                      >
                        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Race Badge, Name, Jump Time, Distance, Track */}
                          <div className="flex items-start sm:items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[#1D1D1F] font-mono font-bold text-xs shrink-0">
                              R{race.raceNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base text-[#1D1D1F]">
                                  {race.raceName}
                                </span>
                                {isFeature && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 text-[#FF9500] text-[10px] font-mono font-bold uppercase tracking-wider">
                                    ★ FEATURE
                                  </span>
                                )}
                                {isJokerRace && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#FF9500] text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs flex items-center gap-1">
                                    <span>🃏</span>
                                    <span>2× Joker Active</span>
                                  </span>
                                )}
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                                    evaluated.isRaceResulted
                                      ? "bg-[#EAFBF0] text-[#34C759]"
                                      : "bg-[#EBF5FF] text-[#0071E3]"
                                  }`}
                                >
                                  {evaluated.isRaceResulted
                                    ? "OFFICIAL FINAL"
                                    : "UPCOMING"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#86868B] font-mono mt-1 flex-wrap">
                                <span className="text-[#1D1D1F] font-medium">
                                  Jumps {race.startTime}
                                </span>
                                <span>•</span>
                                <span>{race.distance}m</span>
                                <span>•</span>
                                <span>
                                  Track: {meetingCard.trackCondition || "Good 4"}
                                </span>
                                {evaluated.isRaceResulted && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[#34C759] font-semibold">
                                      Result:{" "}
                                      {scoringMode === "dollars"
                                        ? formatDollarReturn(
                                            evaluated.raceDollarReturn
                                          )
                                        : `${evaluated.racePointsTally} pts`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Center: The 3 Selections */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 1st Selection */}
                            <div className="px-3.5 py-1.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/30 flex items-center gap-2 text-xs font-mono">
                              <span className="px-2 py-0.5 rounded-full bg-[#FF9500] text-white font-bold text-[10px]">
                                1ST
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#1D1D1F]">
                                  #{sel1Runner?.tabNumber}{" "}
                                  {sel1Runner?.horseName}
                                </span>
                                {(sel1Runner?.fixedWin ||
                                  sel1Runner?.nswTabWin) && (
                                  <span className="text-[#FF9500] font-semibold">
                                    $
                                    {Number(
                                      sel1Runner.fixedWin ||
                                        sel1Runner.nswTabWin
                                    ).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 2nd Selection */}
                            <div className="px-3.5 py-1.5 rounded-full bg-[#EBF5FF] border border-[#0071E3]/30 flex items-center gap-2 text-xs font-mono">
                              <span className="px-2 py-0.5 rounded-full bg-[#0071E3] text-white font-bold text-[10px]">
                                2ND
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#1D1D1F]">
                                  #{sel2Runner?.tabNumber}{" "}
                                  {sel2Runner?.horseName}
                                </span>
                                {(sel2Runner?.fixedWin ||
                                  sel2Runner?.nswTabWin) && (
                                  <span className="text-[#0071E3] font-semibold">
                                    $
                                    {Number(
                                      sel2Runner.fixedWin ||
                                        sel2Runner.nswTabWin
                                    ).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 3rd Selection */}
                            <div className="px-3.5 py-1.5 rounded-full bg-[#EAFBF0] border border-[#34C759]/30 flex items-center gap-2 text-xs font-mono">
                              <span className="px-2 py-0.5 rounded-full bg-[#34C759] text-white font-bold text-[10px]">
                                3RD
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#1D1D1F]">
                                  #{sel3Runner?.tabNumber}{" "}
                                  {sel3Runner?.horseName}
                                </span>
                                {(sel3Runner?.fixedWin ||
                                  sel3Runner?.nswTabWin) && (
                                  <span className="text-[#34C759] font-semibold">
                                    $
                                    {Number(
                                      sel3Runner.fixedWin ||
                                        sel3Runner.nswTabWin
                                    ).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Expand / Edit and Clear buttons */}
                          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                            <button
                              type="button"
                              onClick={() =>
                                toggleRaceCollapse(
                                  meetingCard.id,
                                  race.raceNumber
                                )
                              }
                              className="apple-btn-secondary"
                              title="Expand race to view full runners table and modify selections"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Edit / Expand</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleClearRacePicks(
                                  activePunter.id,
                                  meetingCard.id,
                                  race.raceNumber
                                )
                              }
                              className="p-2 rounded-full text-xs font-mono text-[#86868B] hover:text-[#FF3B30] bg-[#F2F2F7] border border-[#E5E5EA] hover:border-[#FF3B30]/30 transition cursor-pointer"
                              title="Clear picks for this race"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={race.raceNumber}
                      id={`race-card-${meetingCard.id}-${race.raceNumber}`}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isJokerRace
                          ? "border-[#FF9500]/50 bg-white shadow-xs ring-1 ring-[#FF9500]/30"
                          : "border-[#E5E5EA] bg-white hover:border-[#D2D2D7] shadow-xs"
                      }`}
                    >
                      {/* Race Card Header */}
                      <div className="px-5 py-4 bg-[#FAF9FA] border-b border-[#E5E5EA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[#1D1D1F] font-mono font-bold text-xs">
                            R{race.raceNumber}
                          </span>
                          <span className="font-semibold text-base text-[#1D1D1F]">
                            {race.raceName}
                          </span>

                          {isFeature && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 text-[#FF9500] text-[10px] font-mono font-bold uppercase tracking-wider">
                              ★ FEATURE RACE
                            </span>
                          )}

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                              evaluated.isRaceResulted
                                ? "bg-[#EAFBF0] text-[#34C759]"
                                : "bg-[#EBF5FF] text-[#0071E3]"
                            }`}
                          >
                            {evaluated.isRaceResulted ? "OFFICIAL FINAL" : "UPCOMING"}
                          </span>

                          <span className="text-xs text-[#86868B] font-mono">
                            Jumps {race.startTime} · {race.distance}m · Track: {meetingCard.trackCondition || "Good 4"}
                          </span>
                        </div>

                        {/* Quick Controls & Joker Toggle */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Pick Count Badge */}
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-xs font-mono">
                            <span className="text-[#86868B]">Picks:</span>
                            {pickCount === 3 ? (
                              <span className="text-[#34C759] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>3/3 Complete</span>
                              </span>
                            ) : (
                              <span className="text-[#0071E3] font-semibold">
                                {pickCount}/3 Selected
                              </span>
                            )}
                          </div>

                          {/* Collapse Card Toggle - only available once all 3 selections made */}
                          {pickCount === 3 && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleRaceCollapse(
                                  meetingCard.id,
                                  race.raceNumber
                                )
                              }
                              className="px-3 py-1 rounded-full text-xs font-mono font-semibold text-[#0071E3] bg-[#EBF5FF] border border-[#0071E3]/20 hover:bg-[#D6EBFF] transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                              title="Collapse race into simplified summary view"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Collapse Card</span>
                            </button>
                          )}

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
                            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
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
                            <tr className="border-b border-[#E5E5EA] bg-[#FAF9FA] text-[11px] font-mono text-[#86868B] uppercase tracking-wider">
                              <th className="py-3 px-3 w-12 text-center">#</th>
                              <th className="py-3 px-3 min-w-[170px]">Runner</th>
                              <th className="py-3 px-3 min-w-[220px]">Form &amp; Brief Analysis</th>
                              <th className="py-3 px-3 w-36 text-center">Odds &amp; Dynamics</th>
                              <th className="py-3 px-2 w-24 text-center bg-[#FFF9F2] border-l border-[#E5E5EA]">
                                <span className="text-[#FF9500] font-bold block">1st Pref</span>
                                <span className="text-[9px] text-[#86868B] lowercase font-normal">Selection 1</span>
                              </th>
                              <th className="py-3 px-2 w-24 text-center bg-[#F2F7FF] border-l border-[#E5E5EA]">
                                <span className="text-[#0071E3] font-bold block">2nd Pref</span>
                                <span className="text-[9px] text-[#86868B] lowercase font-normal">Selection 2</span>
                              </th>
                              <th className="py-3 px-2 w-24 text-center bg-[#F2FBF5] border-l border-[#E5E5EA]">
                                <span className="text-[#34C759] font-bold block">3rd Pref</span>
                                <span className="text-[9px] text-[#86868B] lowercase font-normal">Selection 3</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E5EA] text-xs">
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
                                      ? "opacity-40 bg-[#FAF9FA]"
                                      : isSelected
                                      ? is1st
                                        ? "bg-[#FFFDF9] hover:bg-[#FFF8EC]"
                                        : is2nd
                                        ? "bg-[#F7FAFF] hover:bg-[#EFF5FF]"
                                        : "bg-[#F7FCF9] hover:bg-[#EEFAF2]"
                                      : "hover:bg-[#FAF9FA]"
                                  }`}
                                >
                                  {/* Tab Number Badge */}
                                  <td className="py-3 px-3 text-center align-middle">
                                    <span
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-mono font-bold text-xs ${
                                        isSelected
                                          ? is1st
                                            ? "bg-[#FF9500] text-white shadow-xs"
                                            : is2nd
                                            ? "bg-[#0071E3] text-white shadow-xs"
                                            : "bg-[#34C759] text-white shadow-xs"
                                          : "bg-[#F2F2F7] text-[#1D1D1F] border border-[#E5E5EA]"
                                      }`}
                                    >
                                      {runner.tabNumber}
                                    </span>
                                  </td>

                                  {/* Runner Info */}
                                  <td className="py-3 px-3 align-middle">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`font-semibold text-sm ${
                                          isSelected
                                            ? "text-[#1D1D1F]"
                                            : "text-[#1D1D1F]"
                                        }`}
                                      >
                                        {runner.horseName}
                                      </span>
                                      {isScratched && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-[#FEECEB] border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-[9px] font-bold">
                                          SCR
                                        </span>
                                      )}
                                      {finishPos === 1 && (
                                        <span className="px-2 py-0.5 rounded-full bg-[#FFF5E6] text-[#FF9500] font-mono text-[10px] font-bold">
                                          1st 🏆
                                        </span>
                                      )}
                                      {finishPos === 2 && (
                                        <span className="px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B] font-mono text-[10px] font-bold">
                                          2nd 🥈
                                        </span>
                                      )}
                                      {finishPos === 3 && (
                                        <span className="px-2 py-0.5 rounded-full bg-[#FFF5E6] text-[#FF9500] font-mono text-[10px] font-bold">
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
                                    <div className="text-[11px] text-[#86868B] font-mono mt-0.5">
                                      <span>
                                        B{runner.barrier} ·{" "}
                                        {runner.weight ? `${runner.weight}kg · ` : ""}
                                        {runner.jockey || "Jockey TBA"}
                                      </span>
                                      {runner.trainer && (
                                        <span className="text-[#86868B]">
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
                                        <span className="px-2 py-0.5 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] font-mono text-[10px] font-medium text-[#1D1D1F]">
                                          Form: {runner.form || "—"}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${
                                            speedMapPos === "Leader"
                                              ? "bg-[#FFF5E6] text-[#FF9500] border border-[#FF9500]/30"
                                              : speedMapPos === "On Pace"
                                              ? "bg-[#EAFBF0] text-[#34C759] border border-[#34C759]/30"
                                              : speedMapPos === "Midfield"
                                              ? "bg-[#EBF5FF] text-[#0071E3] border border-[#0071E3]/30"
                                              : "bg-[#F2F2F7] text-[#86868B] border border-[#E5E5EA]"
                                          }`}
                                        >
                                          {speedMapPos}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-[#86868B] leading-relaxed">
                                        {comment}
                                      </p>
                                    </div>
                                  </td>

                                  {/* Odds Dynamics & Current Price */}
                                  <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                    <div className="font-mono">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className="font-bold text-sm text-[#1D1D1F]">
                                          {winOdds > 0 ? `$${winOdds.toFixed(2)}` : "—"}
                                        </span>
                                        {placeOdds > 0 && (
                                          <span className="text-[10px] text-[#86868B]">
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
                                  <td className="py-3 px-2 text-center align-middle bg-[#FFF9F2] border-l border-[#E5E5EA]">
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
                                      className={`w-14 h-8 mx-auto rounded-full border font-mono text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#E5E5EA]"
                                          : is1st
                                          ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs scale-102"
                                          : "bg-white border-[#E5E5EA] text-[#86868B] hover:border-[#FF9500] hover:text-[#FF9500]"
                                      }`}
                                    >
                                      {is1st ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>1st</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#86868B]">1st</span>
                                      )}
                                    </button>
                                  </td>

                                  {/* Selection 2 Column Checkbox */}
                                  <td className="py-3 px-2 text-center align-middle bg-[#F2F7FF] border-l border-[#E5E5EA]">
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
                                      className={`w-14 h-8 mx-auto rounded-full border font-mono text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#E5E5EA]"
                                          : is2nd
                                          ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs scale-102"
                                          : "bg-white border-[#E5E5EA] text-[#86868B] hover:border-[#0071E3] hover:text-[#0071E3]"
                                      }`}
                                    >
                                      {is2nd ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>2nd</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#86868B]">2nd</span>
                                      )}
                                    </button>
                                  </td>

                                  {/* Selection 3 Column Checkbox */}
                                  <td className="py-3 px-2 text-center align-middle bg-[#F2FBF5] border-l border-[#E5E5EA]">
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
                                      className={`w-14 h-8 mx-auto rounded-full border font-mono text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                        isScratched
                                          ? "opacity-30 cursor-not-allowed bg-transparent border-[#E5E5EA]"
                                          : is3rd
                                          ? "bg-[#34C759] text-white border-[#34C759] shadow-xs scale-102"
                                          : "bg-white border-[#E5E5EA] text-[#86868B] hover:border-[#34C759] hover:text-[#34C759]"
                                      }`}
                                    >
                                      {is3rd ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          <span>3rd</span>
                                        </>
                                      ) : (
                                        <span className="text-[11px] text-[#86868B]">3rd</span>
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
                  (selectedRaceNumber && meetingCard.races.some((rc) => rc.raceNumber === selectedRaceNumber)
                    ? selectedRaceNumber
                    : meetingCard.races[0]?.raceNumber ?? 1);
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
                  <div
                    key={`focused-race-${meetingCard.id}-${activeRace.raceNumber}`}
                    className="p-3 sm:p-5 space-y-4 swipe-card-enter select-none sm:select-auto"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => handleTouchEnd(e, meetingCard)}
                  >
                    {/* Active Race Header Strip */}
                    <div className="apple-card p-4 sm:p-5 space-y-4">
                      {/* Swipe & Keyboard Gesture Affordance Ribbon */}
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#F2F2F7] text-[11px] font-mono text-[#86868B]">
                        <button
                          type="button"
                          disabled={activeRace.raceNumber <= (meetingCard.races[0]?.raceNumber ?? 1)}
                          onClick={() => handleStepRace(meetingCard, -1)}
                          className="hover:text-[#1D1D1F] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>R{activeRace.raceNumber - 1}</span>
                        </button>
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="text-[#0071E3] font-bold">Swipe ← →</span> or Left/Right Arrow Keys
                        </span>
                        <button
                          type="button"
                          disabled={
                            activeRace.raceNumber >=
                            (meetingCard.races[meetingCard.races.length - 1]?.raceNumber ??
                              meetingCard.races.length)
                          }
                          onClick={() => handleStepRace(meetingCard, 1)}
                          className="hover:text-[#1D1D1F] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold transition"
                        >
                          <span>R{activeRace.raceNumber + 1}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E5EA] pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-[#1D1D1F] tracking-tight">
                              Race {activeRace.raceNumber}: {activeRace.raceName}
                            </span>
                            {featureRaceNo === activeRace.raceNumber && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 text-[#FF9500] text-[10px] font-mono font-bold uppercase">
                                ★ Feature Race
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                                activeEvaluated.isRaceResulted
                                  ? "bg-[#EAFBF0] text-[#34C759] border border-[#34C759]/30"
                                  : "bg-[#F2F2F7] text-[#86868B] border border-[#E5E5EA]"
                              }`}
                            >
                              {activeEvaluated.isRaceResulted
                                ? "Official Final"
                                : "Upcoming"}
                            </span>
                          </div>
                          <p className="text-xs text-[#86868B] mt-1">
                            Jumps {activeRace.startTime} · {activeRace.distance}m · Track:{" "}
                            {meetingCard.trackCondition || "Good 4"} · Rail:{" "}
                            {meetingCard.railPosition || "True"}
                          </p>
                        </div>

                        {/* Quick Action Controls */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const nextJoker = isJokerOnActiveRace ? null : activeRace.raceNumber;
                              onToggleJokerRace?.(
                                activePunter.id,
                                meetingCard.id,
                                nextJoker
                              );
                              if (nextJoker !== null) {
                                audioAlerts.playSelectionClick(1);
                                triggerHaptic([20, 30, 20]);
                              } else {
                                audioAlerts.playTapClick();
                                triggerHaptic(10);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                              isJokerOnActiveRace
                                ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs scale-102 ring-2 ring-[#FF9500]/30"
                                : "bg-white text-[#1D1D1F] border-[#E5E5EA] hover:border-[#FF9500] hover:text-[#FF9500]"
                            }`}
                          >
                            {isJokerOnActiveRace
                              ? "🃏 Joker 2× Active"
                              : "🃏 Play Joker (2×)"}
                          </button>

                          {/* Smart Strategy Auto-Pick Bar */}
                          <div className="flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-full border border-[#E5E5EA]">
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
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-[#86868B] hover:text-[#1D1D1F] hover:bg-white transition-all cursor-pointer active:scale-95"
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
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-[#86868B] hover:text-[#0071E3] hover:bg-white transition-all cursor-pointer active:scale-95"
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
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-[#86868B] hover:text-[#0071E3] hover:bg-white transition-all cursor-pointer active:scale-95"
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
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#0071E3] bg-white shadow-xs transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                              title="Randomly pick 1 top-3 favourite + 2 other runners"
                            >
                              <Sparkles className="w-3 h-3 text-[#0071E3]" />
                              <span>Auto</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleHarvilleModel(meetingCard.id, activeRace.raceNumber)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 ${
                              isHarvilleExpanded
                                ? "bg-[#EBF5FF] border-[#0071E3] text-[#0071E3]"
                                : "bg-white border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
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
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer active:scale-95"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Official Placegetters (if resulted) */}
                      {activeEvaluated.isRaceResulted && (
                        <div className="p-3.5 rounded-2xl bg-[#EAFBF0] border border-[#34C759]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[#34C759] font-bold">Official Placings:</span>
                            {activeRace.runners
                              .filter((r) => r.finishPosition >= 1 && r.finishPosition <= 3)
                              .sort((a, b) => a.finishPosition - b.finishPosition)
                              .map((r) => (
                                <span key={r.tabNumber} className="text-[#1D1D1F]">
                                  <strong
                                    className={
                                      r.finishPosition === 1
                                        ? "text-[#FF9500]"
                                        : r.finishPosition === 2
                                        ? "text-[#86868B]"
                                        : "text-[#34C759]"
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
                            <span className="text-[#86868B]">Punter Return: </span>
                            <strong className="text-[#34C759] text-sm">
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
                          className={`px-3.5 py-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2.5 ${
                            consensusInfo.type === "consensus"
                              ? "bg-[#FFF9F2] border-[#FF9500]/30 text-[#FF9500]"
                              : consensusInfo.type === "clash"
                              ? "bg-[#FBF5FF] border-[#AF52DE]/30 text-[#AF52DE]"
                              : "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {consensusInfo.type === "consensus" ? (
                              <Flame className="w-4 h-4 text-[#FF9500] shrink-0" />
                            ) : consensusInfo.type === "clash" ? (
                              <Swords className="w-4 h-4 text-[#AF52DE] shrink-0" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-[#86868B] shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-[#1D1D1F] mr-2">
                                {consensusInfo.headline}:
                              </span>
                              <span className="text-[#86868B]">{consensusInfo.text}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Deep Analysis Drawer (Harville Win Probabilities) */}
                      {isHarvilleExpanded && (
                        <div className="p-4 bg-[#FAF9FA] rounded-2xl border border-[#E5E5EA] space-y-3">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-[#0071E3] font-semibold">
                              Runner Win Likelihood Analytics
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                toggleHarvilleModel(meetingCard.id, activeRace.raceNumber)
                              }
                              className="text-[#86868B] hover:text-[#1D1D1F] text-[11px] cursor-pointer"
                            >
                              Close Analytics ✕
                            </button>
                          </div>
                          <HarvillePlackettLuceModel race={activeRace} compact />
                        </div>
                      )}

                      {/* High-Density Quick-Pick Runner Cards with Tactile Elevation & Border Pulse */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
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
                              className={`tactile-runner-card p-3.5 rounded-2xl border transition-all duration-200 ${
                                is1st
                                  ? "tactile-rank-1-active bg-[#FFF9F2] border-[#FF9500] ring-2 ring-[#FF9500]/30 shadow-md -translate-y-0.5"
                                  : is2nd
                                  ? "tactile-rank-2-active bg-[#F2F7FF] border-[#0071E3] ring-2 ring-[#0071E3]/30 shadow-md -translate-y-0.5"
                                  : is3rd
                                  ? "tactile-rank-3-active bg-[#F2FBF5] border-[#34C759] ring-2 ring-[#34C759]/30 shadow-md -translate-y-0.5"
                                  : runner.isScratched
                                  ? "bg-[#FAF9FA] border-[#E5E5EA] opacity-40"
                                  : "bg-white border-[#E5E5EA] hover:border-[#0071E3]/40 hover:-translate-y-0.5 shadow-xs"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`w-6 h-6 rounded-full font-mono font-bold text-xs flex items-center justify-center transition-all ${
                                        is1st
                                          ? "bg-[#FF9500] text-white ring-2 ring-[#FF9500]/40 scale-105"
                                          : is2nd
                                          ? "bg-[#0071E3] text-white ring-2 ring-[#0071E3]/40 scale-105"
                                          : is3rd
                                          ? "bg-[#34C759] text-white ring-2 ring-[#34C759]/40 scale-105"
                                          : "bg-[#F2F2F7] text-[#1D1D1F] border border-[#E5E5EA]"
                                      }`}
                                    >
                                      {runner.tabNumber}
                                    </span>
                                    <span className="font-semibold text-sm text-[#1D1D1F]">
                                      {runner.horseName}
                                    </span>
                                    <span className="text-[11px] font-mono text-[#86868B]">
                                      (B{runner.barrier})
                                    </span>
                                    {runner.form && (
                                      <span className="text-[11px] font-mono text-[#34C759] font-medium">
                                        {runner.form}
                                      </span>
                                    )}
                                    {mapShort && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B]">
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
                                  <div className="text-[11px] text-[#86868B] font-mono">
                                    J: {runner.jockey} · {runner.weight}kg · T:{" "}
                                    {runner.trainer || "Stable"}
                                  </div>
                                </div>

                                {/* Odds & Flucs */}
                                <div className="text-right font-mono shrink-0">
                                  <div className="text-sm font-bold text-[#1D1D1F] tabular-nums">
                                    ${(Number(runner.nswTabWin) || 0).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-[#86868B] tabular-nums">
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
                                      heatGlow={false}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Tactile Preference Selectors */}
                              <div className="mt-3 pt-2.5 border-t border-[#E5E5EA] flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                  {isStevePick && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 text-[#FF9500] font-semibold">
                                      Steve F ({isStevePick})
                                    </span>
                                  )}
                                  {isMarkPick && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#EAFBF0] border border-[#34C759]/40 text-[#34C759] font-semibold">
                                      Mark S ({isMarkPick})
                                    </span>
                                  )}
                                  {runner.isScratched && (
                                    <span className="text-[#FF3B30] font-bold">
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
                                      className={`min-h-[30px] px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer active:scale-95 ${
                                        is1st
                                          ? "bg-[#FF9500] text-white shadow-xs ring-2 ring-[#FF9500]/40 scale-102"
                                          : "bg-white border border-[#E5E5EA] text-[#86868B] hover:border-[#FF9500] hover:text-[#FF9500]"
                                      }`}
                                      title="Nominate as 1st Preference (3 pts)"
                                    >
                                      {is1st ? "✓ 1st (3pts)" : "1st (3pts)"}
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
                                      className={`min-h-[30px] px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer active:scale-95 ${
                                        is2nd
                                          ? "bg-[#0071E3] text-white shadow-xs ring-2 ring-[#0071E3]/40 scale-102"
                                          : "bg-white border border-[#E5E5EA] text-[#86868B] hover:border-[#0071E3] hover:text-[#0071E3]"
                                      }`}
                                      title="Nominate as 2nd Preference (2 pts)"
                                    >
                                      {is2nd ? "✓ 2nd (2pts)" : "2nd (2pts)"}
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
                                      className={`min-h-[30px] px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer active:scale-95 ${
                                        is3rd
                                          ? "bg-[#34C759] text-white shadow-xs ring-2 ring-[#34C759]/40 scale-102"
                                          : "bg-white border border-[#E5E5EA] text-[#86868B] hover:border-[#34C759] hover:text-[#34C759]"
                                      }`}
                                      title="Nominate as 3rd Preference (1 pt)"
                                    >
                                      {is3rd ? "✓ 3rd (1pt)" : "3rd (1pt)"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Stepper Bottom Navigation */}
                      <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E5E5EA]">
                        <button
                          type="button"
                          disabled={activeRace.raceNumber <= (meetingCard.races[0]?.raceNumber ?? 1)}
                          onClick={() => handleStepRace(meetingCard, -1)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-[#E5E5EA] bg-white text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Previous Race (← R{activeRace.raceNumber - 1})</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#86868B]">
                            Race {activeRace.raceNumber} of {meetingCard.races.length} ·{" "}
                            {activeEvaluated.isComplete ? (
                              <strong className="text-[#34C759]">3/3 Picked ✓</strong>
                            ) : (
                              <span className="text-[#FF9500] font-semibold">Incomplete</span>
                            )}
                          </span>

                          {!activeEvaluated.isComplete && (
                            <button
                              type="button"
                              onClick={() => handleAutoPickSingleRace(activeRace, meetingCard.id)}
                              className="px-2.5 py-1 rounded-full bg-[#EBF5FF] border border-[#0071E3]/25 text-[#0071E3] hover:bg-[#0071E3] hover:text-white text-[11px] font-mono font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              🎲 Auto-Pick Race
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={
                            activeRace.raceNumber >=
                            (meetingCard.races[meetingCard.races.length - 1]?.raceNumber ??
                              meetingCard.races.length)
                          }
                          onClick={() => handleStepRace(meetingCard, 1)}
                          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border text-xs font-semibold active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                            activeEvaluated.isComplete
                              ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                              : "border-[#E5E5EA] bg-white text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] shadow-xs"
                          }`}
                        >
                          <span>Next Race (R{activeRace.raceNumber + 1} →)</span>
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
                  <tr className="border-b border-[#E5E5EA] bg-[#FAF9FA] text-[12px] text-[#86868B] font-semibold">
                    <th className="py-3 px-3 whitespace-nowrap">
                      Race · Time
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">
                      Race Status / Official 1st–2nd–3rd
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">
                      1st Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">
                      2nd Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">
                      3rd Preference (1u Win + 1u Place)
                    </th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">
                      {scoringMode === "dollars"
                        ? "Completed Race $ Return"
                        : "Completed Race Points"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5EA] text-xs">
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
                            ? "bg-[#FFF9F2] hover:bg-[#FFF4E6]"
                            : "hover:bg-[#FAF9FA]"
                        }`}
                      >
                        {/* Race Info + Joker Toggle */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1D1D1F] text-sm">
                              R{race.raceNumber}
                            </span>
                            <span className="font-mono text-xs text-[#86868B]">
                              {race.startTime} · {race.distance}m
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                                evaluated.isRaceResulted
                                  ? "bg-[#EAFBF0] text-[#34C759] border border-[#34C759]/30"
                                  : "bg-[#F2F2F7] text-[#86868B] border border-[#E5E5EA]"
                              }`}
                            >
                              {evaluated.isRaceResulted ? "FINAL" : "UPCOMING"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="text-[#1D1D1F] font-semibold mt-0.5 max-w-[190px] truncate">
                              {race.raceName}
                            </div>
                            {featureRaceNo === race.raceNumber && (
                              <span className="px-2 py-0.5 rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 text-[#FF9500] text-[9px] font-mono font-bold uppercase shrink-0">
                                ★ FEATURE
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                onToggleJokerRace?.(
                                  activePunter.id,
                                  meetingCard.id,
                                  isJokerRace ? null : race.raceNumber
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                                isJokerRace
                                  ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                                  : "bg-white text-[#1D1D1F] border-[#E5E5EA] hover:border-[#FF9500] hover:text-[#FF9500]"
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
                              className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white border border-[#E5E5EA] text-[#0071E3] hover:border-[#0071E3] transition-all cursor-pointer shadow-xs"
                              title="Auto-pick this race: randomly select at least 1 of top 3 favourites + 2 other runners"
                            >
                              🎲 Auto Pick
                            </button>
                            <span className="text-[11px] font-mono">
                              {evaluated.isComplete ? (
                                <span className="text-[#34C759] font-semibold">3/3</span>
                              ) : evaluated.hasAnySelection ? (
                                <span className="text-[#FF9500] font-semibold">Partial</span>
                              ) : (
                                <span className="text-[#86868B]">Pick 3</span>
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
                              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all cursor-pointer ${
                                isMapExpanded
                                  ? "bg-[#EBF5FF] text-[#0071E3] border-[#0071E3] font-semibold"
                                  : "bg-white text-[#86868B] border-[#E5E5EA] hover:text-[#1D1D1F]"
                              }`}
                              title="Toggle Speed Map (Leader/On-Pace/Midfield/Back) and Market Flucs for this race"
                            >
                              {isMapExpanded
                                ? "▾ Speed Map & Flucs"
                                : "▸ Speed Map & Flucs"}
                            </button>
                          </div>
                          {autoSubReplacements.length > 0 && (
                            <div className="mt-1 text-[10px] font-mono text-[#34C759]">
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
                              <div className="inline-flex items-center gap-1.5 text-[#FF9500] font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Race Not Complete ({race.startTime})</span>
                              </div>
                              <div className="text-[#86868B] text-[10px]">
                                {race.bettingForecast
                                  ? `Favs: ${race.bettingForecast}`
                                  : "Results appear upon official All-Clear"}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-[#FF9500] font-semibold">
                                1st:{" "}
                                {firstPlace
                                  ? `#${firstPlace.tabNumber} ${firstPlace.horseName} (W $${(
                                      Number(firstPlace.nswTabWin) || 0
                                    ).toFixed(2)} / P $${(
                                      Number(firstPlace.nswTabPlace) || 0
                                    ).toFixed(2)})`
                                  : "Official Pending"}
                              </div>
                              <div className="text-[#86868B] mt-0.5">
                                2nd:{" "}
                                {secondPlace
                                  ? `#${secondPlace.tabNumber} ${secondPlace.horseName} (P $${(
                                      Number(secondPlace.nswTabPlace) || 0
                                    ).toFixed(2)})`
                                  : "Official Pending"}
                              </div>
                              <div className="text-[#34C759] mt-0.5">
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
                                className="w-full bg-white border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] font-medium focus:outline-none focus:border-[#0071E3] shadow-xs"
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
                                    <span className="text-[#86868B]">
                                      J: {pick.runner.jockey} (B
                                      {pick.runner.barrier})
                                    </span>
                                    {!evaluated.isRaceResulted ? (
                                      <span className="text-[#FF9500]">
                                        Locked · W $
                                        {(
                                          Number(pick.runner.nswTabWin) || 0
                                        ).toFixed(2)}
                                      </span>
                                    ) : scoringMode === "dollars" ? (
                                      pick.dollarReturn > 0 ? (
                                        <span className="font-semibold text-[#34C759]">
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
                                        <span className="text-[#86868B]">
                                          Unp · $0
                                        </span>
                                      )
                                    ) : pick.finishPosition === 1 ? (
                                      <span className="font-semibold text-[#FF9500]">
                                        Finished 1st · +{pick.points} pts
                                        {evaluated.jokerTriggered &&
                                        pick.preferenceRank === 1
                                          ? " (2× JOKER!)"
                                          : ""}
                                      </span>
                                    ) : pick.finishPosition === 2 ? (
                                      <span className="font-semibold text-[#86868B]">
                                        Finished 2nd · +{pick.points} pts
                                      </span>
                                    ) : pick.finishPosition === 3 ? (
                                      <span className="font-semibold text-[#34C759]">
                                        Finished 3rd · +{pick.points} pt
                                        {pick.points > 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[#86868B]">
                                        Unplaced · 0 pts
                                      </span>
                                    )}
                                  </div>
                                  {speedAndFlucs.byTabNumber[
                                    pick.runner.tabNumber
                                  ] && (
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-[#86868B]">
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
                                            ? "text-[#34C759] font-semibold"
                                            : speedAndFlucs.byTabNumber[
                                                pick.runner.tabNumber
                                              ].marketSupport === "Drifting"
                                            ? "text-[#FF9500]"
                                            : "text-[#86868B]"
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
                            <div className="text-xs text-[#86868B]">
                              — No selection
                              {isJokerRace && (
                                <div className="text-[10px] text-[#FF9500] font-bold mt-0.5">
                                  🃏 Joker Active (2×)
                                </div>
                              )}
                            </div>
                          ) : !evaluated.isRaceResulted ? (
                            <div>
                              <div className="text-xs font-semibold text-[#FF9500]">
                                {isJokerRace
                                  ? "🃏 Joker 2× Pending"
                                  : "Awaiting Result"}
                              </div>
                              <div className="text-[11px] text-[#86868B]">
                                Jumps {race.startTime}
                              </div>
                            </div>
                          ) : scoringMode === "dollars" ? (
                            <>
                              <div
                                className={`text-base font-bold ${
                                  evaluated.raceDollarReturn > 0
                                    ? "text-[#34C759]"
                                    : "text-[#86868B]"
                                }`}
                              >
                                {formatDollarReturn(evaluated.raceDollarReturn)}
                              </div>
                              <div className="text-[11px] text-[#86868B]">
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
                                    ? "text-[#FF9500]"
                                    : evaluated.racePointsTally >= 4
                                    ? "text-[#FF9500]"
                                    : evaluated.racePointsTally > 0
                                    ? "text-[#34C759]"
                                    : "text-[#86868B]"
                                }`}
                              >
                                {evaluated.racePointsTally} pts
                                {evaluated.jokerTriggered && (
                                  <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-[#FFF5E6] text-[#FF9500] font-bold border border-[#FF9500]/40">
                                    🃏 2× HIT
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#86868B]">
                                {evaluated.picks
                                  .map((p) =>
                                    p.tabNumber !== null ? `${p.points}` : "—"
                                  )
                                  .join(" + ")}{" "}
                                pts
                                {isJokerRace && !evaluated.jokerTriggered && (
                                  <span className="block text-[10px] text-[#86868B]">
                                    (Joker: No selections placed in top 3)
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                      {isMapExpanded && (
                        <tr className="bg-[#FAF9FA] border-b border-[#E5E5EA]">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#1D1D1F] font-bold">
                                    R{race.raceNumber} Speed Map &amp; Market
                                    Flucs ({race.distance}m)
                                  </span>
                                  <span className="text-[#86868B]">·</span>
                                  <span className="text-[#34C759] font-semibold">
                                    {speedAndFlucs.tempoLabel}
                                  </span>
                                  <span className="text-[#86868B] font-sans">
                                    — {speedAndFlucs.tempoAdvisory}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                  {speedAndFlucs.topFirmer && (
                                    <span className="text-[#34C759]">
                                      ★ Top Firmer: #
                                      {speedAndFlucs.topFirmer.tabNumber}{" "}
                                      {speedAndFlucs.topFirmer.horseName} (
                                      {speedAndFlucs.topFirmer.flucLabel})
                                    </span>
                                  )}
                                  {speedAndFlucs.biggestDrifter && (
                                    <span className="text-[#FF9500]">
                                      ▾ Market Drifter: #
                                      {speedAndFlucs.biggestDrifter.tabNumber}{" "}
                                      {speedAndFlucs.biggestDrifter.horseName} (
                                      {speedAndFlucs.biggestDrifter.flucLabel})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                                      className="p-3 rounded-2xl bg-white border border-[#E5E5EA] space-y-2 shadow-xs"
                                    >
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="font-bold text-[#1D1D1F]">
                                          {lane}
                                        </span>
                                        <span className="text-[#86868B]">
                                          {laneRunners.length} runner
                                          {laneRunners.length === 1 ? "" : "s"}
                                        </span>
                                      </div>
                                      {laneRunners.length === 0 ? (
                                        <div className="text-[11px] font-mono text-[#86868B]">
                                          — No dedicated {lane.toLowerCase()}
                                        </div>
                                      ) : (
                                        <div className="space-y-1.5">
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
                                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono flex items-center justify-between gap-1.5 border transition-all ${
                                                  isPicked
                                                    ? "bg-[#EAFBF0] border-[#34C759]/40 text-[#1D1D1F]"
                                                    : "bg-[#FAF9FA] border-[#E5E5EA] text-[#1D1D1F]"
                                                }`}
                                              >
                                                <span className="truncate">
                                                  <strong className="text-[#FF9500]">
                                                    #{lr.tabNumber}
                                                  </strong>{" "}
                                                  {lr.horseName} (B{lr.barrier})
                                                </span>
                                                <span
                                                  className={`shrink-0 tabular-nums ${
                                                    lr.marketSupport ===
                                                    "Firming"
                                                      ? "text-[#34C759] font-semibold"
                                                      : lr.marketSupport ===
                                                        "Drifting"
                                                      ? "text-[#FF9500]"
                                                      : "text-[#86868B]"
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
            <div className="md:hidden divide-y divide-[#E5E5EA]">
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
                      isJokerRace ? "bg-[#FFF9F2]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-[#1D1D1F]">
                          Race {race.raceNumber}: {race.raceName}
                        </span>
                        <div className="text-xs text-[#86868B] mt-0.5">
                          {race.startTime} · {race.distance}m ·{" "}
                          {evaluated.isRaceResulted ? (
                            <span className="text-[#34C759] font-semibold">FINAL</span>
                          ) : (
                            <span className="text-[#FF9500] font-semibold">UPCOMING</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleJokerRace?.(
                                activePunter.id,
                                meetingCard.id,
                                isJokerRace ? null : race.raceNumber
                              )
                            }
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                              isJokerRace
                                ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                                : "bg-white text-[#1D1D1F] border-[#E5E5EA]"
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
                            className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-[#E5E5EA] text-[#0071E3] hover:border-[#0071E3] cursor-pointer shadow-xs"
                            title="Auto Pick 1 Favourite + 2 Random Runners"
                          >
                            🎲 Auto Pick
                          </button>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        {!evaluated.hasAnySelection ? (
                          <div className="text-xs text-[#86868B]">
                            — No selection
                          </div>
                        ) : !evaluated.isRaceResulted ? (
                          <>
                            <div className="text-xs font-semibold text-[#FF9500]">
                              {isJokerRace ? "🃏 2× Pending" : "Pending Result"}
                            </div>
                            <div className="text-[11px] text-[#86868B]">
                              Jumps {race.startTime}
                            </div>
                          </>
                        ) : scoringMode === "dollars" ? (
                          <>
                            <div className="text-sm font-bold text-[#34C759]">
                              {formatDollarReturn(evaluated.raceDollarReturn)}
                            </div>
                            <div className="text-[11px] text-[#86868B]">
                              Race $ Return
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-[#FF9500]">
                              {evaluated.racePointsTally} pts
                              {evaluated.jokerTriggered ? " (2×!)" : ""}
                            </div>
                            <div className="text-[11px] text-[#86868B]">
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
                              <span className="text-[#86868B] font-medium">
                                {rankTitle}
                              </span>
                              {pick.runner && (
                                <span
                                  className={`font-mono font-semibold ${
                                    !evaluated.isRaceResulted
                                      ? "text-[#FF9500]"
                                      : scoringMode === "dollars"
                                      ? pick.dollarReturn > 0
                                        ? "text-[#34C759]"
                                        : "text-[#86868B]"
                                      : pick.points > 0
                                      ? "text-[#FF9500]"
                                      : "text-[#86868B]"
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
                              className="min-h-[44px] w-full bg-white border border-[#E5E5EA] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] shadow-xs"
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
