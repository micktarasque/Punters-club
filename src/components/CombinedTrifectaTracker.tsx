import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  Layers,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Zap,
  Sliders,
} from "lucide-react";
import { PunterProfile, RaceEvent, RaceMeeting } from "../types/racing";
import {
  CombinedRaceTrifectaEvaluation,
  CustomTrifectaRaceConfig,
  evaluateCombinedTrifectaForRace,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { InteractiveTrifectaCustomiser } from "./InteractiveTrifectaCustomiser";
import { RollingDividendCounter } from "./RollingDividendCounter";
import { triggerConfetti } from "./github/confettiUtil";

interface CombinedTrifectaTrackerProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  onJumpToSelections: (punterId?: string, meetingId?: string) => void;
  trifectaBetAmount?: number;
  onChangeTrifectaBetAmount?: (amount: number) => void;
  onTriggerToast?: (msg: string) => void;
}

const STORAGE_KEY_TRIFECTA_BET = "turfsheet_trifecta_bet_amount_v1";
const STORAGE_KEY_SMS_PHONE = "turfsheet_trifecta_sms_phone_v1";
const STORAGE_KEY_AUTO_T5_COMPILE = "turfsheet_trifecta_auto_t5_v1";
const STORAGE_KEY_FLEXI_COMBINED = "turfsheet_trifecta_flexi_combined_toggle_v1";
const PRESET_BET_AMOUNTS = [5, 10, 20, 25, 50, 100];

export interface CompiledSportsbetTrifectaDraft {
  id: string;
  meetingId: string;
  venue: string;
  state: string;
  raceDate: string;
  raceNumber: number;
  raceName: string;
  startTime: string;
  minutesUntilJump: number | null;
  stakeAmount: number;
  runnerNumbers: number[];
  runnerDetails: Array<{
    tabNumber: number;
    horseName: string;
    fixedWin: number;
    pickedBy: string[];
  }>;
  boxedCombinationsCount: number;
  flexiPercentage: number;
  estimatedBaseDividend: number;
  estimatedFlexiReturn: number;
  sportsbetRaceUrl: string;
  smsBodyText: string;
  compiledAtIso: string;
  triggerType: "AUTO_T5M" | "MANUAL";
}

function buildSportsbetVenueSlug(venue: string): string {
  const cleaned = venue
    .toLowerCase()
    .replace(/royal randwick/g, "randwick")
    .replace(/rosehill gardens/g, "rosehill")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "randwick";
}

function computeMinutesUntilJump(
  raceDate: string,
  startTime: string
): number | null {
  if (!startTime || !/^\d{1,2}:\d{2}$/.test(startTime.trim())) return null;
  const [hh, mm] = startTime.trim().split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const offset = raceDate >= "2026-10-04" ? "+11:00" : "+10:00";
  const isoStr = `${raceDate}T${String(hh).padStart(2, "0")}:${String(
    mm
  ).padStart(2, "0")}:00${offset}`;
  const targetMs = Date.parse(isoStr);
  if (Number.isNaN(targetMs)) return null;
  const diffMin = (targetMs - Date.now()) / 60_000;
  return Math.round(diffMin);
}

function compileSportsbetTrifectaDraftForRace(
  meeting: RaceMeeting,
  race: RaceEvent,
  evalData: CombinedRaceTrifectaEvaluation,
  stakeAmount: number,
  triggerType: "AUTO_T5M" | "MANUAL"
): CompiledSportsbetTrifectaDraft {
  const venueSlug = buildSportsbetVenueSlug(meeting.venue);
  const sportsbetRaceUrl = `https://www.sportsbet.com.au/horse-racing/australia-nz/${venueSlug}/race-${race.raceNumber}`;
  const runnerNumbers = evalData.combinedRunners.map((r) => r.tabNumber);
  const runnerDetails = evalData.combinedRunners.map((r) => ({
    tabNumber: r.tabNumber,
    horseName: r.runner?.horseName || `Runner #${r.tabNumber}`,
    fixedWin:
      Number(r.runner?.nswTabWin) || Number(r.runner?.fixedWin) || 0,
    pickedBy: r.pickedByUsers.map(
      (u) => `${u.punterName} (${u.preferenceRank}P)`
    ),
  }));

  const estDiv = evalData.isRaceResulted
    ? evalData.bookmakerTrifectaDividend
    : evalData.estimatedUpcomingTrifectaDividend;
  const estReturn = evalData.isRaceResulted
    ? evalData.customBetFlexiReturn
    : evalData.estimatedPayoutOnBetAmount;
  const minutesUntilJump = computeMinutesUntilJump(
    meeting.date,
    race.startTime
  );

  const numbersCsv =
    runnerNumbers.length > 0
      ? runnerNumbers.map((n) => `#${n}`).join(", ")
      : "No selections yet";
  const runnersListLines =
    runnerDetails.length > 0
      ? runnerDetails
          .map(
            (r) =>
              `#${r.tabNumber} ${r.horseName}${
                r.fixedWin > 0 ? ` ($${r.fixedWin.toFixed(2)})` : ""
              }`
          )
          .join(" | ")
      : "None";

  const effectiveStake = evalData.trifectaBetAmount || stakeAmount;
  const isBanker =
    evalData.betType === "flexi_standout" ||
    (evalData.betType === "flexi_combined" && evalData.isStandoutTriggered);
  const positionsText =
    isBanker
      ? `1st (Banker): #${evalData.positionPicks.first.join(", ")} | 2nd & 3rd: ${evalData.positionPicks.second.map((t) => `#${t}`).join(", ")}`
      : evalData.betType === "flexi_positions"
      ? `1st: ${evalData.positionPicks.first.map((t) => `#${t}`).join(", ")} | 2nd: ${evalData.positionPicks.second.map((t) => `#${t}`).join(", ")} | 3rd: ${evalData.positionPicks.third.map((t) => `#${t}`).join(", ")}`
      : `Boxed: ${numbersCsv}`;

  const smsBodyText = [
    `🏇 TURFSHEET T-5M TRIFECTA DRAFT`,
    `${meeting.venue} (${meeting.state}) · R${race.raceNumber} (${race.startTime})`,
    `Bet Type: ${evalData.betTypeLabel || "Flexi Trifecta"} (${evalData.combinationsCount || evalData.boxedCombinationsCount} Combos · ${evalData.flexiPercentage}% Flexi)`,
    `Selections: ${positionsText}`,
    `Runners: ${runnersListLines}`,
    `Stake: $${effectiveStake.toFixed(2)} (${evalData.participatingUserCount || 1} Active Users × $${evalData.buyInPerUser} · Est. Collect $${estReturn.toFixed(2)})`,
    `Build in Sportsbet: ${sportsbetRaceUrl}`,
  ].join("\n");

  return {
    id: `${meeting.id}-r${race.raceNumber}`,
    meetingId: meeting.id,
    venue: meeting.venue,
    state: meeting.state || "TAB",
    raceDate: meeting.date,
    raceNumber: race.raceNumber,
    raceName: race.raceName,
    startTime: race.startTime,
    minutesUntilJump,
    stakeAmount: effectiveStake,
    runnerNumbers,
    runnerDetails,
    boxedCombinationsCount: evalData.boxedCombinationsCount,
    flexiPercentage: evalData.flexiPercentage,
    estimatedBaseDividend: estDiv,
    estimatedFlexiReturn: estReturn,
    sportsbetRaceUrl,
    smsBodyText,
    compiledAtIso: new Date().toISOString(),
    triggerType,
  };
}

