import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Sparkles,
  Trophy,
  DollarSign,
  CheckCircle2,
  Check,
  Target,
  Sliders,
  RotateCcw,
  Clock,
  Users,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Zap,
  Info,
  MapPin,
  Flame,
  Plus,
  ChevronDown,
  ChevronUp,
  Lock,
  Star,
  Layers,
  Award,
  Edit3,
  Filter,
} from "lucide-react";
import { RunnerAiAnalysisButton } from "./RunnerAiAnalysisButton";
import {
  RaceEvent,
  RaceMeeting,
  RaceRunner,
  PunterProfile,
} from "../types/racing";
import {
  CombinedRaceTrifectaEvaluation,
  CombinedMeetingQuaddieEvaluation,
  evaluateCombinedTrifectaForRace,
  evaluateCombinedQuaddieForMeeting,
  computeQuaddieLeg4SweatScenarios,
  formatDollarReturn,
  computeTabFlexiBetMetrics,
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  TrifectaBetType,
  CustomTrifectaRaceConfig,
  isRunnerScratched,
  computeCustomTrifectaCombinations,
  isRaceParticipatedByAnyPunter,
} from "../utils/scoring";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";
import { JockeySilkSvg } from "./JockeySilkSvg";

export interface ExoticsBentoStudioProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  activePunterId: string;
  onSelectPunter: (id: string) => void;
  trifectaBetAmount: number;
  onChangeTrifectaBetAmount: (amount: number) => void;
  quaddieBuyInPerUser: number;
  onChangeQuaddieBuyInPerUser: (buyIn: number) => void;
  quaddieExtraByMeeting: Record<string, Record<number, number[]>>;
  onToggleQuaddieExtraRunner: (
    meetingId: string,
    raceNumber: number,
    tabNumber: number
  ) => void;
  onClearQuaddieExtrasForLeg: (meetingId: string, raceNumber: number) => void;
  onJumpToSelections: (punterId?: string, meetingId?: string) => void;
  onTriggerToast?: (msg: string) => void;
}

export type ExoticsViewFilter = "all" | "trifectas" | "quaddies";