export const CombinedTrifectaTracker: React.FC<CombinedTrifectaTrackerProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  selectedMeetingIds,
  onChangeSelectedMeetingIds,
  punters,
  onJumpToSelections,
  trifectaBetAmount: controlledBetAmount,
  onChangeTrifectaBetAmount,
  onTriggerToast,
}) => {
  const [filterMode, setFilterMode] = useState<"ALL" | "SELECTED_ONLY">("ALL");
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([
    selectedMeetingId,
  ]);

  const effectiveSelectedIds = useMemo(() => {
    const raw =
      selectedMeetingIds && selectedMeetingIds.length > 0
        ? selectedMeetingIds
        : localSelectedIds;
    const valid = raw.filter((id) => meetings.some((m) => m.id === id));
    if (valid.length > 0) return valid;
    return meetings[0] ? [meetings[0].id] : [];
  }, [selectedMeetingIds, localSelectedIds, meetings]);

  const handleUpdateSelectedIds = (nextIds: string[]) => {
    const valid = nextIds.filter((id) => meetings.some((m) => m.id === id));
    const safe =
      valid.length > 0
        ? valid
        : meetings[0]
        ? [meetings[0].id]
        : [];
    setLocalSelectedIds(safe);
    onChangeSelectedMeetingIds?.(safe);
    if (safe.length > 0 && !safe.includes(selectedMeetingId)) {
      onSelectMeeting(safe[0]);
    }
  };

  const toggleMeetingInSelection = (meetingId: string) => {
    const exists = effectiveSelectedIds.includes(meetingId);
    if (exists) {
      if (effectiveSelectedIds.length <= 1) {
        onSelectMeeting(meetingId);
        return;
      }
      handleUpdateSelectedIds(
        effectiveSelectedIds.filter((id) => id !== meetingId)
      );
    } else {
      handleUpdateSelectedIds([...effectiveSelectedIds, meetingId]);
      onSelectMeeting(meetingId);
    }
  };

  const [localBetAmount, setLocalBetAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRIFECTA_BET);
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
      // ignore storage errors
    }
    return 20;
  });

  const activeBetAmount =
    controlledBetAmount !== undefined && controlledBetAmount > 0
      ? controlledBetAmount
      : localBetAmount;

  const [betInputText, setBetInputText] = useState<string>(() =>
    String(activeBetAmount)
  );

  const handleUpdateBetAmount = (nextVal: number) => {
    const clamped = Math.max(1, Math.min(10000, Number(nextVal.toFixed(2))));
    setLocalBetAmount(clamped);
    setBetInputText(String(clamped));
    try {
      localStorage.setItem(STORAGE_KEY_TRIFECTA_BET, String(clamped));
    } catch {
      // ignore
    }
    onChangeTrifectaBetAmount?.(clamped);
  };

  const [customConfigs, setCustomConfigs] = useState<
    Record<string, CustomTrifectaRaceConfig>
  >(() => {
    try {
      const saved = localStorage.getItem("turfsheet_custom_trifecta_configs_v1");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  const [activeCustomisingRace, setActiveCustomisingRace] = useState<{
    race: RaceEvent;
    meeting: RaceMeeting;
    evalData: CombinedRaceTrifectaEvaluation;
    raceKey: string;
  } | null>(null);

  const handleUpdateRaceConfig = (
    raceKey: string,
    config: CustomTrifectaRaceConfig | null
  ) => {
    setCustomConfigs((prev) => {
      const next = { ...prev };
      if (!config) {
        delete next[raceKey];
      } else {
        next[raceKey] = config;
      }
      try {
        localStorage.setItem(
          "turfsheet_custom_trifecta_configs_v1",
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
      return next;
    });
    onTriggerToast?.(
      config
        ? `Trifecta customisations applied to ${raceKey}`
        : `Reset to smart default for ${raceKey}`
    );
  };

  const [isFlexiCombined, setIsFlexiCombined] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FLEXI_COMBINED);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const handleToggleFlexiCombined = () => {
    setIsFlexiCombined((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_FLEXI_COMBINED, String(next));
      } catch {
        // ignore
      }
      onTriggerToast?.(
        next
          ? "Flexi Combined Mode Enabled: All users' aggregate tips combined with auto-banker on < $1.90 favourites."
          : "Flexi Combined Mode Disabled: Switched to default Boxed Trifecta calculation."
      );
      return next;
    });
  };

  const activeMeeting = useMemo(() => {
    return (
      meetings.find((m) => m.id === selectedMeetingId) ||
      meetings.find((m) => effectiveSelectedIds.includes(m.id)) ||
      meetings[0] ||
      null
    );
  }, [meetings, selectedMeetingId, effectiveSelectedIds]);

  const selectedMeetingsList = useMemo(() => {
    const filtered = meetings.filter((m) =>
      effectiveSelectedIds.includes(m.id)
    );
    return filtered.length > 0
      ? filtered
      : activeMeeting
      ? [activeMeeting]
      : [];
  }, [meetings, effectiveSelectedIds, activeMeeting]);

  // Evaluated trifectas across all selected meetings
  const evaluationsByMeeting = useMemo(() => {
    return selectedMeetingsList.map((m) => {
      const sortedRaces = [...m.races].sort(
        (a, b) => a.raceNumber - b.raceNumber
      );
      const evaluations = sortedRaces.map((race) => {
        const raceKey = `${m.id}_R${race.raceNumber}`;
        const raceConfig =
          customConfigs[raceKey] ||
          (isFlexiCombined ? { mode: "flexi_combined" } : undefined);
        return {
          race,
          raceKey,
          evalData: evaluateCombinedTrifectaForRace(
            race,
            punters,
            m.id,
            m.date,
            activeBetAmount,
            m.venue,
            raceConfig
          ),
        };
      });
      return {
        meeting: m,
        evaluations,
      };
    });
  }, [selectedMeetingsList, punters, activeBetAmount, customConfigs, isFlexiCombined]);

  // Combined KPI summary across all checked race cards
  const summaryStats = useMemo(() => {
    let racesWithSelections = 0;
    let resultedRacesCount = 0;
    let resultedWithSelectionsCount = 0;
    let boxedTrifectaHits = 0;
    let nearMiss2Of3Count = 0;
    let totalBookmakerTrifectaPool = 0;
    let totalPoolOnBetAmount = 0;
    let capturedBookmakerTrifectaValue = 0;
    let totalCustomBetOutlay = 0;
    let totalCustomBetReturn = 0;
    let totalHorsesSelectedAcrossCard = 0;

    for (const { evaluations } of evaluationsByMeeting) {
      for (const { evalData } of evaluations) {
        if (evalData.hasCombinedSelections) {
          racesWithSelections += 1;
          totalHorsesSelectedAcrossCard += evalData.combinedRunners.length;
        }
        if (evalData.isRaceResulted) {
          resultedRacesCount += 1;
          totalBookmakerTrifectaPool = Number(
            (
              totalBookmakerTrifectaPool + evalData.bookmakerTrifectaDividend
            ).toFixed(2)
          );
          totalPoolOnBetAmount = Number(
            (totalPoolOnBetAmount + evalData.trifectaOddsOnBetAmount).toFixed(2)
          );

          if (evalData.hasCombinedSelections) {
            resultedWithSelectionsCount += 1;
            if (evalData.combinedRunners.length >= 3) {
              totalCustomBetOutlay = Number(
                (
                  totalCustomBetOutlay +
                  (evalData.trifectaBetAmount || activeBetAmount)
                ).toFixed(2)
              );
            }
            if (evalData.isCombinedBoxedTrifectaHit) {
              boxedTrifectaHits += 1;
              capturedBookmakerTrifectaValue = Number(
                (
                  capturedBookmakerTrifectaValue +
                  evalData.capturedTrifectaReturn
                ).toFixed(2)
              );
              totalCustomBetReturn = Number(
                (totalCustomBetReturn + evalData.customBetFlexiReturn).toFixed(
                  2
                )
              );
            } else if (evalData.podiumHitFlags.hitCount === 2) {
              nearMiss2Of3Count += 1;
            }
          }
        }
      }
    }

    const strikeRatePct =
      resultedWithSelectionsCount > 0
        ? Math.round((boxedTrifectaHits / resultedWithSelectionsCount) * 100)
        : 0;

    const valueCapturePct =
      totalBookmakerTrifectaPool > 0
        ? Number(
            (
              (capturedBookmakerTrifectaValue / totalBookmakerTrifectaPool) *
              100
            ).toFixed(1)
          )
        : 0;

    const netProfitOnBet = Number(
      (totalCustomBetReturn - totalCustomBetOutlay).toFixed(2)
    );

    return {
      racesWithSelections,
      resultedRacesCount,
      resultedWithSelectionsCount,
      boxedTrifectaHits,
      nearMiss2Of3Count,
      totalBookmakerTrifectaPool,
      totalPoolOnBetAmount,
      capturedBookmakerTrifectaValue,
      totalCustomBetOutlay,
      totalCustomBetReturn,
      totalHorsesSelectedAcrossCard,
      netProfitOnBet,
      strikeRatePct,
      valueCapturePct,
    };
  }, [evaluationsByMeeting, activeBetAmount]);

  // ==========================================================================
  // T-MINUS 5-MINUTE PRE-RACE TRIFECTA COMPILER, SPORTSBET BUILDER & SMS TEXT
  // ==========================================================================
  const [smsPhoneNumber, setSmsPhoneNumber] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SMS_PHONE) || "";
    } catch {
      return "";
    }
  });
  const [autoCompileAtT5m, setAutoCompileAtT5m] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_AUTO_T5_COMPILE);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });
  const [selectedDraftRaceKey, setSelectedDraftRaceKey] = useState<string>("");
  const [compiledDraft, setCompiledDraft] =
    useState<CompiledSportsbetTrifectaDraft | null>(null);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [smsDispatchStatus, setSmsDispatchStatus] = useState<{
    ok: boolean;
    message: string;
    timestamp: string;
  } | null>(null);
  const [copiedSlip, setCopiedSlip] = useState<boolean>(false);
  const autoTriggeredRacesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SMS_PHONE, smsPhoneNumber);
    } catch {
      // ignore
    }
  }, [smsPhoneNumber]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_AUTO_T5_COMPILE,
        String(autoCompileAtT5m)
      );
    } catch {
      // ignore
    }
  }, [autoCompileAtT5m]);

  // Flatten all races across selected meetings for the compiler selector
  const allCandidateRaces = useMemo(() => {
    const list: Array<{
      key: string;
      meeting: RaceMeeting;
      race: RaceEvent;
      evalData: CombinedRaceTrifectaEvaluation;
      minutesUntilJump: number | null;
    }> = [];
    for (const { meeting, evaluations } of evaluationsByMeeting) {
      for (const { race, evalData } of evaluations) {
        list.push({
          key: `${meeting.id}::${race.raceNumber}`,
          meeting,
          race,
          evalData,
          minutesUntilJump: computeMinutesUntilJump(
            meeting.date,
            race.startTime
          ),
        });
      }
    }
    return list;
  }, [evaluationsByMeeting]);

  // Keep a valid default candidate race selected (prefer next upcoming race with selections)
  useEffect(() => {
    if (allCandidateRaces.length === 0) return;
    const stillValid = allCandidateRaces.some(
      (c) => c.key === selectedDraftRaceKey
    );
    if (!stillValid) {
      const upcomingWithPicks = allCandidateRaces.find(
        (c) => !c.evalData.isRaceResulted && c.evalData.hasCombinedSelections
      );
      const anyWithPicks = allCandidateRaces.find(
        (c) => c.evalData.hasCombinedSelections
      );
      const chosen =
        upcomingWithPicks || anyWithPicks || allCandidateRaces[0];
      if (chosen) {
        setSelectedDraftRaceKey(chosen.key);
        setCompiledDraft(
          compileSportsbetTrifectaDraftForRace(
            chosen.meeting,
            chosen.race,
            chosen.evalData,
            activeBetAmount,
            "MANUAL"
          )
        );
      }
    } else {
      const current = allCandidateRaces.find(
        (c) => c.key === selectedDraftRaceKey
      );
      if (current) {
        setCompiledDraft(
          compileSportsbetTrifectaDraftForRace(
            current.meeting,
            current.race,
            current.evalData,
            activeBetAmount,
            compiledDraft?.triggerType || "MANUAL"
          )
        );
      }
    }
  }, [allCandidateRaces, selectedDraftRaceKey, activeBetAmount]);

  const dispatchSmsDraftToServer = useCallback(
    async (draft: CompiledSportsbetTrifectaDraft, phoneRaw: string) => {
      const cleanedPhone = phoneRaw.trim();
      if (!cleanedPhone) {
        setSmsDispatchStatus({
          ok: false,
          message:
            "Enter a mobile phone number (e.g. 0400 000 000 or +614...) to text the Sportsbet Trifecta draft.",
          timestamp: new Date().toLocaleTimeString(),
        });
        return;
      }

      setIsSendingSms(true);
      try {
        const res = await fetch("/api/trifecta/sms-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toPhone: cleanedPhone,
            draft,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          setSmsDispatchStatus({
            ok: true,
            message:
              data.message ||
              `✓ Compiled Sportsbet Boxed Trifecta draft (${draft.venue} R${draft.raceNumber}) queued/dispatched to ${cleanedPhone}.`,
            timestamp: new Date().toLocaleTimeString(),
          });
          onTriggerToast?.(
            `✓ Trifecta draft for ${draft.venue} R${draft.raceNumber} dispatched to ${cleanedPhone}`
          );
        } else {
          setSmsDispatchStatus({
            ok: false,
            message:
              data?.error ||
              "Could not reach server SMS gateway — use the 1-Tap SMS App button to send directly from your device.",
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      } catch {
        setSmsDispatchStatus({
          ok: true,
          message: `✓ Draft compiled for ${cleanedPhone}. Tap 'Open in SMS App' to send directly via your mobile carrier.`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } finally {
        setIsSendingSms(false);
      }
    },
    [onTriggerToast]
  );

  // T-Minus 5-Minute Background Watcher (checks every 15s for races jumping in <= 5 mins)
  useEffect(() => {
    if (!autoCompileAtT5m) return;
    const checkTMinus5Minutes = () => {
      for (const item of allCandidateRaces) {
        if (item.evalData.isRaceResulted) continue;
        if (!item.evalData.hasCombinedSelections) continue;
        const mins = computeMinutesUntilJump(
          item.meeting.date,
          item.race.startTime
        );
        if (mins !== null && mins > 0 && mins <= 5) {
          const triggerId = `${item.meeting.id}-r${item.race.raceNumber}`;
          if (!autoTriggeredRacesRef.current.has(triggerId)) {
            autoTriggeredRacesRef.current.add(triggerId);
            const autoDraft = compileSportsbetTrifectaDraftForRace(
              item.meeting,
              item.race,
              item.evalData,
              activeBetAmount,
              "AUTO_T5M"
            );
            setSelectedDraftRaceKey(item.key);
            setCompiledDraft(autoDraft);
            onTriggerToast?.(
              `⏱ T-Minus ${mins}m Alert: Compiled Syndicate Boxed Trifecta for ${item.meeting.venue} R${item.race.raceNumber}!`
            );
            if (smsPhoneNumber.trim().length >= 8) {
              dispatchSmsDraftToServer(autoDraft, smsPhoneNumber);
            }
          }
        }
      }
    };

    checkTMinus5Minutes();
    const timerId = window.setInterval(checkTMinus5Minutes, 15_000);
    return () => window.clearInterval(timerId);
  }, [
    autoCompileAtT5m,
    allCandidateRaces,
    activeBetAmount,
    smsPhoneNumber,
    dispatchSmsDraftToServer,
    onTriggerToast,
  ]);

  if (!activeMeeting) return null;

  const nativeSmsHref = compiledDraft
    ? `sms:${encodeURIComponent(smsPhoneNumber.trim())}?&body=${encodeURIComponent(
        compiledDraft.smsBodyText
      )}`
    : "#";

  return (
    <div className="space-y-4">
      {/* 1. Multi-Select Race Card Switcher + Custom Trifecta Bet Amount Calculator + Scoreboard */}
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1F2D26] pb-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Combined Syndicate Trifecta Pool —{" "}
                  {selectedMeetingsList.length} of {meetings.length} Race Card
                  {selectedMeetingsList.length === 1 ? "" : "s"} Selected (
                  {activeMeeting.date})
                </span>
              </div>
              <RaceCardMultiSelectDropdown
                meetings={meetings}
                selectedMeetingIds={effectiveSelectedIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedIds}
                punters={punters}
                labelPrefix="Trifecta Race Cards"
                compact
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {meetings.map((m) => {
                const isChecked = effectiveSelectedIds.includes(m.id);
                const combinedRacesPickedCount = m.races.filter((r) =>
                  punters.some((p) => {
                    const mSel = getPunterSelectionsForMeeting(p, m);
                    const t = mSel[r.raceNumber];
                    return (
                      t &&
                      (t.firstPref !== null ||
                        t.secondPref !== null ||
                        t.thirdPref !== null)
                    );
                  })
                ).length;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMeetingInSelection(m.id)}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 border cursor-pointer ${
                      isChecked
                        ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-semibold"
                        : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border-[#1F2D26]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        isChecked
                          ? "bg-[#0B110E] border-[#0B110E] text-[#D4AF37]"
                          : "bg-transparent border-[#3A4D42] text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold ${
                        isChecked
                          ? "bg-[#0B110E]/20 text-[#0B110E]"
                          : "bg-[#192620] text-[#D4AF37]"
                      }`}
                    >
                      {m.state || "TAB"}
                    </span>
                    <span>{m.venue}</span>
                    <span className="font-mono text-[11px] opacity-80">
                      ({combinedRacesPickedCount}/{m.races.length} R Combined)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Flexi Combined Mode Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={isFlexiCombined}
              onClick={handleToggleFlexiCombined}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isFlexiCombined
                  ? "bg-[#152920] border-[#10B981] text-[#10B981] ring-1 ring-[#10B981]/50"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:border-[#3A4D42] hover:text-[#D5DDD8]"
              }`}
              title="Flexi Combined Toggle: Combines aggregate selections of all registered users into a unified flexi-bet, applying the auto-banker rule if any runner has odds below 1.9."
            >
              <Zap
                className={`w-3.5 h-3.5 ${
                  isFlexiCombined
                    ? "text-[#10B981] fill-[#10B981]/20"
                    : "text-[#8A9990]"
                }`}
              />
              <span>Flexi Combined:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-extrabold transition-colors ${
                  isFlexiCombined
                    ? "bg-[#10B981] text-[#0B110E]"
                    : "bg-[#192620] text-[#8A9990]"
                }`}
              >
                {isFlexiCombined ? "ON (Auto-Banker <1.9)" : "OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilterMode((prev) =>
                  prev === "ALL" ? "SELECTED_ONLY" : "ALL"
                )
              }
              className="min-h-[36px] px-3 py-1.5 rounded-md bg-[#0B110E] border border-[#1F2D26] text-xs font-mono text-[#D5DDD8] hover:border-[#D4AF37] transition-colors cursor-pointer"
            >
              {filterMode === "ALL"
                ? `Filter: Showing All Races`
                : `Filter: Showing Selected Races (${summaryStats.racesWithSelections})`}
            </button>
            <button
              type="button"
              onClick={() =>
                onJumpToSelections(punters[0]?.id, activeMeeting.id)
              }
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#192620] border border-[#10B981]/50 text-[#10B981] text-xs font-semibold hover:bg-[#21332B] transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit User Selections ↑</span>
            </button>
          </div>
        </div>

        {/* Customisable Trifecta Bet Amount Bar (Default $20 Bet) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#0B110E] border border-[#D4AF37]/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>
                Trifecta Odds &amp; Payout Calculator — Based on $
                {activeBetAmount} Bet (Customisable)
              </span>
            </div>
            <p className="text-[11px] text-[#8A9990]">
              Calculates exact Boxed Flexi Trifecta odds &amp; payouts per race
              based on a{" "}
              <strong className="text-[#F3F4F0]">$20 default bet</strong> (or
              customise your syndicate Trifecta bet stake below):
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {PRESET_BET_AMOUNTS.map((amt) => {
                const isActive = Math.abs(activeBetAmount - amt) < 0.01;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleUpdateBetAmount(amt)}
                    className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors border cursor-pointer ${
                      isActive
                        ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                        : "bg-[#121A16] text-[#D5DDD8] border-[#1F2D26] hover:border-[#D4AF37]"
                    }`}
                  >
                    ${amt}
                    {amt === 20 ? " (Default)" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 bg-[#121A16] border border-[#23352C] rounded-md px-2.5 py-1">
              <span className="text-xs font-mono text-[#8A9990]">Custom $:</span>
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={betInputText}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBetInputText(raw);
                  const num = Number(raw);
                  if (Number.isFinite(num) && num > 0) {
                    setLocalBetAmount(num);
                    try {
                      localStorage.setItem(
                        STORAGE_KEY_TRIFECTA_BET,
                        String(num)
                      );
                    } catch {
                      // ignore
                    }
                    onChangeTrifectaBetAmount?.(num);
                  }
                }}
                onBlur={() => {
                  const num = Number(betInputText);
                  if (!Number.isFinite(num) || num <= 0) {
                    handleUpdateBetAmount(20);
                  } else {
                    handleUpdateBetAmount(num);
                  }
                }}
                aria-label="Custom Trifecta Bet Amount in Dollars"
                className="w-20 bg-[#0B110E] border border-[#1F2D26] rounded px-2 py-1 text-xs font-mono font-bold text-[#D4AF37] focus:outline-none focus:border-[#D4AF37]"
              />
              {activeBetAmount !== 20 && (
                <button
                  type="button"
                  onClick={() => handleUpdateBetAmount(20)}
                  className="text-[11px] font-mono text-[#10B981] hover:underline cursor-pointer whitespace-nowrap"
                >
                  Reset $20
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Flexi Combined Mode Info Banner */}
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors ${
            isFlexiCombined
              ? "bg-[#0E1F18] border-[#10B981]/40 text-[#D5DDD8]"
              : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990]"
          }`}
        >
          <div className="flex items-start md:items-center gap-2.5">
            <Zap
              className={`w-4 h-4 shrink-0 mt-0.5 md:mt-0 ${
                isFlexiCombined ? "text-[#10B981]" : "text-[#8A9990]"
              }`}
            />
            <div>
              <span
                className={`font-bold ${
                  isFlexiCombined ? "text-[#10B981]" : "text-[#F3F4F0]"
                }`}
              >
                Flexi Combined {isFlexiCombined ? "Active" : "Disabled"}:
              </span>{" "}
              <span>
                {isFlexiCombined
                  ? `Combines aggregate selections of all registered users (${punters.length} punters) into a unified flexi-bet. If any runner has odds below 1.9, the Standard Banker Rule (1st Standout Banker) auto-triggers.`
                  : "Standard mode active without automatic pooling. Toggle 'Flexi Combined' ON to pool all users' tips and trigger the auto-banker rule on runners under $1.90."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleFlexiCombined}
              className={`px-3 py-1 rounded text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                isFlexiCombined
                  ? "bg-[#152920] border-[#10B981] text-[#10B981] hover:bg-[#1E3A2E]"
                  : "bg-[#121A16] border-[#3A4D42] text-[#D5DDD8] hover:border-[#10B981] hover:text-[#10B981]"
              }`}
            >
              {isFlexiCombined ? "Disable Flexi Combined" : "Enable Flexi Combined"}
            </button>
          </div>
        </div>

        {/* ====================================================================
            T-MINUS 5-MINUTE PRE-RACE TRIFECTA COMPILER, SPORTSBET.COM.AU BUILDER
            & SMS DRAFT BET TEXT DISPATCHER
           ==================================================================== */}
        <div className="rounded-xl border border-[#10B981]/50 bg-[#0B1310] p-4 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1F2D26] pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#10B981] text-[#0B110E] font-mono text-[10px] font-bold uppercase">
                  <Zap className="w-3 h-3" />
                  T-Minus 5m Auto-Compiler + Sportsbet + SMS
                </span>
                <span className="text-xs font-bold text-[#F3F4F0]">
                  5-Minute Pre-Race Trifecta Compiler, Sportsbet.com.au Slip
                  Builder &amp; SMS Draft Text Dispatcher
                </span>
              </div>
              <p className="text-[11px] text-[#8A9990]">
                Automatically compiles all users&apos; combined Trifecta runners{" "}
                <strong className="text-[#10B981]">
                  5 minutes before race jump (T-5m)
                </strong>
                , builds your Boxed Flexi Trifecta specification with a direct{" "}
                <strong className="text-[#D4AF37]">Sportsbet.com.au</strong>{" "}
                race link, and texts the ready-to-place draft bet to your
                nominated mobile number.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoCompileAtT5m((prev) => !prev)}
                className={`min-h-[34px] px-3 py-1.5 rounded-md border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  autoCompileAtT5m
                    ? "bg-[#152920] border-[#10B981] text-[#10B981]"
                    : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990]"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>
                  Auto T-5m Trigger: {autoCompileAtT5m ? "ACTIVE" : "PAUSED"}
                </span>
              </button>
            </div>
          </div>

          {/* Controls Row: Target Race Selector + Mobile Phone Input + Action Buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            {/* Race Selector */}
            <div className="lg:col-span-4 space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9990]">
                1. Select Race to Compile (or Auto-Selects at T-5m)
              </label>
              <select
                aria-label="Select Race for Sportsbet Trifecta Compilation"
                value={selectedDraftRaceKey}
                onChange={(e) => {
                  const key = e.target.value;
                  setSelectedDraftRaceKey(key);
                  const found = allCandidateRaces.find((c) => c.key === key);
                  if (found) {
                    setCompiledDraft(
                      compileSportsbetTrifectaDraftForRace(
                        found.meeting,
                        found.race,
                        found.evalData,
                        activeBetAmount,
                        "MANUAL"
                      )
                    );
                  }
                }}
                className="w-full min-h-[38px] rounded-lg bg-[#121A16] border border-[#23352C] px-3 py-1.5 text-xs font-mono text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37]"
              >
                {allCandidateRaces.map((c) => {
                  const count = c.evalData.combinedRunners.length;
                  const statusLabel = c.evalData.isRaceResulted
                    ? "Final"
                    : c.minutesUntilJump !== null && c.minutesUntilJump > 0
                    ? `Jumps in ${c.minutesUntilJump}m (${c.race.startTime})`
                    : c.race.startTime;
                  return (
                    <option key={c.key} value={c.key}>
                      {c.meeting.venue} R{c.race.raceNumber} — {c.race.raceName}{" "}
                      [{count} Horses Boxed · {statusLabel}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Phone Number Input */}
            <div className="lg:col-span-4 space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A9990]">
                2. Recipient Mobile Number (for T-5m SMS Draft Bet)
              </label>
              <div className="flex items-center gap-1.5 rounded-lg bg-[#121A16] border border-[#23352C] px-2.5 py-1 min-h-[38px]">
                <Phone className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <input
                  type="tel"
                  value={smsPhoneNumber}
                  onChange={(e) => setSmsPhoneNumber(e.target.value)}
                  placeholder="e.g. 0412 345 678 or +61412345678"
                  aria-label="Recipient Mobile Phone Number for Trifecta Draft SMS"
                  className="w-full bg-transparent text-xs font-mono text-[#F3F4F0] placeholder-[#5F7067] focus:outline-none"
                />
              </div>
            </div>

            {/* Action Buttons: Compile & Text Now + Open in Sportsbet */}
            <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
              {compiledDraft && (
                <>
                  <button
                    type="button"
                    disabled={isSendingSms}
                    onClick={() =>
                      dispatchSmsDraftToServer(compiledDraft, smsPhoneNumber)
                    }
                    className="min-h-[38px] flex-1 px-3 py-1.5 rounded-lg bg-[#10B981] text-[#0B110E] text-xs font-bold hover:bg-[#14cf91] disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSendingSms ? "Texting..." : "Text Draft Bet Now"}
                    </span>
                  </button>

                  <a
                    href={nativeSmsHref}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#192620] border border-[#10B981]/50 text-[#10B981] text-xs font-semibold hover:bg-[#21332B] transition-colors inline-flex items-center gap-1.5"
                    title="Opens your phone or computer SMS Messages app pre-filled with the compiled Sportsbet Trifecta draft"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>SMS App</span>
                  </a>

                  <a
                    href={compiledDraft.sportsbetRaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(compiledDraft.smsBodyText)
                        .catch(() => {});
                      onTriggerToast?.(
                        `Copied Boxed Trifecta numbers (${compiledDraft.runnerNumbers
                          .map((n) => `#${n}`)
                          .join(", ")}) & opened Sportsbet.com.au!`
                      );
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e3be42] transition-colors inline-flex items-center gap-1.5"
                    title="Copies your Boxed Trifecta numbers to clipboard and opens the race card on Sportsbet.com.au"
                  >
                    <span>Sportsbet.com.au</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Compiled Sportsbet Draft Preview Box */}
          {compiledDraft && (
            <div className="rounded-lg border border-[#1F2D26] bg-[#121A16] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#D4AF37]">
                    COMPILED SPORTSBET BOXED FLEXI TRIFECTA SLIP:
                  </span>
                  <span className="font-semibold text-[#F3F4F0]">
                    {compiledDraft.venue} ({compiledDraft.state}) · Race{" "}
                    {compiledDraft.raceNumber} ({compiledDraft.startTime})
                  </span>
                  {compiledDraft.runnerNumbers.length > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-[#152920] border border-[#10B981]/50 text-[#10B981] font-mono text-[11px] font-bold">
                      Box Numbers:{" "}
                      {compiledDraft.runnerNumbers
                        .map((n) => `#${n}`)
                        .join(", ")}{" "}
                      ({compiledDraft.boxedCombinationsCount} Combos ·{" "}
                      {compiledDraft.flexiPercentage}% Flexi on $
                      {compiledDraft.stakeAmount})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-[#291414] border border-[#EF4444]/40 text-[#EF4444] font-mono text-[11px]">
                      No horses selected for R{compiledDraft.raceNumber} yet —
                      enter picks in Betting Selections
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(compiledDraft.smsBodyText)
                      .catch(() => {});
                    setCopiedSlip(true);
                    setTimeout(() => setCopiedSlip(false), 2000);
                    onTriggerToast?.(
                      "Copied Sportsbet Trifecta Draft SMS text to clipboard."
                    );
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B110E] border border-[#23352C] text-[11px] font-mono text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer"
                >
                  <ClipboardCopy className="w-3 h-3" />
                  <span>{copiedSlip ? "Copied!" : "Copy Draft Slip"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] space-y-1 text-[#D5DDD8] whitespace-pre-wrap">
                  {compiledDraft.smsBodyText}
                </div>
                <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] space-y-1.5 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="text-[#D4AF37] font-bold uppercase text-[10px]">
                      How Sportsbet.com.au Bet Building Works:
                    </div>
                    <p className="text-[#8A9990] font-sans text-xs leading-relaxed">
                      1. At <strong className="text-[#F3F4F0]">T-5m</strong>{" "}
                      before jump (or when you click{" "}
                      <strong className="text-[#10B981]">
                        Text Draft Bet Now
                      </strong>
                      ), TurfSheet merges every runner picked by{" "}
                      {punters.map((p) => p.name).join(" & ")} into a Boxed
                      Flexi Trifecta draft and texts the slip + direct Sportsbet
                      race link to your phone.
                      <br />
                      2. Tap the{" "}
                      <strong className="text-[#D4AF37]">
                        Sportsbet.com.au
                      </strong>{" "}
                      link in the text message, select{" "}
                      <span className="font-mono text-[#F3F4F0]">
                        Exotics → Trifecta → Boxed
                      </span>
                      , tick{" "}
                      <span className="font-mono text-[#10B981] font-bold">
                        {compiledDraft.runnerNumbers.length > 0
                          ? compiledDraft.runnerNumbers
                              .map((n) => `#${n}`)
                              .join(", ")
                          : "your boxed numbers"}
                      </span>
                      , and enter{" "}
                      <span className="font-mono text-[#D4AF37] font-bold">
                        ${compiledDraft.stakeAmount}
                      </span>{" "}
                      Flexi ({compiledDraft.flexiPercentage}%).
                    </p>
                  </div>
                  {smsDispatchStatus && (
                    <div
                      className={`px-2.5 py-1.5 rounded border text-[11px] font-mono ${
                        smsDispatchStatus.ok
                          ? "bg-[#152920] border-[#10B981]/50 text-[#10B981]"
                          : "bg-[#291414] border-[#EF4444]/50 text-[#EF4444]"
                      }`}
                    >
                      [{smsDispatchStatus.timestamp}]{" "}
                      {smsDispatchStatus.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4-Card Summary Strip: Combined Trifecta Success & Payout on $20 / Custom Bet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Combined Trifecta Strike Rate */}
          <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
              <span>Combined Trifecta Hits</span>
              <Target className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-[#D4AF37]">
                {summaryStats.boxedTrifectaHits} /{" "}
                {summaryStats.resultedWithSelectionsCount ||
                  summaryStats.resultedRacesCount}
              </span>
              <span className="text-xs text-[#10B981] font-semibold">
                ({summaryStats.strikeRatePct}% Hit Rate)
              </span>
            </div>
            <div className="text-[11px] text-[#8A9990]">
              All horses selected by all users combined ·{" "}
              {summaryStats.nearMiss2Of3Count} Near Misses (2 of 3 placed)
            </div>
          </div>

          {/* Card 2: Return on $20 (or Custom $) Flexi Trifecta Bet */}
          <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#10B981]/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#10B981]">
              <span className="flex items-center gap-1.5">
                ${activeBetAmount} Flexi Trifecta Return
                {summaryStats.totalCustomBetReturn > 0 && (
                  <button
                    type="button"
                    onClick={() => triggerConfetti()}
                    title="Trigger celebratory confetti burst"
                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 transition-colors cursor-pointer"
                  >
                    🎉 Burst
                  </button>
                )}
              </span>
              <Trophy className="w-3.5 h-3.5 text-[#10B981]" />
            </div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span
                className={`text-2xl font-bold ${
                  summaryStats.totalCustomBetReturn > 0
                    ? "text-[#10B981]"
                    : "text-[#F3F4F0]"
                }`}
              >
                <RollingDividendCounter
                  value={summaryStats.totalCustomBetReturn}
                  prefix="$"
                  decimals={2}
                />
              </span>
              <span className="text-xs text-[#8A9990]">
                (Outlay: {formatDollarReturn(summaryStats.totalCustomBetOutlay)})
              </span>
            </div>
            <div className="text-[11px] text-[#8A9990]">
              Payout on a{" "}
              <strong className="text-[#F3F4F0]">${activeBetAmount}</strong>{" "}
              {isFlexiCombined
                ? "Flexi Combined Trifecta (all users' aggregate tips + auto-banker on < $1.90 favs)"
                : "Flexi Trifecta (standard box / custom selections)"}
            </div>
          </div>

          {/* Card 3: Captured Bookmaker $1 Unit Dividend & Net Profit */}
          <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
              <span>Captured $1 Unit Dividend</span>
              <DollarSign className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span
                className={`text-2xl font-bold ${
                  summaryStats.capturedBookmakerTrifectaValue > 0
                    ? "text-[#D4AF37]"
                    : "text-[#F3F4F0]"
                }`}
              >
                <RollingDividendCounter
                  value={summaryStats.capturedBookmakerTrifectaValue}
                  prefix="$"
                  decimals={2}
                />
              </span>
              <span className="text-xs text-[#8A9990]">
                from {summaryStats.boxedTrifectaHits} winning race(s)
              </span>
            </div>
            <div className="text-[11px] text-[#8A9990]">
              All-Users Boxed Net P/L:{" "}
              <strong
                className={
                  summaryStats.netProfitOnBet >= 0
                    ? "text-[#10B981]"
                    : "text-[#EF4444]"
                }
              >
                {summaryStats.netProfitOnBet >= 0 ? "+" : "-"}$
                {Math.abs(summaryStats.netProfitOnBet).toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Card 4: Benchmark Against Total Bookmaker Trifecta Pool */}
          <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
              <span>Card Trifecta Pool (${activeBetAmount} Basis)</span>
              <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-2xl font-bold text-[#F3F4F0]">
                {summaryStats.resultedRacesCount > 0
                  ? formatDollarReturn(summaryStats.totalPoolOnBetAmount)
                  : "Upcoming"}
              </span>
              {summaryStats.resultedRacesCount > 0 && (
                <span className="text-xs text-[#D4AF37] font-semibold">
                  ($1 Pool:{" "}
                  {formatDollarReturn(summaryStats.totalBookmakerTrifectaPool)})
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8A9990]">
              {summaryStats.resultedRacesCount > 0
                ? `${summaryStats.valueCapturePct}% of card Trifecta dividends captured`
                : `Races across selected card(s) are upcoming`}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Race-by-Race Combined Selections & Trifecta Return Tables for Each Checked Race Card */}
      <div className="space-y-6">
        {evaluationsByMeeting.map(({ meeting: cardMeeting, evaluations }) => {
          const displayedRows =
            filterMode === "SELECTED_ONLY"
              ? evaluations.filter((r) => r.evalData.hasCombinedSelections)
              : evaluations;

          return (
            <div
              key={cardMeeting.id}
              className="bg-[#121A16] border border-[#1F2D26] rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#1F2D26] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0E1612]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#192620] border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-[10px] font-bold">
                      {cardMeeting.state || "TAB"}
                    </span>
                    <h3 className="text-sm font-semibold text-[#F3F4F0]">
                      Combined Syndicate Trifecta Selections &amp; $
                      {activeBetAmount} Bet Odds/Return Per Race —{" "}
                      {cardMeeting.venue} ({cardMeeting.date})
                    </h3>
                  </div>
                  <p className="text-xs text-[#8A9990] mt-0.5">
                    All selections from {punters.map((p) => p.name).join(", ")}{" "}
                    are merged per race into a Combined Boxed Trifecta Pool and
                    calculated on a{" "}
                    <strong className="text-[#D4AF37]">
                      ${activeBetAmount}
                    </strong>{" "}
                    Trifecta bet.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {punters.length} Active Users · ${activeBetAmount} Bet Stake
                  </span>
                </div>
              </div>

              {/* Desktop / Tablet Full Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1F2D26] bg-[#0B110E] text-[11px] font-mono uppercase text-[#8A9990]">
                      <th className="py-2.5 px-3 whitespace-nowrap">Race</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        Each User&apos;s Selections (1st / 2nd / 3rd)
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        Combined Syndicate Trifecta Pool
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        Official 1st–2nd–3rd &amp; Trifecta Combo
                      </th>
                      <th className="py-2.5 px-3 whitespace-nowrap">
                        Trifecta Hit / Podium Coverage
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        Trifecta Odds, Return &amp; Sportsbet/SMS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2D26] text-xs">
                    {displayedRows.map(({ race, raceKey, evalData }) => {
                      const {
                        isRaceResulted,
                        hasCombinedSelections,
                        totalUserPicksCount,
                        combinedRunners,
                        boxedCombinationsCount,
                        officialPodium,
                        podiumHitFlags,
                        isCombinedBoxedTrifectaHit,
                        officialTrifectaCombination,
                        flexiPercentage,
                        bookmakerTrifectaDividend,
                        trifectaOddsOnBetAmount,
                        estimatedUpcomingTrifectaDividend,
                        estimatedPayoutOnBetAmount,
                        capturedTrifectaReturn,
                        customBetFlexiReturn,
                      } = evalData;

                      return (
                        <tr
                          key={race.raceNumber}
                          className={`transition-colors align-top ${
                            isCombinedBoxedTrifectaHit
                              ? "bg-[#11261C]/90 hover:bg-[#152E22]"
                              : "hover:bg-[#16201B]"
                          }`}
                        >
                          {/* Column 1: Race Info */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[#F3F4F0]">
                                R{race.raceNumber}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                  isRaceResulted
                                    ? "bg-[#152920] text-[#10B981]"
                                    : "bg-[#192620] text-[#D4AF37]"
                                }`}
                              >
                                {isRaceResulted ? "FINAL" : "UPCOMING"}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-[#F3F4F0] max-w-[165px] truncate mt-0.5">
                              {race.raceName}
                            </div>
                            <div className="font-mono text-[11px] text-[#8A9990]">
                              {race.startTime} · {race.distance}m
                            </div>
                          </td>

                          {/* Column 2: Individual User Selections Contributing to Pool */}
                          <td className="py-3 px-3 min-w-[210px]">
                            <div className="space-y-1.5">
                              {punters.map((punter) => {
                                const mSel = getPunterSelectionsForMeeting(
                                  punter,
                                  cardMeeting
                                );
                                const trio = mSel[race.raceNumber];
                                const isJoker =
                                  getPunterJokerForMeeting(
                                    punter,
                                    cardMeeting
                                  ) === race.raceNumber;
                                const picks = [
                                  trio?.firstPref ?? null,
                                  trio?.secondPref ?? null,
                                  trio?.thirdPref ?? null,
                                ];
                                const hasPicks = picks.some((x) => x !== null);

                                return (
                                  <div
                                    key={punter.id}
                                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#0B110E] border border-[#1F2D26] font-mono text-[11px]"
                                  >
                                    <span className="font-sans font-semibold text-[#F3F4F0] flex items-center gap-1">
                                      {punter.name}
                                      {isJoker && (
                                        <span
                                          className="px-1 py-0.2 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-mono text-[9px] font-bold"
                                          title="Nominated Joker Round (2x Points if 1st Pref Wins)"
                                        >
                                          🃏 2×
                                        </span>
                                      )}
                                    </span>
                                    {hasPicks ? (
                                      <span className="text-[#D4AF37] tabular-nums">
                                        {picks
                                          .map((tab) =>
                                            tab !== null ? `#${tab}` : "—"
                                          )
                                          .join(" / ")}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onJumpToSelections(
                                            punter.id,
                                            cardMeeting.id
                                          )
                                        }
                                        className="text-[10px] text-[#8A9990] hover:text-[#D4AF37] underline cursor-pointer"
                                      >
                                        + Pick 3
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          {/* Column 3: Combined Unique Runners Pool for Trifecta */}
                          <td className="py-3 px-3 min-w-[260px]">
                            {!hasCombinedSelections ? (
                              <div className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] text-xs flex items-center justify-between gap-2">
                                <span>No combined runners selected yet</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onJumpToSelections(
                                      punters[0]?.id,
                                      cardMeeting.id
                                    )
                                  }
                                  className="text-[#D4AF37] font-semibold hover:underline cursor-pointer whitespace-nowrap"
                                >
                                  Select Now →
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {combinedRunners.map((entry) => {
                                    const isPodium =
                                      isRaceResulted &&
                                      entry.finishPosition >= 1 &&
                                      entry.finishPosition <= 3;

                                    return (
                                      <span
                                        key={entry.tabNumber}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
                                          isPodium
                                            ? "bg-[#152920] border-[#10B981] text-[#10B981] font-bold"
                                            : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                                        }`}
                                        title={`Picked by: ${entry.pickedByUsers
                                          .map(
                                            (u) =>
                                              `${u.punterName} (${u.preferenceRank}P)`
                                          )
                                          .join(", ")}`}
                                      >
                                        <span className="text-[#D4AF37] font-bold">
                                          #{entry.tabNumber}
                                        </span>
                                        <span className="truncate max-w-[95px]">
                                          {entry.runner?.horseName || "Runner"}
                                        </span>
                                        {entry.pickedByUsers.length > 1 && (
                                          <span className="px-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[9px]">
                                            {entry.pickedByUsers.length}u
                                          </span>
                                        )}
                                        {isPodium && (
                                          <span className="text-[10px] font-bold">
                                            ({entry.finishPosition}
                                            {entry.finishPosition === 1
                                              ? "st"
                                              : entry.finishPosition === 2
                                              ? "nd"
                                              : "rd"}
                                            )
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="space-y-1.5 pt-1 border-t border-[#1F2D26]/60">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                          evalData.isStandoutTriggered
                                            ? "bg-[#10B981] text-[#0B110E]"
                                            : evalData.isCustomized
                                            ? "bg-[#D4AF37] text-[#0B110E]"
                                            : "bg-[#192620] text-[#10B981] border border-[#10B981]/40"
                                        }`}
                                      >
                                        {evalData.betTypeLabel}
                                      </span>
                                      <span className="text-[#8A9990]">
                                        <strong className="text-[#F3F4F0]">
                                          {evalData.combinationsCount || boxedCombinationsCount} Combos
                                        </strong>{" "}
                                        ·{" "}
                                        <strong className="text-[#10B981]">
                                          {flexiPercentage}% Flexi
                                        </strong>{" "}
                                        (${activeBetAmount} Stake)
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveCustomisingRace({
                                          race,
                                          meeting: cardMeeting,
                                          evalData,
                                          raceKey,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#14201A] hover:bg-[#1E3027] text-[#D4AF37] hover:text-[#F59E0B] border border-[#23352C] hover:border-[#D4AF37] text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                                    >
                                      <Sliders className="w-3 h-3" />
                                      <span>
                                        {evalData.isCustomized ? "Edit Bet" : "Customise Bet"}
                                      </span>
                                    </button>
                                  </div>

                                  {evalData.isStandoutTriggered ? (
                                    <div className="text-[10px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                                      <Zap className="w-3 h-3 text-[#10B981]" />
                                      <span>
                                        Auto-Banker Triggered (&lt;$1.90 Fav): #{evalData.standoutRunner?.tabNumber}{" "}
                                        {evalData.standoutRunner?.horseName} locked as 1st Banker · Remaining tips boxed 2nd &amp; 3rd
                                      </span>
                                    </div>
                                  ) : isFlexiCombined && evalData.hasCombinedSelections ? (
                                    <div className="text-[10px] font-mono text-[#8A9990] flex items-center gap-1">
                                      <span>
                                        Flexi Combined: All registered users&apos; tips boxed flexi (No runner &lt; $1.90)
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Column 4: Official 1st-2nd-3rd & Trifecta Combination */}
                          <td className="py-3 px-3 font-mono text-[11px] tabular-nums whitespace-nowrap">
                            {!isRaceResulted ? (
                              <div className="space-y-1 py-0.5">
                                <div className="inline-flex items-center gap-1.5 text-[#D4AF37] font-semibold">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Upcoming ({race.startTime})</span>
                                </div>
                                <div className="text-[#8A9990] text-[10px]">
                                  Official Trifecta combo pending All-Clear
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-[#D4AF37] font-bold">
                                  Trifecta: {officialTrifectaCombination}
                                </div>
                                <div className="text-[#F3F4F0] text-[10px]">
                                  1st: #{officialPodium.first?.tabNumber}{" "}
                                  {officialPodium.first?.horseName}
                                </div>
                                <div className="text-[#8A9990] text-[10px]">
                                  2nd: #{officialPodium.second?.tabNumber}{" "}
                                  {officialPodium.second?.horseName} · 3rd: #
                                  {officialPodium.third?.tabNumber}{" "}
                                  {officialPodium.third?.horseName}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Column 5: Trifecta Hit / Podium Coverage Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {!hasCombinedSelections ? (
                              <span className="text-[#8A9990] font-mono text-[11px]">
                                — Awaiting user picks
                              </span>
                            ) : !isRaceResulted ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#192620] border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-[11px] font-semibold">
                                  <Sparkles className="w-3 h-3" />
                                  {combinedRunners.length >= 3
                                    ? `Active (${boxedCombinationsCount} Combos · ${flexiPercentage}% Flexi)`
                                    : `Need ${
                                        3 - combinedRunners.length
                                      } More Runner(s)`}
                                </span>
                                <div className="text-[10px] font-mono text-[#8A9990]">
                                  ${activeBetAmount} Bet staked across boxed
                                  pool
                                </div>
                              </div>
                            ) : isCombinedBoxedTrifectaHit ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#10B981] text-[#0B110E] font-mono text-[11px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  TRIFECTA HIT! (3/3 Podium in{" "}
                                  {combinedRunners.length} Horses)
                                </span>
                                <div className="text-[10px] font-mono text-[#D4AF37] font-semibold">
                                  All 3 placegetters covered across{" "}
                                  {boxedCombinationsCount} boxed combinations
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                                    podiumHitFlags.hitCount === 2
                                      ? "bg-[#192620] border border-[#D4AF37]/50 text-[#D4AF37]"
                                      : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990]"
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {podiumHitFlags.hitCount}/3 Podium in Combined
                                  Pool
                                </span>
                                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                  <span
                                    className={
                                      podiumHitFlags.firstInCombined
                                        ? "text-[#10B981] font-bold"
                                        : "text-[#8A9990]"
                                    }
                                  >
                                    1st{" "}
                                    {podiumHitFlags.firstInCombined ? "✓" : "✗"}
                                  </span>
                                  <span>·</span>
                                  <span
                                    className={
                                      podiumHitFlags.secondInCombined
                                        ? "text-[#10B981] font-bold"
                                        : "text-[#8A9990]"
                                    }
                                  >
                                    2nd{" "}
                                    {podiumHitFlags.secondInCombined
                                      ? "✓"
                                      : "✗"}
                                  </span>
                                  <span>·</span>
                                  <span
                                    className={
                                      podiumHitFlags.thirdInCombined
                                        ? "text-[#10B981] font-bold"
                                        : "text-[#8A9990]"
                                    }
                                  >
                                    3rd{" "}
                                    {podiumHitFlags.thirdInCombined ? "✓" : "✗"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Column 6: Bookmaker Trifecta Dividend + Quick Compile & SMS Trigger */}
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap space-y-1.5">
                            {!isRaceResulted ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-bold text-[#D4AF37]">
                                  Est. ${activeBetAmount} Bet: ~
                                  {formatDollarReturn(
                                    estimatedPayoutOnBetAmount
                                  )}
                                </div>
                                <div className="text-[10px] text-[#8A9990]">
                                  $1 Base Div: ~
                                  {formatDollarReturn(
                                    estimatedUpcomingTrifectaDividend
                                  )}{" "}
                                  ({flexiPercentage}% Flexi)
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-[#D4AF37]">
                                  ${activeBetAmount} Box Quote:{" "}
                                  <strong>
                                    {formatDollarReturn(
                                      trifectaOddsOnBetAmount
                                    )}
                                  </strong>
                                </div>
                                <div className="text-[10px] text-[#8A9990]">
                                  $1 Base Div:{" "}
                                  <span className="text-[#F3F4F0]">
                                    {formatDollarReturn(
                                      bookmakerTrifectaDividend
                                    )}
                                  </span>{" "}
                                  ({flexiPercentage}% Flexi)
                                </div>
                                {hasCombinedSelections ? (
                                  isCombinedBoxedTrifectaHit ? (
                                    <>
                                      <div className="text-sm font-bold text-[#10B981]">
                                        Won (${activeBetAmount} Bet):{" "}
                                        {formatDollarReturn(
                                          customBetFlexiReturn
                                        )}
                                      </div>
                                      <div className="text-[10px] text-[#D4AF37]">
                                        $1 Unit Value:{" "}
                                        {formatDollarReturn(
                                          capturedTrifectaReturn
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-xs font-semibold text-[#8A9990]">
                                      Return: $0.00
                                    </div>
                                  )
                                ) : (
                                  <div className="text-[11px] text-[#8A9990]">
                                    — No Syndicate Bet
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Quick Row Button to Compile for Sportsbet & Text */}
                            {hasCombinedSelections && (
                              <div className="pt-1 flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const draft =
                                      compileSportsbetTrifectaDraftForRace(
                                        cardMeeting,
                                        race,
                                        evalData,
                                        activeBetAmount,
                                        "MANUAL"
                                      );
                                    setSelectedDraftRaceKey(
                                      `${cardMeeting.id}::${race.raceNumber}`
                                    );
                                    setCompiledDraft(draft);
                                    if (smsPhoneNumber.trim().length >= 8) {
                                      dispatchSmsDraftToServer(
                                        draft,
                                        smsPhoneNumber
                                      );
                                    } else {
                                      onTriggerToast?.(
                                        `Compiled Sportsbet Boxed Trifecta slip for ${cardMeeting.venue} R${race.raceNumber}!`
                                      );
                                    }
                                  }}
                                  className="px-2 py-1 rounded bg-[#152920] border border-[#10B981]/50 text-[10px] font-mono font-semibold text-[#10B981] hover:bg-[#10B981] hover:text-[#0B110E] transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Compile Boxed Trifecta for Sportsbet.com.au & SMS Draft"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>Compile &amp; SMS</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Compact View (< 768px) */}
              <div className="md:hidden divide-y divide-[#1F2D26]">
                {displayedRows.map(({ race, raceKey, evalData }) => {
                  const {
                    isRaceResulted,
                    hasCombinedSelections,
                    combinedRunners,
                    boxedCombinationsCount,
                    isCombinedBoxedTrifectaHit,
                    officialTrifectaCombination,
                    flexiPercentage,
                    bookmakerTrifectaDividend,
                    trifectaOddsOnBetAmount,
                    estimatedUpcomingTrifectaDividend,
                    estimatedPayoutOnBetAmount,
                    customBetFlexiReturn,
                    podiumHitFlags,
                  } = evalData;

                  return (
                    <div key={race.raceNumber} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#F3F4F0]">
                            R{race.raceNumber}: {race.raceName}
                          </div>
                          <div className="font-mono text-[11px] text-[#8A9990]">
                            {race.startTime} · {race.distance}m ·{" "}
                            {isRaceResulted
                              ? `Official Trifecta: ${officialTrifectaCombination}`
                              : "Upcoming"}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          {isRaceResulted ? (
                            <>
                              <div className="text-[#D4AF37] font-bold">
                                ${activeBetAmount} Bet:{" "}
                                {formatDollarReturn(trifectaOddsOnBetAmount)}
                              </div>
                              <div className="text-[10px] text-[#8A9990]">
                                $1 Div:{" "}
                                {formatDollarReturn(bookmakerTrifectaDividend)}{" "}
                                ({flexiPercentage}%)
                              </div>
                              {isCombinedBoxedTrifectaHit && (
                                <div className="text-[#10B981] font-bold flex items-center justify-end gap-1.5">
                                  <span>WON</span>
                                  <RollingDividendCounter
                                    value={customBetFlexiReturn}
                                    prefix="$"
                                    decimals={2}
                                    className="font-bold text-[#10B981]"
                                  />
                                  <span className="text-[10px] text-[#8A9990] font-normal">
                                    on ${activeBetAmount} Bet
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerConfetti();
                                    }}
                                    title="Trigger celebratory dividend confetti burst"
                                    className="inline-flex items-center text-[10px] px-1 py-0.5 rounded bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] cursor-pointer ml-1"
                                  >
                                    🎉
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="text-[#D4AF37] font-bold">
                                Est. ${activeBetAmount} Bet: ~
                                {formatDollarReturn(estimatedPayoutOnBetAmount)}
                              </div>
                              <div className="text-[10px] text-[#8A9990]">
                                $1 Base: ~
                                {formatDollarReturn(
                                  estimatedUpcomingTrifectaDividend
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {!hasCombinedSelections ? (
                        <div className="text-xs text-[#8A9990] font-mono">
                          No user selections entered for R{race.raceNumber} yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {combinedRunners.map((c) => (
                              <span
                                key={c.tabNumber}
                                className="px-2 py-0.5 rounded bg-[#0B110E] border border-[#1F2D26] font-mono text-[11px] text-[#F3F4F0]"
                              >
                                #{c.tabNumber} {c.runner?.horseName}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#1F2D26]/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] font-mono ${
                                  evalData.isStandoutTriggered
                                    ? "bg-[#10B981] text-[#0B110E]"
                                    : evalData.isCustomized
                                    ? "bg-[#D4AF37] text-[#0B110E]"
                                    : "bg-[#192620] text-[#10B981] border border-[#10B981]/40"
                                }`}
                              >
                                {evalData.betTypeLabel}
                              </span>
                              <span className="text-[11px] font-mono text-[#8A9990]">
                                <strong className="text-[#F3F4F0]">
                                  {evalData.combinationsCount || boxedCombinationsCount} Combos
                                </strong>{" "}
                                ·{" "}
                                <strong className="text-[#10B981]">
                                  {flexiPercentage}% Flexi
                                </strong>
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setActiveCustomisingRace({
                                  race,
                                  meeting: cardMeeting,
                                  evalData,
                                  raceKey,
                                })
                              }
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-[#14201A] hover:bg-[#1E3027] text-[#D4AF37] border border-[#23352C] font-mono text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>
                                {evalData.isCustomized ? "Edit Bet" : "Customise Bet"}
                              </span>
                            </button>
                          </div>

                          {evalData.isStandoutTriggered ? (
                            <div className="text-[10px] font-mono text-[#10B981] flex items-center gap-1 font-semibold">
                              <Zap className="w-3 h-3 text-[#10B981]" />
                              <span>
                                Auto-Banker Triggered (&lt;$1.90 Fav): #{evalData.standoutRunner?.tabNumber}{" "}
                                {evalData.standoutRunner?.horseName} locked in 1st · Remaining tips boxed 2nd &amp; 3rd
                              </span>
                            </div>
                          ) : isFlexiCombined && evalData.hasCombinedSelections ? (
                            <div className="text-[10px] font-mono text-[#8A9990] flex items-center gap-1">
                              <span>
                                Flexi Combined: All tips boxed flexi (No runner &lt; $1.90)
                              </span>
                            </div>
                          ) : null}

                          {isRaceResulted && (
                            <div className="text-[11px] font-mono">
                              <span
                                className={
                                  isCombinedBoxedTrifectaHit
                                    ? "text-[#10B981] font-bold"
                                    : "text-[#D4AF37]"
                                }
                              >
                                {isCombinedBoxedTrifectaHit
                                  ? `TRIFECTA HIT (${flexiPercentage}% Flexi)!`
                                  : `${podiumHitFlags.hitCount}/3 Placed`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Trifecta Bet Customiser Modal */}
      {activeCustomisingRace && (
        <InteractiveTrifectaCustomiser
          race={activeCustomisingRace.race}
          meetingVenue={activeCustomisingRace.meeting.venue}
          meetingState={activeCustomisingRace.meeting.state}
          evalData={activeCustomisingRace.evalData}
          activeStake={activeBetAmount}
          initialConfig={customConfigs[activeCustomisingRace.raceKey]}
          onApplyConfig={(cfg) => {
            handleUpdateRaceConfig(activeCustomisingRace.raceKey, cfg);
          }}
          onClose={() => setActiveCustomisingRace(null)}
        />
      )}
    </div>
  );
};