export const ExoticsBentoStudio: React.FC<ExoticsBentoStudioProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  punters,
  activePunterId,
  trifectaBetAmount,
  onChangeTrifectaBetAmount,
  quaddieBuyInPerUser,
  onChangeQuaddieBuyInPerUser,
  quaddieExtraByMeeting,
  onToggleQuaddieExtraRunner,
  onClearQuaddieExtrasForLeg,
  onJumpToSelections,
  onTriggerToast,
}) => {
  const [activeFilter, setActiveFilter] = useState<ExoticsViewFilter>("all");

  // Toggle: Show all scheduled races vs only participated races (defaults to false / participated only)
  const [showAllRaces, setShowAllRaces] = useState<boolean>(false);

  // Active meeting fallback
  const activeMeeting = useMemo(() => {
    return (
      meetings.find((m) => m.id === selectedMeetingId) || meetings[0] || null
    );
  }, [meetings, selectedMeetingId]);

  // Selected race for focused Trifecta customizer (defaults to first participated race)
  const [selectedRaceNo, setSelectedRaceNo] = useState<number>(() => {
    if (!activeMeeting || !activeMeeting.races.length) return 1;
    const candidates = activeMeeting.races.filter((r) =>
      isRaceParticipatedByAnyPunter(activeMeeting, r.raceNumber, punters)
    );
    return candidates.length > 0
      ? candidates[0].raceNumber
      : activeMeeting.races[0].raceNumber;
  });

  // Sync selected race with active meeting races & participation filter
  useEffect(() => {
    if (activeMeeting && activeMeeting.races.length > 0) {
      const candidates = !showAllRaces
        ? activeMeeting.races.filter((r) =>
            isRaceParticipatedByAnyPunter(activeMeeting, r.raceNumber, punters)
          )
        : activeMeeting.races;
      const pool =
        candidates.length > 0 ? candidates : activeMeeting.races;
      const exists = pool.some((r) => r.raceNumber === selectedRaceNo);
      if (!exists) {
        setSelectedRaceNo(pool[0].raceNumber);
      }
    }
  }, [activeMeeting, selectedRaceNo, showAllRaces, punters]);

  const activeRace: RaceEvent | null = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return null;
    const candidates = !showAllRaces
      ? activeMeeting.races.filter((r) =>
          isRaceParticipatedByAnyPunter(activeMeeting, r.raceNumber, punters)
        )
      : activeMeeting.races;
    const pool = candidates.length > 0 ? candidates : activeMeeting.races;
    return (
      pool.find((r) => r.raceNumber === selectedRaceNo) ||
      pool[0] ||
      activeMeeting.races[0] ||
      null
    );
  }, [activeMeeting, selectedRaceNo, showAllRaces, punters]);

  // Saved custom trifecta configurations and confirmed statuses
  const [customConfigs, setCustomConfigs] = useState<
    Record<string, CustomTrifectaRaceConfig>
  >(() => {
    try {
      const saved = localStorage.getItem("turfsheet_custom_trifecta_configs_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Option to modify trifecta selections (defaults to false / auto-final)
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);

  // Evaluate Trifecta for active race
  const activeTrifectaEval: CombinedRaceTrifectaEvaluation | null = useMemo(() => {
    if (!activeMeeting || !activeRace) return null;
    const raceKey = `${activeMeeting.id}_R${activeRace.raceNumber}`;
    return evaluateCombinedTrifectaForRace(
      activeRace,
      punters,
      activeMeeting.id,
      activeMeeting.date,
      trifectaBetAmount / Math.max(1, punters.length || 2),
      activeMeeting.venue,
      customConfigs[raceKey]
    );
  }, [activeMeeting, activeRace, punters, trifectaBetAmount, customConfigs]);

  // Evaluate all Trifectas across active meeting
  const allTrifectaEvals = useMemo(() => {
    if (!activeMeeting) return [];
    return activeMeeting.races.map((race) => {
      const raceKey = `${activeMeeting.id}_R${race.raceNumber}`;
      return {
        race,
        evaluation: evaluateCombinedTrifectaForRace(
          race,
          punters,
          activeMeeting.id,
          activeMeeting.date,
          trifectaBetAmount / Math.max(1, punters.length || 2),
          activeMeeting.venue,
          customConfigs[raceKey]
        ),
      };
    });
  }, [activeMeeting, punters, trifectaBetAmount, customConfigs]);

  // Evaluate all Trifectas across ALL participated meetings
  const allMeetingTrifectaEvals = useMemo(() => {
    return meetings
      .filter((m) => m.races && m.races.length > 0)
      .map((meeting) => {
        const raceEvals = meeting.races.map((race) => {
          const raceKey = `${meeting.id}_R${race.raceNumber}`;
          const evaluation = evaluateCombinedTrifectaForRace(
            race,
            punters,
            meeting.id,
            meeting.date,
            trifectaBetAmount / Math.max(1, punters.length || 2),
            meeting.venue,
            customConfigs[raceKey]
          );
          return {
            race,
            raceKey,
            evaluation,
          };
        });

        const participatedRaceEvals = raceEvals.filter(
          (r) => r.evaluation.hasCombinedSelections && r.evaluation.combinedRunners.length >= 3
        );
        const participatedCount = participatedRaceEvals.length;

        // Outlay and returns tally participated race cards only
        const totalWon = participatedRaceEvals.filter(
          (r) => r.evaluation.isTrifectaHit
        ).length;
        const totalCollect = participatedRaceEvals.reduce(
          (sum, r) => sum + (r.evaluation.customBetFlexiReturn || 0),
          0
        );
        const totalOutlay = participatedCount * trifectaBetAmount;
        const totalCombos = participatedRaceEvals.reduce(
          (sum, r) => sum + (r.evaluation.combinationsCount || 0),
          0
        );
        const isAlive = participatedRaceEvals.some(
          (r) => !r.evaluation.isRaceResulted || r.evaluation.isTrifectaHit
        );

        return {
          meeting,
          raceEvals,
          participatedRaceEvals,
          participatedCount,
          totalWon,
          totalCollect,
          totalOutlay,
          totalCombos,
          isAlive,
        };
      });
  }, [meetings, punters, trifectaBetAmount, customConfigs, showAllRaces]);

  // Collapsible state for Trifecta meeting accordions
  const [openTrifectaMeetings, setOpenTrifectaMeetings] = useState<
    Record<string, boolean>
  >(() => {
    return selectedMeetingId ? { [selectedMeetingId]: true } : {};
  });

  useEffect(() => {
    if (selectedMeetingId) {
      setOpenTrifectaMeetings((prev) => ({
        ...prev,
        [selectedMeetingId]: true,
      }));
    }
  }, [selectedMeetingId]);

  const toggleTrifectaMeeting = (meetingId: string) => {
    setOpenTrifectaMeetings((prev) => ({
      ...prev,
      [meetingId]: !prev[meetingId],
    }));
  };

  const expandAllTrifectas = () => {
    const next: Record<string, boolean> = {};
    meetings.forEach((m) => {
      next[m.id] = true;
    });
    setOpenTrifectaMeetings(next);
  };

  const collapseAllTrifectas = () => {
    setOpenTrifectaMeetings({});
  };

  // State for which race is currently being customized (raceKey: "meetingId_R{no}")
  const [editingRaceKey, setEditingRaceKey] = useState<string | null>(null);

  // Editor form state for the currently customized race
  const [editorFirst, setEditorFirst] = useState<number[]>([]);
  const [editorSecond, setEditorSecond] = useState<number[]>([]);
  const [editorThird, setEditorThird] = useState<number[]>([]);
  const [editorStandoutPos, setEditorStandoutPos] = useState<1 | 2 | 3 | null>(null);
  const [editorStandoutTab, setEditorStandoutTab] = useState<number | null>(null);

  const startEditingRace = (
    raceKey: string,
    evalObj: CombinedRaceTrifectaEvaluation
  ) => {
    if (editingRaceKey === raceKey) {
      setEditingRaceKey(null);
      return;
    }
    const saved = customConfigs[raceKey];
    if (saved) {
      setEditorFirst(saved.firstPicks || []);
      setEditorSecond(saved.secondPicks || []);
      setEditorThird(saved.thirdPicks || []);
      setEditorStandoutPos(saved.standoutPosition ?? null);
      setEditorStandoutTab(saved.standoutTab ?? null);
    } else {
      setEditorFirst(evalObj.positionPicks.first);
      setEditorSecond(evalObj.positionPicks.second);
      setEditorThird(evalObj.positionPicks.third);
      setEditorStandoutPos(evalObj.standoutPosition ?? null);
      setEditorStandoutTab(evalObj.standoutRunner?.tabNumber ?? null);
    }
    setEditingRaceKey(raceKey);
  };

  const saveCustomRace = (raceKey: string) => {
    const isStandout = Boolean(editorStandoutPos && editorStandoutTab);
    const config: CustomTrifectaRaceConfig = {
      mode: isStandout ? "standout_placing" : "flexi_positions",
      firstPicks: editorFirst,
      secondPicks: editorSecond,
      thirdPicks: editorThird,
      standoutPosition: editorStandoutPos ?? undefined,
      standoutTab: editorStandoutTab ?? undefined,
    };
    setCustomConfigs((prev) => {
      const next = { ...prev, [raceKey]: config };
      try {
        localStorage.setItem(
          "turfsheet_custom_trifecta_configs_v1",
          JSON.stringify(next)
        );
      } catch {}
      return next;
    });
    setEditingRaceKey(null);
    if (onTriggerToast) {
      onTriggerToast(`✓ Custom Trifecta Saved & Active for ${raceKey}`);
    }
  };

  const revertCustomRace = (raceKey: string) => {
    setCustomConfigs((prev) => {
      const next = { ...prev };
      delete next[raceKey];
      try {
        localStorage.setItem(
          "turfsheet_custom_trifecta_configs_v1",
          JSON.stringify(next)
        );
      } catch {}
      return next;
    });
    setEditingRaceKey(null);
    if (onTriggerToast) {
      onTriggerToast(`↺ Reverted to Concatenated Syndicate Consensus`);
    }
  };

  const handleToggleEditor1st = (tab: number) => {
    setEditorFirst((prev) => {
      const next = prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab];
      if (editorStandoutPos === 1 && editorStandoutTab === tab) {
        setEditorStandoutPos(null);
        setEditorStandoutTab(null);
      }
      return next;
    });
  };

  const handleToggleEditor2nd = (tab: number) => {
    setEditorSecond((prev) => {
      const next = prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab];
      if (editorStandoutPos === 2 && editorStandoutTab === tab) {
        setEditorStandoutPos(null);
        setEditorStandoutTab(null);
      }
      return next;
    });
  };

  const handleToggleEditor3rd = (tab: number) => {
    setEditorThird((prev) => {
      const next = prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab];
      if (editorStandoutPos === 3 && editorStandoutTab === tab) {
        setEditorStandoutPos(null);
        setEditorStandoutTab(null);
      }
      return next;
    });
  };

  const handleEditorStandout = (pos: 1 | 2 | 3, tab: number) => {
    if (editorStandoutPos === pos && editorStandoutTab === tab) {
      setEditorStandoutPos(null);
      setEditorStandoutTab(null);
    } else {
      setEditorStandoutPos(pos);
      setEditorStandoutTab(tab);
      if (pos === 1) setEditorFirst([tab]);
      if (pos === 2) setEditorSecond([tab]);
      if (pos === 3) setEditorThird([tab]);
    }
  };

  const editorPermutations = useMemo(() => {
    if (!editingRaceKey) return { count: 0, combos: [] };
    const combos: Array<[number, number, number]> = [];
    for (const f of editorFirst) {
      for (const s of editorSecond) {
        if (s === f) continue;
        for (const t of editorThird) {
          if (t === f || t === s) continue;
          combos.push([f, s, t]);
        }
      }
    }
    return {
      combos,
      count: combos.length,
    };
  }, [editingRaceKey, editorFirst, editorSecond, editorThird]);

  const editorFlexiPercentage = useMemo(() => {
    if (editorPermutations.count === 0) return 0;
    return (trifectaBetAmount / editorPermutations.count) * 100;
  }, [trifectaBetAmount, editorPermutations.count]);

  const getPunterSelectionsForRaceText = (meetingId: string, raceNumber: number) => {
    const parts: string[] = [];
    punters.forEach((punter) => {
      const trio = punter.selectionsByMeeting?.[meetingId]?.[raceNumber];
      if (trio && (trio.firstPref || trio.secondPref || trio.thirdPref)) {
        const picks: string[] = [];
        if (trio.firstPref) picks.push(`#${trio.firstPref}`);
        if (trio.secondPref) picks.push(`#${trio.secondPref}`);
        if (trio.thirdPref) picks.push(`#${trio.thirdPref}`);
        parts.push(`${punter.name}: [${picks.join(", ")}]`);
      }
    });
    return parts.length > 0 ? parts.join(" · ") : "Market consensus fallback";
  };

  // Evaluate Quaddies across ALL meetings that have >= 4 races
  const allQuaddieEvals = useMemo(() => {
    return meetings
      .filter((m) => m.races && m.races.length >= 4)
      .map((meeting) => {
        const evaluation = evaluateCombinedQuaddieForMeeting(
          meeting,
          punters,
          quaddieExtraByMeeting[meeting.id] || {},
          quaddieBuyInPerUser
        );
        return {
          meeting,
          evaluation,
          sweatScenarios: computeQuaddieLeg4SweatScenarios(evaluation),
        };
      });
  }, [meetings, punters, quaddieExtraByMeeting, quaddieBuyInPerUser]);

  // Collapsible state for Quaddie meeting accordions
  const [openQuaddieMeetings, setOpenQuaddieMeetings] = useState<
    Record<string, boolean>
  >(() => {
    return selectedMeetingId ? { [selectedMeetingId]: true } : {};
  });

  // Keep active meeting expanded when user switches meeting
  useEffect(() => {
    if (selectedMeetingId) {
      setOpenQuaddieMeetings((prev) => ({
        ...prev,
        [selectedMeetingId]: true,
      }));
    }
  }, [selectedMeetingId]);

  const toggleQuaddieMeeting = (meetingId: string) => {
    setOpenQuaddieMeetings((prev) => ({
      ...prev,
      [meetingId]: !prev[meetingId],
    }));
  };

  const expandAllQuaddies = () => {
    const allOpen: Record<string, boolean> = {};
    allQuaddieEvals.forEach((q) => {
      allOpen[q.meeting.id] = true;
    });
    setOpenQuaddieMeetings(allOpen);
  };

  const collapseAllQuaddies = () => {
    setOpenQuaddieMeetings({});
  };

  // Expanded runners state for Quaddie legs keyed by `${meetingId}_leg_${legIdx}`
  const [expandedLegs, setExpandedLegs] = useState<Record<string, boolean>>({});

  // -------------------------------------------------------------------------
  // 3-PLACE TRIFECTA STATE MANAGEMENT (1st Place, 2nd Place, 3rd Place)
  // -------------------------------------------------------------------------
  const [firstPlaceTabs, setFirstPlaceTabs] = useState<number[]>([]);
  const [secondPlaceTabs, setSecondPlaceTabs] = useState<number[]>([]);
  const [thirdPlaceTabs, setThirdPlaceTabs] = useState<number[]>([]);
  const [standoutPosition, setStandoutPosition] = useState<1 | 2 | 3 | null>(null);
  const [standoutTab, setStandoutTab] = useState<number | null>(null);
  // Quaddie-style Field vs Selected view toggle for each place column
  const [expandedPlaces, setExpandedPlaces] = useState<Record<1 | 2 | 3, boolean>>({
    1: false,
    2: false,
    3: false,
  });

  // Active sub-1.90 favourite in current race
  const activeSub19 = useMemo(() => {
    if (!activeRace) return null;
    return (
      activeRace.runners.find((r) => {
        if (isRunnerScratched(r)) return false;
        const w = Number(r.fixedWin || r.nswTabWin);
        return Number.isFinite(w) && w > 0 && w < 1.9;
      }) || null
    );
  }, [activeRace]);

  // Contributing punter selections map for the active race
  // maps runner tabNumber -> array of { punterName, pref: 1|2|3 }
  const runnerPunterPicks = useMemo(() => {
    const map = new Map<number, Array<{ punterName: string; pref: 1 | 2 | 3 }>>();
    if (!activeMeeting || !activeRace) return map;

    punters.forEach((punter) => {
      const trio =
        punter.selectionsByMeeting?.[activeMeeting.id]?.[activeRace.raceNumber];
      if (trio) {
        if (trio.firstPref) {
          const arr = map.get(trio.firstPref) || [];
          arr.push({ punterName: punter.name, pref: 1 });
          map.set(trio.firstPref, arr);
        }
        if (trio.secondPref) {
          const arr = map.get(trio.secondPref) || [];
          arr.push({ punterName: punter.name, pref: 2 });
          map.set(trio.secondPref, arr);
        }
        if (trio.thirdPref) {
          const arr = map.get(trio.thirdPref) || [];
          arr.push({ punterName: punter.name, pref: 3 });
          map.set(trio.thirdPref, arr);
        }
      }
    });
    return map;
  }, [punters, activeMeeting, activeRace]);

  // Concatenated user selections per race summary
  const concatenatedPunterSelectionsSummary = useMemo(() => {
    if (!activeMeeting || !activeRace) return "";
    const parts: string[] = [];
    punters.forEach((punter) => {
      const trio =
        punter.selectionsByMeeting?.[activeMeeting.id]?.[activeRace.raceNumber];
      if (trio && (trio.firstPref || trio.secondPref || trio.thirdPref)) {
        const picks: string[] = [];
        if (trio.firstPref) picks.push(`#${trio.firstPref} (1st)`);
        if (trio.secondPref) picks.push(`#${trio.secondPref} (2nd)`);
        if (trio.thirdPref) picks.push(`#${trio.thirdPref} (3rd)`);
        parts.push(`${punter.name}: [${picks.join(", ")}]`);
      }
    });
    return parts.join(" · ");
  }, [punters, activeMeeting, activeRace]);

  // Apply default Consensus / Auto-Banker setup for current race
  const applyConsensusSetup = useCallback(() => {
    if (!activeRace || !activeMeeting) return;
    const sorted = [...activeRace.runners]
      .filter((r) => !isRunnerScratched(r))
      .sort((a, b) => {
        const oA = Number(a.fixedWin || a.nswTabWin) || 99;
        const oB = Number(b.fixedWin || b.nswTabWin) || 99;
        return oA - oB;
      });

    const sub19 = sorted.find((r) => {
      const w = Number(r.fixedWin || r.nswTabWin);
      return Number.isFinite(w) && w > 0 && w < 1.9;
    });

    // All concatenated user selections across all syndicate members
    const tippedTabs = Array.from(runnerPunterPicks.keys());

    if (sub19) {
      // Automatic banker rule: Extreme favourite (< $1.90) anchored as 1st place standout
      setFirstPlaceTabs([sub19.tabNumber]);
      setStandoutPosition(1);
      setStandoutTab(sub19.tabNumber);

      const remainingTips = tippedTabs.filter((t) => t !== sub19.tabNumber);
      let safeRemaining = remainingTips;
      if (safeRemaining.length < 2) {
        const fillers = sorted
          .filter(
            (r) =>
              r.tabNumber !== sub19.tabNumber && !safeRemaining.includes(r.tabNumber)
          )
          .slice(0, 2 - safeRemaining.length)
          .map((r) => r.tabNumber);
        safeRemaining = [...safeRemaining, ...fillers];
      }

      setSecondPlaceTabs(safeRemaining);
      setThirdPlaceTabs(safeRemaining);
    } else {
      // Default: Concatenate and add all user selections across all placings as a Flexi Bet
      // Supports any number of selections (can be greater than 3 horses)
      let pooledTabs = tippedTabs;
      if (pooledTabs.length < 3) {
        const fillers = sorted
          .filter((r) => !pooledTabs.includes(r.tabNumber))
          .slice(0, 3 - pooledTabs.length)
          .map((r) => r.tabNumber);
        pooledTabs = [...pooledTabs, ...fillers];
      }

      setFirstPlaceTabs(pooledTabs);
      setSecondPlaceTabs(pooledTabs);
      setThirdPlaceTabs(pooledTabs);
      setStandoutPosition(null);
      setStandoutTab(null);
    }
  }, [activeRace, activeMeeting, runnerPunterPicks]);

  // Synchronize or load trifecta selections when active race or meeting changes
  useEffect(() => {
    if (!activeRace || !activeMeeting) return;
    setIsCustomizing(false);
    const raceKey = `${activeMeeting.id}_R${activeRace.raceNumber}`;
    const saved = customConfigs[raceKey];

    if (saved) {
      setStandoutPosition(saved.standoutPosition ?? (saved.standoutTab ? 1 : null));
      setStandoutTab(saved.standoutTab ?? null);
      setFirstPlaceTabs(saved.firstPicks || []);
      setSecondPlaceTabs(saved.secondPicks || []);
      setThirdPlaceTabs(saved.thirdPicks || []);
    } else {
      applyConsensusSetup();
    }
  }, [activeRace?.raceNumber, activeMeeting?.id, customConfigs, applyConsensusSetup]);

  // Compute Trifecta permutations across 1st, 2nd, and 3rd place columns
  const trifectaPermutations = useMemo(() => {
    const combos: Array<[number, number, number]> = [];
    for (const f of firstPlaceTabs) {
      for (const s of secondPlaceTabs) {
        if (s === f) continue;
        for (const t of thirdPlaceTabs) {
          if (t === f || t === s) continue;
          combos.push([f, s, t]);
        }
      }
    }
    return {
      combos,
      count: combos.length,
    };
  }, [firstPlaceTabs, secondPlaceTabs, thirdPlaceTabs]);

  // Calculated Flexi Metrics for the custom ticket
  const flexiPercentage = useMemo(() => {
    if (trifectaPermutations.count === 0) return 0;
    return (trifectaBetAmount / trifectaPermutations.count) * 100;
  }, [trifectaBetAmount, trifectaPermutations.count]);

  // Unique horses count across all 3 positions
  const uniqueHorsesCount = useMemo(() => {
    return new Set([...firstPlaceTabs, ...secondPlaceTabs, ...thirdPlaceTabs]).size;
  }, [firstPlaceTabs, secondPlaceTabs, thirdPlaceTabs]);

  const activeRaceKey = `${activeMeeting?.id || ""}_R${activeRace?.raceNumber || 1}`;
  const isCurrentRaceConfirmed = Boolean(customConfigs[activeRaceKey]);

  // Toggle runner in 1st Place
  const handleToggle1stPlace = (tabNumber: number) => {
    if (activeSub19 && activeSub19.tabNumber === tabNumber && standoutPosition === 1) {
      if (onTriggerToast) {
        onTriggerToast(
          `⚡ Auto-Banker Locked: #${tabNumber} has odds < $1.90 and is anchored in 1st Place.`
        );
      }
      return;
    }
    setFirstPlaceTabs((prev) => {
      const next = prev.includes(tabNumber)
        ? prev.filter((t) => t !== tabNumber)
        : [...prev, tabNumber];
      if (standoutPosition === 1 && standoutTab === tabNumber) {
        setStandoutPosition(null);
        setStandoutTab(null);
      }
      return next;
    });
  };

  // Toggle runner in 2nd Place
  const handleToggle2ndPlace = (tabNumber: number) => {
    setSecondPlaceTabs((prev) => {
      const next = prev.includes(tabNumber)
        ? prev.filter((t) => t !== tabNumber)
        : [...prev, tabNumber];
      if (standoutPosition === 2 && standoutTab === tabNumber) {
        setStandoutPosition(null);
        setStandoutTab(null);
      }
      return next;
    });
  };

  // Toggle runner in 3rd Place
  const handleToggle3rdPlace = (tabNumber: number) => {
    setThirdPlaceTabs((prev) => {
      const next = prev.includes(tabNumber)
        ? prev.filter((t) => t !== tabNumber)
        : [...prev, tabNumber];
      if (standoutPosition === 3 && standoutTab === tabNumber) {
        setStandoutPosition(null);
        setStandoutTab(null);
      }
      return next;
    });
  };

  // Set Standout for a specific place position
  const handleSelectStandout = (position: 1 | 2 | 3, tabNumber: number) => {
    if (standoutPosition === position && standoutTab === tabNumber) {
      // Deselect standout
      setStandoutPosition(null);
      setStandoutTab(null);
      return;
    }

    setStandoutPosition(position);
    setStandoutTab(tabNumber);

    if (position === 1) {
      setFirstPlaceTabs([tabNumber]);
    } else if (position === 2) {
      setSecondPlaceTabs([tabNumber]);
    } else if (position === 3) {
      setThirdPlaceTabs([tabNumber]);
    }
  };

  // Confirm and persist custom trifecta configuration
  const handleConfirmTrifecta = () => {
    if (!activeMeeting || !activeRace) return;
    if (trifectaPermutations.count === 0) {
      if (onTriggerToast) {
        onTriggerToast(
          "⚠️ Please select at least one runner in 1st, 2nd, and 3rd place."
        );
      }
      return;
    }

    const raceKey = `${activeMeeting.id}_R${activeRace.raceNumber}`;
    const newConfig: CustomTrifectaRaceConfig = {
      mode: standoutPosition ? "standout_placing" : "flexi_positions",
      standoutTab: standoutTab,
      standoutPosition: standoutPosition || undefined,
      firstPicks: firstPlaceTabs,
      secondPicks: secondPlaceTabs,
      thirdPicks: thirdPlaceTabs,
      customStake: trifectaBetAmount,
    };

    const updated = {
      ...customConfigs,
      [raceKey]: newConfig,
    };
    setCustomConfigs(updated);

    try {
      localStorage.setItem(
        "turfsheet_custom_trifecta_configs_v1",
        JSON.stringify(updated)
      );
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Failed to save custom trifecta config:", err);
    }

    setIsCustomizing(false);
    if (onTriggerToast) {
      onTriggerToast(
        `✓ Custom Trifecta Saved & Active: ${activeMeeting.venue} R${activeRace.raceNumber} ($${trifectaBetAmount} Stake · ${trifectaPermutations.count} Combos · ${flexiPercentage.toFixed(2)}% Flexi)`
      );
    }
  };

  // Reset to syndicate consensus
  const handleResetTrifecta = () => {
    if (!activeMeeting || !activeRace) return;
    const raceKey = `${activeMeeting.id}_R${activeRace.raceNumber}`;
    const updated = { ...customConfigs };
    delete updated[raceKey];
    setCustomConfigs(updated);

    try {
      localStorage.setItem(
        "turfsheet_custom_trifecta_configs_v1",
        JSON.stringify(updated)
      );
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Failed to reset trifecta config:", err);
    }

    applyConsensusSetup();
    setIsCustomizing(false);
    if (onTriggerToast) {
      onTriggerToast(
        `Reset Trifecta for Race ${activeRace.raceNumber} to Syndicate Consensus (Active & Final).`
      );
    }
  };

  // KPI Pool Aggregations across active meeting (tally participated race cards only)
  const participatedTrifectaEvals = allTrifectaEvals.filter(
    (e) => e.evaluation.hasCombinedSelections && e.evaluation.combinedRunners.length >= 3
  );
  const trifectaHitsCount = participatedTrifectaEvals.filter(
    (e) => e.evaluation.isCombinedBoxedTrifectaHit
  ).length;
  const totalTrifectaPoolStaked = participatedTrifectaEvals.length * trifectaBetAmount;
  const totalTrifectaPoolCollected = participatedTrifectaEvals.reduce(
    (acc, e) => acc + (e.evaluation.customBetFlexiReturn || 0),
    0
  );

  // Tally Quaddie outlay ONLY for meetings where punters have actively made selections
  const participatedQuaddieEvals = allQuaddieEvals.filter((q) =>
    q.evaluation.legs.some((leg) => leg.allUserPicksInLeg.length > 0)
  );
  const totalQuaddieStakedAll = participatedQuaddieEvals.reduce(
    (acc, q) => acc + q.evaluation.quaddieBetAmount,
    0
  );
  const totalQuaddieCollectedAll = participatedQuaddieEvals.reduce(
    (acc, q) => acc + (q.evaluation.isQuaddieWon ? q.evaluation.wonQuaddieReturn : 0),
    0
  );

  const totalExoticsStaked = totalTrifectaPoolStaked + totalQuaddieStakedAll;
  const totalExoticsCollected = totalTrifectaPoolCollected + totalQuaddieCollectedAll;

  if (!activeMeeting || !activeRace) {
    return (
      <div className="p-8 text-center text-[#8A9990] font-mono">
        No active race meetings available for Exotics analysis.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ====================================================================
          TOP HERO KPI BENTO STRIP
         ==================================================================== */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2E25] pb-5 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-xs font-bold uppercase tracking-wider">
                TurfSheet Exotics Matrix
              </span>
              <span className="text-xs text-[#8A9990] font-mono">
                {activeMeeting.venue} ({activeMeeting.state || "AU"}) · {activeMeeting.date}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-[#F3F4F0] mt-1 tracking-tight">
              Syndicate Trifectas &amp; Quaddies Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#8A9990] font-mono mt-1">
              Position-by-position 3-place Trifecta builder with auto-banker low-odds rule, multi-meeting Quaddie matrices, and live Flexi yield calculations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
            {/* Quick Sub-Filter: All / Trifectas / Quaddies */}
            <div className="flex items-center gap-1.5 bg-[#080D0B] p-1.5 rounded-2xl border border-[#1E2E25]">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === "all"
                    ? "bg-[#D4AF37] text-[#070B09] shadow-sm font-black"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>All Exotics</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("trifectas")}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === "trifectas"
                    ? "bg-[#D4AF37] text-[#070B09] shadow-sm font-black"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Trifectas (3-Place)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("quaddies")}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilter === "quaddies"
                    ? "bg-[#10B981] text-[#070B09] shadow-sm font-black"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Quaddies ({allQuaddieEvals.length})</span>
              </button>
            </div>

            {/* Participated Races Filter Toggle */}
            <div className="flex items-center gap-1.5 bg-[#080D0B] p-1.5 rounded-2xl border border-[#1E2E25]">
              <button
                type="button"
                onClick={() => setShowAllRaces((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  !showAllRaces
                    ? "bg-[#152920] border border-[#10B981]/60 text-[#10B981] shadow-sm font-black"
                    : "bg-[#0E1512] text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
                title={
                  !showAllRaces
                    ? "Filtered to participated races only. Click to view all scheduled races."
                    : "Showing all scheduled races. Click to filter to syndicate participated races."
                }
              >
                <Filter className="w-3.5 h-3.5" />
                <span>
                  {!showAllRaces
                    ? "Participated Races Only"
                    : "Showing All Races · Switch to Tipped"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Financial & Hit KPI Bento Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-5 relative z-10">
          <div className="p-4 rounded-2xl bg-[#080D0B]/80 border border-[#1E2E25]">
            <span className="text-[11px] font-mono text-[#8A9990] uppercase tracking-wider block">
              Total Exotics Outlay
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[#F3F4F0] mt-1">
              ${totalExoticsStaked.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8A9990] font-mono mt-1">
              <span>Trifectas: ${totalTrifectaPoolStaked} ({participatedTrifectaEvals.length} Races)</span>
              <span>·</span>
              <span>Quaddies: ${totalQuaddieStakedAll.toFixed(0)} ({participatedQuaddieEvals.length} Meetings)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#080D0B]/80 border border-[#1E2E25]">
            <span className="text-[11px] font-mono text-[#8A9990] uppercase tracking-wider block">
              Total Exotics Returns
            </span>
            <div
              className={`text-xl sm:text-2xl font-mono font-bold mt-1 ${
                totalExoticsCollected > totalExoticsStaked
                  ? "text-[#10B981]"
                  : "text-[#F3F4F0]"
              }`}
            >
              ${totalExoticsCollected.toFixed(2)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1">
              {totalExoticsCollected >= totalExoticsStaked ? (
                <span className="text-[#10B981] flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  +${(totalExoticsCollected - totalExoticsStaked).toFixed(2)} Profit
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" />
                  -${(totalExoticsStaked - totalExoticsCollected).toFixed(2)} Net
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#080D0B]/80 border border-[#1E2E25]">
            <span className="text-[11px] font-mono text-[#8A9990] uppercase tracking-wider block">
              Trifecta Strike Rate
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[#D4AF37] mt-1">
              {trifectaHitsCount} / {participatedTrifectaEvals.length}
            </div>
            <div className="text-[11px] text-[#8A9990] font-mono mt-1">
              {participatedTrifectaEvals.length > 0
                ? `${((trifectaHitsCount / participatedTrifectaEvals.length) * 100).toFixed(0)}% Hit Precision (${participatedTrifectaEvals.length} Participated)`
                : "0% (0 Participated)"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#080D0B]/80 border border-[#1E2E25]">
            <span className="text-[11px] font-mono text-[#8A9990] uppercase tracking-wider block">
              Active Quaddies Monitored
            </span>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[#10B981] mt-1">
              {allQuaddieEvals.filter((q) => q.evaluation.isQuaddieAlive).length} Alive
            </div>
            <div className="text-[11px] text-[#8A9990] font-mono mt-1">
              {allQuaddieEvals.length} Race Card Quaddies Total
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          BENTO SECTION 1: REVISED 3-PLACE TRIFECTA MATRIX (Quaddie-Style Layout)
         ==================================================================== */}
      {(activeFilter === "all" || activeFilter === "trifectas") && (
        <div className="space-y-4">
          {/* Section Header with Expand / Collapse, Stake & Guide Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-xs font-bold uppercase">
                  All Active Card Trifectas ({allMeetingTrifectaEvals.length})
                </span>
                <span className="text-xs text-[#8A9990] font-mono">
                  {allMeetingTrifectaEvals.reduce((sum, m) => sum + m.totalWon, 0)} Won · Place-Agnostic Concatenation · Default ${trifectaBetAmount} Flexi
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F3F4F0] mt-1">
                Syndicate Concatenated Trifecta Accordions
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Default Stake Quick Selector */}
              <div className="flex items-center gap-1 bg-[#0E1512] border border-[#1E2E25] p-1 rounded-xl">
                <span className="text-[10px] font-mono text-[#8A9990] px-1.5 font-bold">
                  Stake:
                </span>
                {[10, 20, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => onChangeTrifectaBetAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                      trifectaBetAmount === amt
                        ? "bg-[#D4AF37] text-[#070B09] font-black"
                        : "text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Expand / Collapse All Meetings */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAllTrifectas}
                  className="px-3 py-1.5 rounded-xl bg-[#121E18] border border-[#23352B] hover:border-[#D4AF37]/50 text-xs font-mono font-bold text-[#D5DDD8] transition cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllTrifectas}
                  className="px-3 py-1.5 rounded-xl bg-[#121E18] border border-[#23352B] hover:border-rose-900/50 text-xs font-mono font-bold text-[#8A9990] hover:text-[#F3F4F0] transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>

          {/* ====================================================================
              ALL PARTICIPATED MEETING CARD TRIFECTAS (Collapsible Accordions)
             ==================================================================== */}
          <div className="space-y-4">
            {allMeetingTrifectaEvals.map(
              ({
                meeting,
                raceEvals,
                participatedRaceEvals,
                participatedCount,
                totalWon,
                totalCollect,
                totalOutlay,
                totalCombos,
                isAlive,
              }) => {
                const isOpen = Boolean(openTrifectaMeetings[meeting.id]);
                const displayedRaceEvals = showAllRaces
                  ? raceEvals
                  : participatedRaceEvals;

                return (
                  <div
                    key={meeting.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      totalWon > 0
                        ? "border-[#34C759]/40 bg-white shadow-sm"
                        : isAlive
                        ? "border-[#E5E5EA] bg-white shadow-xs"
                        : "border-[#E5E5EA] bg-[#FAF9FA] opacity-90"
                    }`}
                  >
                    {/* Accordion Trigger Header */}
                    <button
                      type="button"
                      onClick={() => toggleTrifectaMeeting(meeting.id)}
                      className="w-full p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left cursor-pointer hover:bg-[#F2F2F7]/50 rounded-2xl transition"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            totalWon > 0
                              ? "bg-[#EAFBF0] text-[#34C759]"
                              : isAlive
                              ? "bg-[#EBF5FF] text-[#0071E3]"
                              : "bg-[#F2F2F7] text-[#86868B]"
                          }`}
                        >
                          {totalWon > 0 ? "🏆" : isAlive ? "🏇" : "⚪"}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-base sm:text-lg text-[#1D1D1F]">
                              {meeting.venue} ({meeting.state || "AU"})
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                                totalWon > 0
                                  ? "bg-[#EAFBF0] text-[#34C759]"
                                  : isAlive
                                  ? "bg-[#EBF5FF] text-[#0071E3]"
                                  : "bg-[#F2F2F7] text-[#86868B]"
                              }`}
                            >
                              {totalWon > 0
                                ? `STATUS: ${totalWon} WON ✓`
                                : isAlive
                                ? "STATUS: ACTIVE"
                                : "STATUS: COMPLETED"}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-[#F2F2F7] text-[#1D1D1F] border border-[#E5E5EA]">
                              {participatedCount} of {meeting.races.length} Races Tipped
                            </span>
                            {meeting.date && (
                              <span className="text-[11px] text-[#86868B] font-mono">
                                {meeting.date}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#8A9990] font-mono mt-0.5">
                            {displayedRaceEvals.length} Races Displayed {!showAllRaces && `(${participatedCount} Tipped)`} · {totalCombos} Total Combos · ${trifectaBetAmount} Bet / Race (${totalOutlay} Outlay)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-center">
                        {/* Race Hit Indicators */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {displayedRaceEvals.map(({ race, evaluation }) => {
                            const isHit = evaluation.isTrifectaHit;
                            const isMissed = evaluation.isRaceResulted && !isHit;
                            return (
                              <span
                                key={race.raceNumber}
                                className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center ${
                                  isHit
                                    ? "bg-[#10B981] text-[#070B09]"
                                    : isMissed
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : "bg-[#14231B] text-[#D4AF37] border border-[#23352B]"
                                }`}
                                title={`R${race.raceNumber}: ${
                                  isHit ? "WON ✓" : isMissed ? "MISSED" : "UPCOMING"
                                } (${evaluation.combinationsCount} combos, ${evaluation.flexiPercentage.toFixed(1)}% Flexi)`}
                              >
                                R{race.raceNumber}
                              </span>
                            );
                          })}
                        </div>

                        {/* Financial Return / Outlay */}
                        <div className="text-right font-mono">
                          <div
                            className={`text-sm sm:text-base font-bold ${
                              totalCollect > 0 ? "text-[#10B981]" : "text-[#F3F4F0]"
                            }`}
                          >
                            {totalCollect > 0
                              ? `+$${totalCollect.toFixed(2)}`
                              : `$${totalOutlay.toFixed(0)} Outlay`}
                          </div>
                          <div className="text-[10px] text-[#8A9990]">
                            {totalCollect > 0
                              ? `+$${(totalCollect / Math.max(1, punters.length)).toFixed(2)} / member`
                              : `$${(totalOutlay / Math.max(1, punters.length)).toFixed(2)} / member`}
                          </div>
                        </div>

                        <div className="p-1 rounded-xl bg-[#14231B] text-[#8A9990]">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-[#F3F4F0]" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-[#8A9990]" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Accordion Content Body: Vertically Stacked Race Events */}
                    {isOpen && (
                      <div className="p-4 sm:p-6 pt-2 border-t border-[#1E2E25] space-y-4 animate-in fade-in duration-150">
                        {displayedRaceEvals.length === 0 ? (
                          <div className="p-6 rounded-2xl bg-[#09100D] border border-[#1E2E25] text-center space-y-2">
                            <p className="text-sm font-bold text-[#F3F4F0]">
                              No syndicate tips submitted for {meeting.venue} yet
                            </p>
                            <p className="text-xs text-[#8A9990] font-mono">
                              Filtering is currently set to Participated Races Only.
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setShowAllRaces(true)}
                                className="px-3 py-1.5 rounded-xl bg-[#D4AF37] text-[#070B09] font-mono text-xs font-bold hover:bg-[#e3be42] cursor-pointer"
                              >
                                Show All {meeting.races.length} Scheduled Races
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onJumpToSelections?.(punters[0]?.id, meeting.id)
                                }
                                className="px-3 py-1.5 rounded-xl bg-[#14231B] border border-[#23352B] text-xs font-mono font-bold text-[#10B981] hover:bg-[#10B981]/15 cursor-pointer"
                              >
                                Enter Selections
                              </button>
                            </div>
                          </div>
                        ) : (
                          displayedRaceEvals.map(({ race, raceKey, evaluation }) => {
                            const isCustomized = Boolean(customConfigs[raceKey]);
                            const isHit = evaluation.isTrifectaHit;
                            const isMissed = evaluation.isRaceResulted && !isHit;
                            const isUpcoming = !evaluation.isRaceResulted;
                            const isEditing = editingRaceKey === raceKey;

                          // Check if race has extreme favorite (< $1.90)
                          const sub19FavInRace = race.runners.find((r) => {
                            if (isRunnerScratched(r)) return false;
                            const w = Number(r.fixedWin || r.nswTabWin);
                            return Number.isFinite(w) && w > 0 && w < 1.9;
                          });

                          // Punters who contributed tips for this race
                          const contributingPunters = punters.filter((p) => {
                            const trio = p.selectionsByMeeting?.[meeting.id]?.[race.raceNumber];
                            return trio && (trio.firstPref || trio.secondPref || trio.thirdPref);
                          });

                          return (
                            <div
                              key={raceKey}
                              className={`rounded-2xl border transition-all ${
                                isHit
                                  ? "border-[#34C759]/40 bg-[#EAFBF0]/40 shadow-xs"
                                  : isEditing
                                  ? "border-[#0071E3] ring-2 ring-[#0071E3]/20 bg-white shadow-sm"
                                  : isCustomized
                                  ? "border-[#0071E3]/30 bg-white shadow-xs"
                                  : "border-[#E5E5EA] bg-white hover:border-[#D2D2D7] shadow-xs"
                              }`}
                            >
                              {/* RACE EVENT CARD */}
                              <div className="p-4 sm:p-5 space-y-3">
                                {/* Race Event Top Bar: Header & Badges & Action Buttons */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="w-8 h-8 rounded-full bg-[#0071E3] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                      R{race.raceNumber}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-display font-bold text-sm sm:text-base text-[#1D1D1F]">
                                          {race.raceName || `Race ${race.raceNumber}`}
                                        </h3>
                                        {/* Status Badge */}
                                        {isHit && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-[#EAFBF0] text-[#34C759] border border-[#34C759]/30 font-mono text-[10px] font-bold uppercase">
                                            WON ✓ +${(evaluation.customBetFlexiReturn || 0).toFixed(2)}
                                          </span>
                                        )}
                                        {isMissed && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-[#FEECEB] border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-[10px] font-bold uppercase">
                                            MISSED (Podium: #{evaluation.officialPodium.first?.tabNumber ?? "?"}-#{evaluation.officialPodium.second?.tabNumber ?? "?"}-#{evaluation.officialPodium.third?.tabNumber ?? "?"})
                                          </span>
                                        )}
                                        {isUpcoming && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-[#EBF5FF] text-[#0071E3] font-mono text-[10px] font-bold uppercase">
                                            ACTIVE SWEAT
                                          </span>
                                        )}
                                        {isCustomized && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[#1D1D1F] font-mono text-[10px] font-bold">
                                            Custom Override
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-[#86868B] font-mono mt-0.5">
                                        {race.distance ? `${race.distance}m` : ""} {race.classGrade ? `· ${race.classGrade}` : ""} {meeting.trackCondition ? `· ${meeting.trackCondition}` : ""}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right side: Flexi % Metric Pill & Customize Action */}
                                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                                    {/* Official Flexi % Badge based on defined bet ($20 default) */}
                                    <div className="px-3.5 py-1.5 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] font-mono text-right">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[#86868B] text-[10px]">Flexi:</span>
                                        <span className="text-[#34C759] font-bold text-sm">
                                          {evaluation.flexiPercentage.toFixed(2)}%
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-[#8A9990]">
                                        ${trifectaBetAmount} Bet · {evaluation.combinationsCount} Combos
                                      </div>
                                    </div>

                                    {/* Customize Drawer Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={() => startEditingRace(raceKey, evaluation)}
                                      className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                        isEditing
                                          ? "bg-[#D4AF37] text-[#070B09] font-black"
                                          : "bg-[#14231B] border border-[#23352B] text-[#D4AF37] hover:bg-[#D4AF37]/20"
                                      }`}
                                      title="Open inline customize drawer for this race"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>{isEditing ? "Close Editor" : "Customize"}</span>
                                    </button>

                                    {isCustomized && (
                                      <button
                                        type="button"
                                        onClick={() => revertCustomRace(raceKey)}
                                        className="px-2.5 py-1.5 rounded-xl bg-[#14231B] border border-[#23352B] text-[#8A9990] hover:text-[#F3F4F0] font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                        title="Revert back to auto concatenated consensus"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Revert</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* SELECTIONS BUILD-UP (Quaddie-style concatenation display) */}
                                <div className="p-3 sm:p-3.5 rounded-xl bg-[#080D0B]/80 border border-[#1E2E25] space-y-2.5">
                                  {/* Auto-Banker Alert or Concatenated Notice */}
                                  {sub19FavInRace ? (
                                    <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 p-2.5 rounded-lg border border-[#D4AF37]/30">
                                      <Zap className="w-4 h-4 text-[#D4AF37] shrink-0" />
                                      <span>
                                        <strong>Auto-Banker Rule Active:</strong> #{sub19FavInRace.tabNumber} {sub19FavInRace.horseName} ($
                                        {Number(sub19FavInRace.fixedWin || sub19FavInRace.nswTabWin).toFixed(2)}) is &lt; $1.90 and locked as <strong>1st Place Standout Banker</strong>. All remaining syndicate selections are aggregated into 2nd &amp; 3rd Place (Flexi).
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between text-xs font-mono text-[#8A9990] pb-1 border-b border-[#1A2620]">
                                      <span className="flex items-center gap-1.5 text-[#D5DDD8]">
                                        <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                                        <strong>Concatenated Syndicate Flexi:</strong> All tipped runners aggregated into Flexi Trifecta (Boxed across 1st, 2nd, and 3rd place)
                                      </span>
                                      <span className="text-[#D4AF37] font-bold">
                                        {evaluation.positionPicks.first.length} Horses Boxed
                                      </span>
                                    </div>
                                  )}

                                  {/* Runner Chips Presentation */}
                                  {sub19FavInRace ? (
                                    <div className="space-y-2.5">
                                      {/* Row 1: 1st Place Standout Banker */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <div className="flex items-center gap-1.5 shrink-0 sm:w-36">
                                          <span className="w-5 h-5 rounded bg-[#D4AF37] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                            1st
                                          </span>
                                          <span className="text-[11px] font-mono font-bold text-[#D4AF37]">
                                            Standout Banker
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {evaluation.positionPicks.first.map((tab) => {
                                            const runner = race.runners.find((r) => r.tabNumber === tab);
                                            const odds = Number(runner?.fixedWin || runner?.nswTabWin) || 0;
                                            const pickers = punters
                                              .filter((p) => {
                                                const t = p.selectionsByMeeting?.[meeting.id]?.[race.raceNumber];
                                                return (
                                                  t &&
                                                  (Number(t.firstPref) === tab ||
                                                    Number(t.secondPref) === tab ||
                                                    Number(t.thirdPref) === tab)
                                                );
                                              })
                                              .map((p) => p.name);

                                            return (
                                              <div
                                                key={`1st-${tab}`}
                                                className="px-2.5 py-1.5 rounded-xl border border-[#D4AF37] bg-[#D4AF37]/15 text-[#F3F4F0] flex items-center gap-2 font-mono text-xs shadow-sm"
                                              >
                                                <span className="w-5 h-5 rounded-md bg-[#D4AF37] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                                  {tab}
                                                </span>
                                                <span className="font-bold truncate max-w-[140px]">
                                                  {runner?.horseName || `Horse #${tab}`}
                                                </span>
                                                {odds > 0 && (
                                                  <span className="text-[11px] text-[#D4AF37] font-bold">
                                                    ${odds.toFixed(2)}
                                                  </span>
                                                )}
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#D4AF37] text-[#070B09] font-black uppercase tracking-wider">
                                                  ⚡ Banker
                                                </span>
                                                {pickers.length > 0 && (
                                                  <span className="text-[10px] text-[#D4AF37]/90 bg-[#16251E] px-1.5 py-0.5 rounded">
                                                    {pickers.join(", ")}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Row 2: 2nd & 3rd Place Aggregated Syndicate Selections */}
                                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 pt-2 border-t border-[#16221B]">
                                        <div className="flex items-center gap-1.5 shrink-0 sm:w-36 pt-1">
                                          <span className="w-5 h-5 rounded bg-[#10B981] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                            2/3
                                          </span>
                                          <span className="text-[11px] font-mono font-bold text-[#10B981]">
                                            2nd &amp; 3rd Place ({evaluation.positionPicks.second.length}H)
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {evaluation.positionPicks.second.map((tab) => {
                                            const runner = race.runners.find((r) => r.tabNumber === tab);
                                            const odds = Number(runner?.fixedWin || runner?.nswTabWin) || 0;
                                            const pickers = punters
                                              .filter((p) => {
                                                const t = p.selectionsByMeeting?.[meeting.id]?.[race.raceNumber];
                                                return (
                                                  t &&
                                                  (Number(t.firstPref) === tab ||
                                                    Number(t.secondPref) === tab ||
                                                    Number(t.thirdPref) === tab)
                                                );
                                              })
                                              .map((p) => p.name);

                                            return (
                                              <div
                                                key={`2nd3rd-${tab}`}
                                                className="px-2.5 py-1.5 rounded-xl border border-[#223329] bg-[#101814] text-[#F3F4F0] flex items-center gap-2 font-mono text-xs hover:border-[#10B981]/50 transition"
                                              >
                                                <span className="w-5 h-5 rounded-md bg-[#16231C] text-[#10B981] flex items-center justify-center font-black text-[10px]">
                                                  {tab}
                                                </span>
                                                <span className="font-bold truncate max-w-[140px]">
                                                  {runner?.horseName || `Horse #${tab}`}
                                                </span>
                                                {odds > 0 && (
                                                  <span className="text-[11px] text-[#8A9990] font-semibold">
                                                    ${odds.toFixed(2)}
                                                  </span>
                                                )}
                                                {pickers.length > 0 && (
                                                  <span className="text-[10px] text-[#10B981]/90 bg-[#16251E] px-1.5 py-0.5 rounded">
                                                    {pickers.join(", ")}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Boxed Flexi across all 3 positions */
                                    <div className="flex flex-wrap items-center gap-2">
                                      {evaluation.positionPicks.first.map((tab) => {
                                        const runner = race.runners.find((r) => r.tabNumber === tab);
                                        const odds = Number(runner?.fixedWin || runner?.nswTabWin) || 0;
                                        const pickers = punters
                                          .filter((p) => {
                                            const t = p.selectionsByMeeting?.[meeting.id]?.[race.raceNumber];
                                            return (
                                              t &&
                                              (Number(t.firstPref) === tab ||
                                                Number(t.secondPref) === tab ||
                                                Number(t.thirdPref) === tab)
                                            );
                                          })
                                          .map((p) => p.name);

                                        return (
                                          <div
                                            key={tab}
                                            className="px-2.5 py-1.5 rounded-xl border border-[#223329] bg-[#101814] text-[#F3F4F0] flex items-center gap-2 font-mono text-xs hover:border-[#D4AF37]/50 transition"
                                          >
                                            <span className="w-5 h-5 rounded-md bg-[#16231C] text-[#D4AF37] flex items-center justify-center font-black text-[10px]">
                                              {tab}
                                            </span>
                                            <span className="font-bold truncate max-w-[140px]">
                                              {runner?.horseName || `Horse #${tab}`}
                                            </span>
                                            {odds > 0 && (
                                              <span className="text-[11px] text-[#8A9990] font-semibold">
                                                ${odds.toFixed(2)}
                                              </span>
                                            )}
                                            {pickers.length > 0 && (
                                              <span className="text-[10px] text-[#D4AF37]/90 bg-[#16251E] px-1.5 py-0.5 rounded">
                                                {pickers.join(", ")}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Individual Punters' Raw Tips on this Race */}
                                  <div className="pt-1.5 border-t border-[#16221B] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8A9990]">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[#D5DDD8] font-bold">Syndicate Tips:</span>
                                      {contributingPunters.length > 0 ? (
                                        contributingPunters.map((p) => {
                                          const t = p.selectionsByMeeting?.[meeting.id]?.[race.raceNumber];
                                          const picks: string[] = [];
                                          if (t?.firstPref) picks.push(`#${t.firstPref}`);
                                          if (t?.secondPref) picks.push(`#${t.secondPref}`);
                                          if (t?.thirdPref) picks.push(`#${t.thirdPref}`);
                                          return (
                                            <span
                                              key={p.id}
                                              className="px-2 py-0.5 rounded-md bg-[#101814] border border-[#1E2E25] text-[#D5DDD8]"
                                            >
                                              <strong className="text-[#D4AF37]">{p.name}:</strong> [{picks.join(", ")}]
                                            </span>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[#8A9990] italic">
                                          Market consensus fallback
                                        </span>
                                      )}
                                    </div>

                                    {/* Permutations & Flexi formula */}
                                    <div className="text-right text-[#D5DDD8]">
                                      <span>
                                        {evaluation.positionPicks.first.length} ×{" "}
                                        {evaluation.positionPicks.second.length} ×{" "}
                                        {evaluation.positionPicks.third.length} ={" "}
                                        <strong className="text-[#D4AF37]">{evaluation.combinationsCount} Combos</strong>
                                      </span>
                                      <span className="mx-1.5 text-[#8A9990]">·</span>
                                      <span>
                                        Flexi:{" "}
                                        <strong className="text-[#10B981]">
                                          {evaluation.flexiPercentage.toFixed(2)}%
                                        </strong>{" "}
                                        <span className="text-[#8A9990]">
                                          ({(evaluation.flexiPercentage / Math.max(1, punters.length)).toFixed(2)}% / member)
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* INLINE CUSTOMIZE DRAWER (Shown when editing this race) */}
                                {isEditing && (
                                  <div className="mt-4 p-4 rounded-2xl bg-[#09110D] border border-[#D4AF37]/50 space-y-4 animate-in fade-in duration-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1E2E25]">
                                      <div className="flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-[#D4AF37]" />
                                        <span className="font-bold text-sm text-[#F3F4F0] font-mono">
                                          Customize Selections for {meeting.venue} R{race.raceNumber}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-[#D4AF37] font-bold">
                                          {editorPermutations.count} Combos @ {editorFlexiPercentage.toFixed(2)}% Flexi (${trifectaBetAmount} Stake)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setEditingRaceKey(null)}
                                          className="text-xs text-[#8A9990] hover:text-[#F3F4F0] font-mono cursor-pointer"
                                        >
                                          ✕ Cancel
                                        </button>
                                      </div>
                                    </div>

                                    {/* 3 Places Columns (1st, 2nd, 3rd) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      {/* 1st Place */}
                                      <div className="p-3 rounded-xl bg-[#0E1712] border border-[#D4AF37]/30 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[#1E2E25] pb-1.5">
                                          <span className="font-mono text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded bg-[#D4AF37] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                              1st
                                            </span>
                                            1st Place ({editorFirst.length})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setEditorFirst([])}
                                            className="text-[10px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                          {race.runners
                                            .filter((r) => !isRunnerScratched(r))
                                            .map((runner) => {
                                              const isSel = editorFirst.includes(runner.tabNumber);
                                              const isStandout =
                                                editorStandoutPos === 1 &&
                                                editorStandoutTab === runner.tabNumber;
                                              const winOdds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                                              return (
                                                <div
                                                  key={runner.tabNumber}
                                                  className={`p-1.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-1 transition ${
                                                    isStandout
                                                      ? "bg-[#D4AF37]/20 border-[#D4AF37]"
                                                      : isSel
                                                      ? "bg-[#18261E] border-[#D4AF37]/60"
                                                      : "bg-[#080D0B] border-[#1C2C23]"
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-bold text-[10px] w-4 text-[#8A9990]">
                                                      #{runner.tabNumber}
                                                    </span>
                                                    <span className="font-bold truncate text-[#F3F4F0] text-[11px]">
                                                      {runner.horseName}
                                                    </span>
                                                    {winOdds > 0 && (
                                                      <span className="text-[10px] text-[#8A9990]">
                                                        ${winOdds.toFixed(2)}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleEditorStandout(1, runner.tabNumber)}
                                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                                                        isStandout
                                                          ? "bg-[#D4AF37] text-[#070B09]"
                                                          : "bg-[#14231B] text-[#8A9990] hover:text-[#D4AF37]"
                                                      }`}
                                                      title="Lock as standout 1st"
                                                    >
                                                      ★
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleToggleEditor1st(runner.tabNumber)}
                                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                                        isSel
                                                          ? "bg-[#10B981] text-[#070B09]"
                                                          : "bg-[#14231B] text-[#D5DDD8] border border-[#23352B]"
                                                      }`}
                                                    >
                                                      {isSel ? "✓" : "+"}
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>

                                      {/* 2nd Place */}
                                      <div className="p-3 rounded-xl bg-[#0E1712] border border-[#94A3B8]/30 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[#1E2E25] pb-1.5">
                                          <span className="font-mono text-xs font-bold text-[#94A3B8] flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded bg-[#94A3B8] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                              2nd
                                            </span>
                                            2nd Place ({editorSecond.length})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setEditorSecond([])}
                                            className="text-[10px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                          {race.runners
                                            .filter((r) => !isRunnerScratched(r))
                                            .map((runner) => {
                                              const isSel = editorSecond.includes(runner.tabNumber);
                                              const isStandout =
                                                editorStandoutPos === 2 &&
                                                editorStandoutTab === runner.tabNumber;
                                              const winOdds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                                              return (
                                                <div
                                                  key={runner.tabNumber}
                                                  className={`p-1.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-1 transition ${
                                                    isStandout
                                                      ? "bg-[#94A3B8]/20 border-[#94A3B8]"
                                                      : isSel
                                                      ? "bg-[#18261E] border-[#94A3B8]/60"
                                                      : "bg-[#080D0B] border-[#1C2C23]"
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-bold text-[10px] w-4 text-[#8A9990]">
                                                      #{runner.tabNumber}
                                                    </span>
                                                    <span className="font-bold truncate text-[#F3F4F0] text-[11px]">
                                                      {runner.horseName}
                                                    </span>
                                                    {winOdds > 0 && (
                                                      <span className="text-[10px] text-[#8A9990]">
                                                        ${winOdds.toFixed(2)}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleEditor2nd(runner.tabNumber)}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                                      isSel
                                                        ? "bg-[#10B981] text-[#070B09]"
                                                        : "bg-[#14231B] text-[#D5DDD8] border border-[#23352B]"
                                                    }`}
                                                  >
                                                    {isSel ? "✓" : "+"}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>

                                      {/* 3rd Place */}
                                      <div className="p-3 rounded-xl bg-[#0E1712] border border-[#CD7F32]/30 space-y-2">
                                        <div className="flex items-center justify-between border-b border-[#1E2E25] pb-1.5">
                                          <span className="font-mono text-xs font-bold text-[#CD7F32] flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded bg-[#CD7F32] text-[#070B09] flex items-center justify-center font-black text-[10px]">
                                              3rd
                                            </span>
                                            3rd Place ({editorThird.length})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setEditorThird([])}
                                            className="text-[10px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                                          {race.runners
                                            .filter((r) => !isRunnerScratched(r))
                                            .map((runner) => {
                                              const isSel = editorThird.includes(runner.tabNumber);
                                              const isStandout =
                                                editorStandoutPos === 3 &&
                                                editorStandoutTab === runner.tabNumber;
                                              const winOdds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                                              return (
                                                <div
                                                  key={runner.tabNumber}
                                                  className={`p-1.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-1 transition ${
                                                    isStandout
                                                      ? "bg-[#CD7F32]/20 border-[#CD7F32]"
                                                      : isSel
                                                      ? "bg-[#18261E] border-[#CD7F32]/60"
                                                      : "bg-[#080D0B] border-[#1C2C23]"
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-bold text-[10px] w-4 text-[#8A9990]">
                                                      #{runner.tabNumber}
                                                    </span>
                                                    <span className="font-bold truncate text-[#F3F4F0] text-[11px]">
                                                      {runner.horseName}
                                                    </span>
                                                    {winOdds > 0 && (
                                                      <span className="text-[10px] text-[#8A9990]">
                                                        ${winOdds.toFixed(2)}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleEditor3rd(runner.tabNumber)}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                                      isSel
                                                        ? "bg-[#10B981] text-[#070B09]"
                                                        : "bg-[#14231B] text-[#D5DDD8] border border-[#23352B]"
                                                    }`}
                                                  >
                                                    {isSel ? "✓" : "+"}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action buttons inside drawer */}
                                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#1E2E25] flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => revertCustomRace(raceKey)}
                                        className="px-3 py-1.5 rounded-xl bg-[#14231B] border border-[#23352B] text-[#8A9990] hover:text-[#F3F4F0] font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Revert to Consensus</span>
                                      </button>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setEditingRaceKey(null)}
                                          className="px-3 py-1.5 rounded-xl bg-[#121A15] border border-[#23352B] text-[#8A9990] hover:text-[#F3F4F0] font-mono text-xs font-bold transition cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => saveCustomRace(raceKey)}
                                          disabled={editorPermutations.count === 0}
                                          className="px-4 py-1.5 rounded-xl bg-[#10B981] text-[#070B09] font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:bg-[#10B981]/90"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                          <span>Save Custom (R{race.raceNumber})</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          BENTO SECTION 2: ALL ACTIVE RACE CARD QUADDIES (Collapsible Accordions)
         ==================================================================== */}
      {(activeFilter === "all" || activeFilter === "quaddies") && (
        <div className="space-y-4">
          {/* Section Header with Expand / Collapse Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono text-xs font-bold uppercase">
                  All Active Card Quaddies ({allQuaddieEvals.length})
                </span>
                <span className="text-xs text-[#8A9990] font-mono">
                  {allQuaddieEvals.filter((q) => q.evaluation.isQuaddieAlive).length} Alive · Main Metro &amp; Provincial
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F3F4F0] mt-1">
                4-Leg Syndicate Quaddie Accordions
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAllQuaddies}
                className="px-3 py-1.5 rounded-xl bg-[#121E18] border border-[#23352B] hover:border-[#10B981]/50 text-xs font-mono font-bold text-[#D5DDD8] transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllQuaddies}
                className="px-3 py-1.5 rounded-xl bg-[#121E18] border border-[#23352B] hover:border-rose-900/50 text-xs font-mono font-bold text-[#8A9990] hover:text-[#F3F4F0] transition cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Accordion Cards for each meeting */}
          {(showAllRaces
            ? allQuaddieEvals
            : allQuaddieEvals.filter(
                (q) => q.evaluation.participatingUsersCount > 0
              ).length > 0
            ? allQuaddieEvals.filter(
                (q) => q.evaluation.participatingUsersCount > 0
              )
            : allQuaddieEvals
          ).map(({ meeting, evaluation, sweatScenarios }) => {
            const isOpen = Boolean(openQuaddieMeetings[meeting.id]);
            const isWon = evaluation.isQuaddieWon;
            const isAlive = evaluation.isQuaddieAlive;

            return (
              <div
                key={meeting.id}
                className={`rounded-3xl border transition-all ${
                  isWon
                    ? "border-[#10B981]/50 bg-[#0E1512]/95 shadow-[0_8px_32px_rgba(16,185,129,0.15)]"
                    : isAlive
                    ? "border-white/[0.08] bg-[#0E1512]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                    : "border-rose-950/40 bg-[#0A0F0D]/90 opacity-80"
                }`}
              >
                {/* Accordion Trigger Header */}
                <button
                  type="button"
                  onClick={() => toggleQuaddieMeeting(meeting.id)}
                  className="w-full p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left cursor-pointer hover:bg-white/[0.02] rounded-3xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isWon
                          ? "bg-[#10B981] text-[#070B09]"
                          : isAlive
                          ? "bg-[#14231B] text-[#10B981] border border-[#10B981]/50"
                          : "bg-rose-950/40 text-rose-300 border border-rose-900/40"
                      }`}
                    >
                      {isWon ? "🏆" : isAlive ? "🟢" : "🔴"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-base sm:text-lg text-[#F3F4F0]">
                          {meeting.venue} ({meeting.state || "AU"})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase ${
                            isWon
                              ? "bg-[#10B981] text-[#070B09]"
                              : isAlive
                              ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                              : "bg-rose-950 text-rose-300"
                          }`}
                        >
                          {isWon ? "STATUS: WON ✓" : isAlive ? "STATUS: ALIVE" : "STATUS: KNOCKED OUT"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]">
                          {evaluation.participatingUsersCount > 0
                            ? `${evaluation.participatingUsersCount} of ${punters.length} Punters Tipped`
                            : "Market Consensus"}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A9990] font-mono mt-0.5">
                        Races {evaluation.legs[0]?.raceNumber}–{evaluation.legs[3]?.raceNumber} · {evaluation.totalCombinations} Combinations · {evaluation.flexiPercentage.toFixed(2)}% Flexi Coverage
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    {/* Leg Hit Status Dots */}
                    <div className="flex items-center gap-1.5">
                      {evaluation.legs.map((leg) => {
                        const isLegWon = leg.isLegHit;
                        const isLegLost = leg.isRaceResulted && !leg.isLegHit;
                        return (
                          <span
                            key={leg.legIndex}
                            className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center ${
                              isLegWon
                                ? "bg-[#10B981] text-[#070B09]"
                                : isLegLost
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "bg-[#14231B] text-[#D4AF37] border border-[#23352B]"
                            }`}
                            title={`Leg ${leg.legIndex} (R${leg.raceNumber}): ${
                              isLegWon ? "HIT" : isLegLost ? "OUT" : "UPCOMING"
                            }`}
                          >
                            L{leg.legIndex}
                          </span>
                        );
                      })}
                    </div>

                    {/* Dividend or Return */}
                    <div className="text-right font-mono">
                      <div
                        className={`text-sm sm:text-base font-bold ${
                          isWon ? "text-[#10B981]" : "text-[#F3F4F0]"
                        }`}
                      >
                        {isWon
                          ? `+$${evaluation.flexiPayoutOnBetAmount.toFixed(2)}`
                          : `$${evaluation.quaddieBetAmount.toFixed(0)} Outlay`}
                      </div>
                      <div className="text-[10px] text-[#8A9990]">
                        {isWon
                          ? `$${evaluation.flexiPayoutPerUser.toFixed(2)} / member`
                          : `$${evaluation.buyInPerUser}/punter`}
                      </div>
                    </div>

                    <div className="p-1 rounded-xl bg-[#14231B] text-[#8A9990]">
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-[#F3F4F0]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#8A9990]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Accordion Content Body (4-Leg Matrix + Sweat Scenarios) */}
                {isOpen && (
                  <div className="p-5 sm:p-7 pt-2 border-t border-[#1E2E25] space-y-6 animate-in fade-in duration-150">
                    {/* Buy-in selector for this meeting */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#080D0B] p-3 rounded-2xl border border-[#1E2E25]">
                      <div className="text-xs font-mono text-[#8A9990]">
                        Adjust Buy-In per Syndicate Member for {meeting.venue}:
                      </div>
                      <div className="flex items-center gap-2">
                        {[20, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => onChangeQuaddieBuyInPerUser(amt)}
                            className={`px-3 py-1 rounded-xl font-mono text-xs font-bold transition cursor-pointer ${
                              quaddieBuyInPerUser === amt
                                ? "bg-[#10B981] text-[#070B09]"
                                : "text-[#8A9990] hover:text-[#F3F4F0] bg-[#121E18]"
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4 Quaddie Legs Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {evaluation.legs.map((leg) => {
                        const race = leg.race;
                        const isLegWon = leg.isLegHit;
                        const isLegLost = leg.isRaceResulted && !leg.isLegHit;
                        const legKey = `${meeting.id}_leg_${leg.legIndex}`;
                        const isExpanded = Boolean(expandedLegs[legKey]);
                        const displayRunners = isExpanded
                          ? race.runners
                          : race.runners.filter((r) =>
                              leg.allLegRunners.some(
                                (lr) => lr.tabNumber === r.tabNumber
                              )
                            );

                        return (
                          <div
                            key={leg.legIndex}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                              isLegWon
                                ? "bg-[#10B981]/10 border-[#10B981]/40"
                                : isLegLost
                                ? "bg-rose-950/20 border-rose-900/40 opacity-70"
                                : "bg-[#121C17]/90 border-[#23352B]"
                            }`}
                          >
                            {/* Leg Header */}
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className="px-2 py-0.5 rounded-md bg-[#080D0B] border border-[#23352B] font-mono font-bold text-xs text-[#D5DDD8]">
                                  Leg {leg.legIndex} · R{leg.raceNumber}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                                    isLegWon
                                      ? "bg-[#10B981] text-[#070B09]"
                                      : isLegLost
                                      ? "bg-rose-500/20 text-rose-300"
                                      : "bg-[#192620] text-[#D4AF37]"
                                  }`}
                                >
                                  {isLegWon ? "WON ✓" : isLegLost ? "OUT ✗" : "UPCOMING"}
                                </span>
                              </div>

                              <h3 className="font-display font-bold text-sm text-[#F3F4F0] truncate">
                                {race.raceName}
                              </h3>
                              <p className="text-[11px] text-[#8A9990] font-mono mt-0.5">
                                Jumps {race.startTime} · {race.distance}m
                              </p>

                              {/* Quick Selection Toolbar */}
                              <div className="mt-3 flex items-center justify-between gap-1 text-[11px] font-mono">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedLegs((prev) => ({
                                      ...prev,
                                      [legKey]: !isExpanded,
                                    }));
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-[#080D0B] border border-[#23352B] text-[#D4AF37] hover:text-[#F3F4F0] flex items-center gap-1 cursor-pointer"
                                >
                                  <span>
                                    {isExpanded
                                      ? `Selected (${leg.allLegRunners.length})`
                                      : `Field (${race.runners.length})`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sortedNonScratched = [...race.runners]
                                        .filter((r) => !isRunnerScratched(r))
                                        .sort(
                                          (a, b) =>
                                            (Number(a.fixedWin || a.nswTabWin) || 99) -
                                            (Number(b.fixedWin || b.nswTabWin) || 99)
                                        );
                                      const top3 = sortedNonScratched.slice(0, 3);
                                      top3.forEach((r) => {
                                        if (
                                          !leg.allLegRunners.some(
                                            (lr) => lr.tabNumber === r.tabNumber
                                          )
                                        ) {
                                          onToggleQuaddieExtraRunner(
                                            meeting.id,
                                            leg.raceNumber,
                                            r.tabNumber
                                          );
                                        }
                                      });
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-[#14231B] border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/20 text-[10px] font-bold cursor-pointer transition"
                                    title="Auto-add top 3 market favourites to this leg"
                                  >
                                    + Top 3
                                  </button>

                                  {leg.extraQuaddieRunners.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onClearQuaddieExtrasForLeg(
                                          meeting.id,
                                          leg.raceNumber
                                        )
                                      }
                                      className="px-1.5 py-0.5 rounded-lg text-[10px] text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 cursor-pointer"
                                      title="Clear extra runners"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Runners Interactive Selection List */}
                              <div className="mt-2.5 space-y-1 max-h-48 overflow-y-auto pr-1">
                                {displayRunners.map((runner) => {
                                  const isScr = isRunnerScratched(runner);
                                  const isWinner =
                                    leg.isRaceResulted && runner.finishPosition === 1;
                                  const isExtra = leg.extraQuaddieRunners.some(
                                    (lr) => lr.tabNumber === runner.tabNumber
                                  );
                                  const isSyndicateTip =
                                    !isExtra &&
                                    leg.allLegRunners.some(
                                      (lr) => lr.tabNumber === runner.tabNumber
                                    );
                                  const isIncluded = isSyndicateTip || isExtra;
                                  const winOdds =
                                    Number(runner.fixedWin || runner.nswTabWin) || 0;

                                  return (
                                    <button
                                      key={runner.tabNumber}
                                      type="button"
                                      disabled={isScr}
                                      onClick={() => {
                                        if (isScr) return;
                                        onToggleQuaddieExtraRunner(
                                          meeting.id,
                                          leg.raceNumber,
                                          runner.tabNumber
                                        );
                                      }}
                                      className={`w-full p-1.5 rounded-lg border flex items-center justify-between text-xs font-mono transition text-left cursor-pointer ${
                                        isScr
                                          ? "opacity-35 bg-[#060A08] border-transparent cursor-not-allowed"
                                          : isWinner
                                          ? "bg-[#10B981] text-[#070B09] font-bold border-[#10B981]"
                                          : isSyndicateTip
                                          ? "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#F3F4F0] hover:bg-[#D4AF37]/25"
                                          : isExtra
                                          ? "bg-[#10B981]/15 border-[#10B981]/50 text-[#F3F4F0] hover:bg-[#10B981]/25"
                                          : "bg-[#080D0B] border-[#1E2E25] text-[#8A9990] hover:border-[#D4AF37]/50 hover:text-[#F3F4F0]"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span
                                          className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                                            isWinner
                                              ? "bg-[#070B09] text-[#10B981]"
                                              : isSyndicateTip
                                              ? "bg-[#D4AF37] text-[#070B09]"
                                              : isExtra
                                              ? "bg-[#10B981] text-[#070B09]"
                                              : "bg-[#141F19] text-[#8A9990]"
                                          }`}
                                        >
                                          {runner.tabNumber}
                                        </span>
                                        <span className="truncate">{runner.horseName}</span>
                                        {isSyndicateTip && (
                                          <span className="text-[9px] px-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-bold">
                                            Tip
                                          </span>
                                        )}
                                        {isExtra && (
                                          <span className="text-[9px] px-1 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                                            +Extra
                                          </span>
                                        )}
                                        {isScr && (
                                          <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-bold">
                                            SCR
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px]">
                                          {winOdds > 0 ? `$${winOdds.toFixed(2)}` : "—"}
                                        </span>
                                        {!isScr && (
                                          <span
                                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                                              isIncluded
                                                ? "text-[#10B981]"
                                                : "text-[#55695D] hover:text-[#D4AF37]"
                                            }`}
                                          >
                                            {isIncluded ? "✓" : "+"}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Leg Footer Summary */}
                            <div className="mt-3 pt-2 border-t border-[#1E2E25] flex items-center justify-between text-[11px] font-mono text-[#8A9990]">
                              <span>Runners in Leg:</span>
                              <strong className="text-[#F3F4F0]">
                                {leg.allLegRunners.length} horses
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quaddie Ticket Breakdown Strip */}
                    <div className="p-4 rounded-2xl bg-[#080D0B] border border-[#1E2E25] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[#8A9990] block text-[10px] uppercase">
                          Formula / Combos
                        </span>
                        <div className="text-sm font-bold text-[#F3F4F0] mt-0.5">
                          {evaluation.legs.map((l) => l.allLegRunners.length).join(" × ")} = {evaluation.totalCombinations}
                        </div>
                        <div className="text-[10px] text-[#8A9990]">
                          {evaluation.participatingUsersCount} punters participating
                        </div>
                      </div>

                      <div>
                        <span className="text-[#8A9990] block text-[10px] uppercase">
                          Syndicate Ticket Cost
                        </span>
                        <div className="text-sm font-bold text-[#F3F4F0] mt-0.5">
                          ${evaluation.quaddieBetAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#10B981] font-bold">
                          {evaluation.flexiPercentage.toFixed(2)}% Flexi Coverage
                        </div>
                      </div>

                      <div>
                        <span className="text-[#8A9990] block text-[10px] uppercase">
                          Estimated Quaddie Dividend
                        </span>
                        <div className="text-sm font-bold text-[#D4AF37] mt-0.5">
                          ${evaluation.minQuaddieDividend.toFixed(0)} – ${evaluation.maxQuaddieDividend.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-[#8A9990]">
                          Est. Mean: ${evaluation.officialOrEstimatedQuaddieDividend.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <span className="text-[#8A9990] block text-[10px] uppercase">
                          Potential Flexi Collect
                        </span>
                        <div
                          className={`text-sm font-bold mt-0.5 ${
                            isWon ? "text-[#10B981]" : "text-[#F3F4F0]"
                          }`}
                        >
                          ${evaluation.flexiPayoutOnBetAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#10B981]">
                          ${evaluation.flexiPayoutPerUser.toFixed(2)} / member share
                        </div>
                      </div>
                    </div>

                    {/* Sweat Scenarios if Alive in Leg 4 */}
                    {sweatScenarios.length > 0 && evaluation.isQuaddieAlive && (
                      <div className="p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-[#D4AF37]" />
                          <h4 className="font-display font-bold text-sm text-[#F3F4F0]">
                            Leg 4 Sweat Scenarios · R{evaluation.legs[3].raceNumber} ({meeting.venue})
                          </h4>
                        </div>
                        <p className="text-xs text-[#8A9990] font-mono">
                          Live syndicate payouts across all live runners in the final leg:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {sweatScenarios.map((scen) => (
                            <div
                              key={scen.tabNumber}
                              className="p-2.5 rounded-xl bg-[#080D0B] border border-[#1E2E25] flex items-center justify-between text-xs font-mono"
                            >
                              <div>
                                <span className="font-bold text-[#D4AF37]">
                                  #{scen.tabNumber} {scen.horseName}
                                </span>
                                <span className="text-[10px] text-[#8A9990] block">
                                  ${scen.winOdds.toFixed(2)} Win
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-[#10B981] block">
                                  +${(scen.projectedTotalFlexiCollect || 0).toFixed(0)}
                                </span>
                                <span className="text-[10px] text-[#8A9990]">
                                  ${(scen.projectedPerUserCollect || 0).toFixed(0)}/ea
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
