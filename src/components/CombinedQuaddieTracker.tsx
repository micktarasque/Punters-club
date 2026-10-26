import React, { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  PlusCircle,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { PunterProfile, RaceMeeting } from "../types/racing";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  evaluateCombinedQuaddieForMeeting,
  formatDollarReturn,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";

interface CombinedQuaddieTrackerProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  quaddieBuyInPerUser?: number;
  onChangeQuaddieBuyInPerUser?: (buyInPerUser: number) => void;
  quaddieExtraByMeeting: Record<string, Record<number, number[]>>;
  onToggleQuaddieExtraRunner: (
    meetingId: string,
    raceNumber: number,
    tabNumber: number
  ) => void;
  onClearQuaddieExtrasForLeg: (meetingId: string, raceNumber: number) => void;
  onJumpToSelections: (punterId?: string, meetingId?: string) => void;
  isApple?: boolean;
  cupState?: import("../types/cupMode").CupTournamentState;
}

const STORAGE_KEY_QUADDIE_BUY_IN_PER_USER =
  "turfsheet_quaddie_buy_in_per_user_v2";
const PRESET_QUADDIE_BUY_INS_PER_USER = [20, 50, 100, 200];

export const CombinedQuaddieTracker: React.FC<CombinedQuaddieTrackerProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  selectedMeetingIds,
  onChangeSelectedMeetingIds,
  punters,
  quaddieBuyInPerUser: controlledBuyInPerUser,
  onChangeQuaddieBuyInPerUser,
  quaddieExtraByMeeting,
  onToggleQuaddieExtraRunner,
  onClearQuaddieExtrasForLeg,
  onJumpToSelections,
  isApple = false,
  cupState,
}) => {
  const isCupModeActive = Boolean(cupState?.isActive);
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

  const [localBuyInPerUser, setLocalBuyInPerUser] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUADDIE_BUY_IN_PER_USER);
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {
      // ignore storage errors
    }
    return DEFAULT_QUADDIE_BUY_IN_PER_USER;
  });

  const quaddieBuyInPerUser =
    controlledBuyInPerUser !== undefined && controlledBuyInPerUser > 0
      ? controlledBuyInPerUser
      : localBuyInPerUser;

  const [betInputText, setBetInputText] = useState<string>(() =>
    String(quaddieBuyInPerUser)
  );

  // Track which leg has its "Add Quaddie-Only Horses" drawer expanded (meetingId::raceNumber)
  const [expandedLegKey, setExpandedLegKey] = useState<string | null>(null);

  const handleUpdateBuyInPerUser = (nextVal: number) => {
    const clamped = Math.max(1, Math.min(10000, Number(nextVal.toFixed(2))));
    setLocalBuyInPerUser(clamped);
    onChangeQuaddieBuyInPerUser?.(clamped);
    setBetInputText(String(clamped));
    try {
      localStorage.setItem(
        STORAGE_KEY_QUADDIE_BUY_IN_PER_USER,
        String(clamped)
      );
    } catch {
      // ignore
    }
  };

  const activeUsersCount = Math.max(1, punters.length);
  const totalSyndicateQuaddiePool = Number(
    (quaddieBuyInPerUser * activeUsersCount).toFixed(2)
  );

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

  const quaddieEvaluationsByMeeting = useMemo(() => {
    return selectedMeetingsList.map((m) => {
      const extraMap = quaddieExtraByMeeting[m.id] || {};
      const quaddieEval = evaluateCombinedQuaddieForMeeting(
        m,
        punters,
        extraMap,
        quaddieBuyInPerUser
      );
      return {
        meeting: m,
        extraMap,
        quaddieEval,
      };
    });
  }, [
    selectedMeetingsList,
    punters,
    quaddieExtraByMeeting,
    quaddieBuyInPerUser,
  ]);

  if (!activeMeeting || quaddieEvaluationsByMeeting.length === 0) return null;

  const totalExtrasAcrossSelectedCards = quaddieEvaluationsByMeeting.reduce(
    (acc, item) =>
      acc +
      item.quaddieEval.legs.reduce(
        (s, l) => s + l.extraSelectedRunners.length,
        0
      ),
    0
  );

  return (
    <div className="space-y-4">
      {/* Top Control & Stake Customiser Card */}
      <div className={`rounded-xl p-4 sm:p-5 space-y-4 border ${
        isApple
          ? "bg-white border-[#E5E5EA] text-[#1D1D1F] shadow-sm"
          : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]"
      }`}>
        {/* Multi-Select Venue Switcher */}
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b ${
          isApple ? "border-[#E5E5EA]" : "border-[#1F2D26]"
        }`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#10B981]" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#10B981] font-semibold">
                  Syndicate Combined Quaddie Selector (Last 4 Races) —{" "}
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
                labelPrefix="Quaddie Race Cards"
                compact
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {meetings.map((m) => {
                const isChecked = effectiveSelectedIds.includes(m.id);
                const sortedR = [...m.races].sort(
                  (a, b) => a.raceNumber - b.raceNumber
                );
                const qRaces =
                  sortedR.length >= 4 ? sortedR.slice(-4) : sortedR;
                const extraForM = quaddieExtraByMeeting[m.id] || {};
                const legsCovered = qRaces.filter((r) => {
                  const hasUser = punters.some((p) => {
                    const mSel = getPunterSelectionsForMeeting(p, m);
                    const t = mSel[r.raceNumber];
                    return (
                      t &&
                      (t.firstPref !== null ||
                        t.secondPref !== null ||
                        t.thirdPref !== null)
                    );
                  });
                  const hasExtra = (extraForM[r.raceNumber] || []).length > 0;
                  return hasUser || hasExtra;
                }).length;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMeetingInSelection(m.id)}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 border cursor-pointer ${
                      isChecked
                        ? "bg-[#10B981] text-[#0B110E] border-[#10B981] font-semibold"
                        : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border-[#1F2D26]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        isChecked
                          ? "bg-[#0B110E] border-[#0B110E] text-[#10B981]"
                          : "bg-transparent border-[#3A4D42] text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold ${
                        isChecked
                          ? "bg-[#0B110E]/20 text-[#0B110E]"
                          : "bg-[#192620] text-[#10B981]"
                      }`}
                    >
                      {m.state || "TAB"}
                    </span>
                    <span>{m.venue}</span>
                    <span className="font-mono text-[11px] opacity-80">
                      ({legsCovered}/4 Legs)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#0B110E] border border-[#10B981]/40 text-[11px] font-mono text-[#10B981]">
              Quaddie-Only Extras Added: {totalExtrasAcrossSelectedCards}{" "}
              Runner(s)
            </span>
            <button
              type="button"
              onClick={() =>
                onJumpToSelections(punters[0]?.id, activeMeeting.id)
              }
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#192620] border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-semibold hover:bg-[#21332B] transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Edit Base User Selections ↑</span>
            </button>
          </div>
        </div>

        {isCupModeActive && (
          <div className="p-3 sm:p-3.5 rounded-lg bg-gradient-to-r from-[#10B981]/20 via-[#D4AF37]/20 to-[#0071E3]/20 border border-[#10B981]/50 flex items-center justify-between gap-3 text-xs font-mono animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-[#10B981] text-[#070B09] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                🏆
              </span>
              <div>
                <strong className="text-[#10B981] font-bold">
                  Syndicate Cup Mode Active
                </strong>
                <span className="opacity-90 block sm:inline sm:ml-1 text-[#F3F4F0]">
                  — Group Quaddie legs are built using each member's allocated draft selection (1 runner per member) + Quaddie-Only Extras.
                </span>
              </div>
            </div>
            <span className="hidden md:inline px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px]">
              Allocated Leg Selections
            </span>
          </div>
        )}

        {/* Quaddie Per-User Buy-In & Syndicate Pool Customiser */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#0B110E] border border-[#10B981]/40">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>
                Syndicate Flexi Quaddie Calculator — ${quaddieBuyInPerUser} Buy-In Per User (${totalSyndicateQuaddiePool} Total Pool for {activeUsersCount} User{activeUsersCount === 1 ? "" : "s"})
              </span>
            </div>
            <p className="text-[11px] text-[#8A9990]">
              Defaults to a <strong className="text-[#D4AF37]">$50 buy-in per user</strong> (${totalSyndicateQuaddiePool} combined syndicate Quaddie pool across {punters.map((p) => p.name).join(" & ") || "all users"}). Merges all users&apos; selections in the last 4 races plus any{" "}
              <strong className="text-[#10B981]">
                Quaddie-Only Extra Horses
              </strong>{" "}
              you add below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {PRESET_QUADDIE_BUY_INS_PER_USER.map((amt) => {
                const isActive = Math.abs(quaddieBuyInPerUser - amt) < 0.01;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleUpdateBuyInPerUser(amt)}
                    className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors border cursor-pointer ${
                      isActive
                        ? "bg-[#10B981] text-[#0B110E] border-[#10B981]"
                        : "bg-[#121A16] text-[#D5DDD8] border-[#1F2D26] hover:border-[#10B981]"
                    }`}
                  >
                    ${amt}/user
                    {amt === 50 ? " (Default)" : ""}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 bg-[#121A16] border border-[#23352C] rounded-md px-2.5 py-1">
              <span className="text-xs font-mono text-[#8A9990]">
                Buy-In $/User:
              </span>
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
                    setLocalBuyInPerUser(num);
                    onChangeQuaddieBuyInPerUser?.(num);
                    try {
                      localStorage.setItem(
                        STORAGE_KEY_QUADDIE_BUY_IN_PER_USER,
                        String(num)
                      );
                    } catch {
                      // ignore
                    }
                  }
                }}
                onBlur={() => {
                  const num = Number(betInputText);
                  if (!Number.isFinite(num) || num <= 0) {
                    handleUpdateBuyInPerUser(DEFAULT_QUADDIE_BUY_IN_PER_USER);
                  } else {
                    handleUpdateBuyInPerUser(num);
                  }
                }}
                aria-label="Custom Quaddie Buy-In Per User in Dollars"
                className="w-20 bg-[#0B110E] border border-[#1F2D26] rounded px-2 py-1 text-xs font-mono font-bold text-[#10B981] focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quaddie Sections for Each Checked Race Card */}
      <div className="space-y-6">
        {quaddieEvaluationsByMeeting.map(
          ({ meeting: cardMeeting, extraMap: cardExtraMap, quaddieEval }) => {
            const legCountsText = quaddieEval.legs
              .map((l) => l.allLegRunners.length)
              .join(" × ");

            return (
              <div key={cardMeeting.id} className="space-y-4">
                {/* Card Header & 4-Card Quaddie KPI Strip */}
                <div className="bg-[#121A16] border border-[#1F2D26] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#192620] border border-[#10B981]/40 text-[#10B981] font-mono text-[10px] font-bold">
                        {cardMeeting.state || "TAB"}
                      </span>
                      <h3 className="text-sm font-bold text-[#F3F4F0]">
                        {cardMeeting.venue} Quaddie Pool ({cardMeeting.date})
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#8A9990]">
                      Legs:{" "}
                      {quaddieEval.legs
                        .map((l) => `R${l.raceNumber}`)
                        .join(" · ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: Quaddie Status & Leg Hits */}
                    <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
                        <span>Quaddie Leg Status</span>
                        <Target className="w-3.5 h-3.5 text-[#10B981]" />
                      </div>
                      <div className="flex items-baseline gap-2 font-mono tabular-nums">
                        <span className="text-2xl font-bold text-[#D4AF37]">
                          {quaddieEval.hitLegsCount} /{" "}
                          {quaddieEval.completedLegsCount || 4}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            quaddieEval.isQuaddieWon
                              ? "text-[#10B981]"
                              : quaddieEval.isQuaddieAlive
                              ? "text-[#D4AF37]"
                              : "text-[#EF4444]"
                          }`}
                        >
                          {quaddieEval.isQuaddieWon
                            ? "★ QUADDIE WON!"
                            : quaddieEval.isQuaddieAlive
                            ? "LIVE IN RUNNING"
                            : "OUT / LEG MISSED"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8A9990]">
                        Winning Numbers:{" "}
                        <span className="font-mono text-[#F3F4F0] font-semibold">
                          {quaddieEval.quaddieCombinationString}
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Combinations & Flexi % */}
                    <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
                        <span>Combinations &amp; Flexi %</span>
                        <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                      </div>
                      <div className="flex items-baseline gap-2 font-mono tabular-nums">
                        <span className="text-2xl font-bold text-[#F3F4F0]">
                          {quaddieEval.totalCombinations}
                        </span>
                        <span className="text-xs text-[#10B981] font-semibold">
                          ({quaddieEval.flexiPercentage}% Flexi)
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8A9990] font-mono">
                        Legs: {legCountsText} = {quaddieEval.totalCombinations}{" "}
                        combos
                      </div>
                    </div>

                    {/* Card 3: $1 Base Quaddie Dividend */}
                    <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#8A9990]">
                        <span>
                          {quaddieEval.isOfficialDividend
                            ? "Official $1 Quaddie Div"
                            : "Est. $1 Quaddie Div"}
                        </span>
                        <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      </div>
                      <div className="flex items-baseline gap-2 font-mono tabular-nums">
                        <span className="text-2xl font-bold text-[#D4AF37]">
                          {formatDollarReturn(
                            quaddieEval.officialOrEstimatedQuaddieDividend
                          )}
                        </span>
                        <span className="text-xs text-[#8A9990]">
                          per $1 unit
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8A9990]">
                        {quaddieEval.completedLegsCount}/4 legs resulted at{" "}
                        {cardMeeting.venue}
                      </div>
                    </div>

                    {/* Card 4: Flexi Quaddie Return on Stake */}
                    <div className="p-3.5 rounded-lg bg-[#0B110E] border border-[#10B981]/40 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase text-[#10B981]">
                        <span>
                          ${quaddieEval.buyInPerUser}/User (${quaddieEval.quaddieBetAmount} Pool) Payout
                        </span>
                        <Trophy className="w-3.5 h-3.5 text-[#10B981]" />
                      </div>
                      <div className="flex items-baseline gap-2 font-mono tabular-nums">
                        <span
                          className={`text-2xl font-bold ${
                            quaddieEval.isQuaddieWon
                              ? "text-[#10B981]"
                              : "text-[#F3F4F0]"
                          }`}
                        >
                          {formatDollarReturn(
                            quaddieEval.flexiPayoutOnBetAmount
                          )}
                        </span>
                        <span className="text-xs text-[#8A9990]">
                          {quaddieEval.isQuaddieWon
                            ? "COLLECTED!"
                            : `(${formatDollarReturn(quaddieEval.flexiPayoutPerUser)}/user)`}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8A9990]">
                        ${quaddieEval.buyInPerUser}/user × {quaddieEval.participatingUsersCount} user{quaddieEval.participatingUsersCount === 1 ? "" : "s"} (${quaddieEval.quaddieBetAmount} pool) · {quaddieEval.totalCombinations || 81} combos
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4-Leg Quaddie Selector Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {quaddieEval.legs.map((leg) => {
                    const drawerKey = `${cardMeeting.id}::${leg.raceNumber}`;
                    const isDrawerOpen = expandedLegKey === drawerKey;
                    const userTabSet = new Set(
                      leg.userSelectedRunners.map((r) => r.tabNumber)
                    );
                    const extraTabSet = new Set(
                      (cardExtraMap[leg.raceNumber] || []).map(Number)
                    );

                    return (
                      <div
                        key={leg.raceNumber}
                        className={`rounded-xl border bg-[#121A16] overflow-hidden flex flex-col justify-between transition-colors ${
                          leg.isRaceResulted
                            ? leg.isLegHit
                              ? "border-[#10B981]/70"
                              : "border-[#EF4444]/60"
                            : "border-[#1F2D26]"
                        }`}
                      >
                        {/* Leg Header */}
                        <div className="p-4 border-b border-[#1F2D26] bg-[#0E1612] flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#0B110E] font-mono text-[11px] font-bold uppercase">
                                {cardMeeting.venue} · Quaddie Leg {leg.legIndex}
                              </span>
                              <span className="font-mono text-sm font-bold text-[#F3F4F0]">
                                Race {leg.raceNumber}
                              </span>
                              <span className="text-xs text-[#8A9990] font-mono">
                                · {leg.race.startTime} · {leg.race.distance}m
                              </span>
                            </div>
                            <h3 className="mt-1 text-sm font-bold text-[#F3F4F0]">
                              {leg.race.raceName}
                            </h3>
                          </div>

                          {/* Leg Result Badge */}
                          <div className="flex items-center gap-2">
                            {leg.isRaceResulted ? (
                              leg.isLegHit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#152920] border border-[#10B981] text-[#10B981] font-mono text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  LEG HIT (#{leg.winner?.tabNumber}{" "}
                                  {leg.winner?.horseName})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#291414] border border-[#EF4444]/70 text-[#EF4444] font-mono text-xs font-bold">
                                  <XCircle className="w-3.5 h-3.5" />
                                  MISSED (Won: #{leg.winner?.tabNumber}{" "}
                                  {leg.winner?.horseName})
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#192620] border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                {leg.allLegRunners.length} Selected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Combined Group Selections + Quaddie-Only Extra Selections */}
                        <div className="p-4 space-y-3 flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono uppercase tracking-wider text-[11px] text-[#8A9990]">
                              Active Quaddie Runners in Leg {leg.legIndex} (
                              {leg.allLegRunners.length} Total:{" "}
                              {leg.userSelectedRunners.length} User Picks +{" "}
                              {leg.extraSelectedRunners.length} Quaddie Extras)
                            </span>
                            {leg.extraSelectedRunners.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onClearQuaddieExtrasForLeg(
                                    cardMeeting.id,
                                    leg.raceNumber
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#EF4444] hover:underline cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Clear Extras</span>
                              </button>
                            )}
                          </div>

                          {leg.allLegRunners.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[#2B3E34] bg-[#0B110E] p-3.5 text-xs text-[#8A9990] flex items-center justify-between gap-2">
                              <span>
                                No runners in Leg {leg.legIndex} yet. Enter user
                                picks or click{" "}
                                <strong className="text-[#10B981]">
                                  + Add Quaddie-Only Horses
                                </strong>{" "}
                                below.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {leg.allLegRunners.map((entry) => {
                                const isWinner =
                                  leg.isRaceResulted &&
                                  leg.winner?.tabNumber === entry.tabNumber;
                                const isOnlyExtra = entry.source === "extra";
                                const winOdds =
                                  Number(entry.runner?.nswTabWin) ||
                                  Number(entry.runner?.fixedWin) ||
                                  0;

                                return (
                                  <div
                                    key={entry.tabNumber}
                                    className={`rounded-lg border p-2.5 text-xs flex items-start justify-between gap-2 ${
                                      isWinner
                                        ? "bg-[#152920] border-[#10B981] text-[#F3F4F0]"
                                        : isOnlyExtra
                                        ? "bg-[#0D1E1A] border-[#10B981]/45 text-[#F3F4F0]"
                                        : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                                    }`}
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono font-bold text-[#D4AF37]">
                                          #{entry.tabNumber}
                                        </span>
                                        <span className="font-semibold truncate">
                                          {entry.runner?.horseName ||
                                            `Runner #${entry.tabNumber}`}
                                        </span>
                                        {winOdds > 0 && (
                                          <span className="font-mono text-[11px] text-[#10B981]">
                                            ${winOdds.toFixed(2)}
                                          </span>
                                        )}
                                        {isWinner && (
                                          <span className="px-1.5 py-0.5 rounded bg-[#10B981] text-[#0B110E] font-mono text-[10px] font-bold">
                                            1ST!
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1">
                                        {entry.pickedByUsers.map((u, idx) => {
                                          const punterObj = punters.find(
                                            (p) => p.id === u.punterId || p.name === u.punterName
                                          );
                                          const cupAlloc =
                                            punterObj?.cupAllocationsByMeeting?.[cardMeeting.id]?.[
                                              leg.raceNumber
                                            ];

                                          return (
                                            <span
                                              key={`${u.punterId}-${idx}`}
                                              className="px-1.5 py-0.5 rounded bg-[#192620] text-[#D4AF37] font-mono text-[10px]"
                                              title={
                                                isCupModeActive && cupAlloc
                                                  ? cupAlloc.wasFallback
                                                    ? `Allocated #${cupAlloc.tabNumber} (Preference #${cupAlloc.preferenceRankUsed} fallback because #${cupAlloc.originallyWantedTab} was taken by ${cupAlloc.originallyTakenBy || "another member"})`
                                                    : `Allocated #${cupAlloc.tabNumber} (1st Preference)`
                                                  : undefined
                                              }
                                            >
                                              {isCupModeActive ? (
                                                <span>
                                                  🏆 {u.punterName} (
                                                  {cupAlloc?.wasFallback
                                                    ? `Pref #${cupAlloc.preferenceRankUsed}`
                                                    : "Pref #1"}
                                                  )
                                                </span>
                                              ) : (
                                                <span>
                                                  {u.punterName} ({u.preferenceRank}
                                                  {u.preferenceRank === 1
                                                    ? "st"
                                                    : u.preferenceRank === 2
                                                    ? "nd"
                                                    : "rd"}
                                                  )
                                                </span>
                                              )}
                                            </span>
                                          );
                                        })}
                                        {entry.isQuaddieExtra && (
                                          <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono text-[10px] font-semibold">
                                            + Quaddie Extra
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {entry.isQuaddieExtra && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggleQuaddieExtraRunner(
                                            cardMeeting.id,
                                            leg.raceNumber,
                                            entry.tabNumber
                                          )
                                        }
                                        title="Remove Quaddie-only extra selection"
                                        className="p-1 rounded bg-[#121A16] text-[#8A9990] hover:text-[#EF4444] cursor-pointer shrink-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Expandable Quaddie-Only Horse Picker */}
                          <div className="pt-2 border-t border-[#1F2D26]">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLegKey(
                                  isDrawerOpen ? null : drawerKey
                                )
                              }
                              className={`w-full min-h-[36px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                isDrawerOpen
                                  ? "bg-[#152920] border-[#10B981] text-[#10B981]"
                                  : "bg-[#0B110E] border-[#23352C] text-[#D5DDD8] hover:border-[#10B981] hover:text-[#10B981]"
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <PlusCircle className="w-3.5 h-3.5 text-[#10B981]" />
                                <span>
                                  {isDrawerOpen
                                    ? `Hide Quaddie-Only Runner Selector (Race ${leg.raceNumber})`
                                    : `+ Add / Toggle Quaddie-Only Horses for Leg ${leg.legIndex} (Race ${leg.raceNumber})`}
                                </span>
                              </span>
                              <span className="font-mono text-[11px] text-[#8A9990]">
                                {leg.race.runners.length} Field Runners
                              </span>
                            </button>

                            {isDrawerOpen && (
                              <div className="mt-2.5 p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-2.5">
                                <div className="flex items-center justify-between gap-2 text-[11px] text-[#8A9990]">
                                  <span>
                                    Click any runner below to add/remove it as a{" "}
                                    <strong className="text-[#10B981]">
                                      Quaddie-Only Selection
                                    </strong>{" "}
                                    (not scored in points or Trifectas):
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                                  {leg.race.runners.map((runner) => {
                                    const inUserPicks = userTabSet.has(
                                      runner.tabNumber
                                    );
                                    const inExtraPicks = extraTabSet.has(
                                      runner.tabNumber
                                    );
                                    const odds =
                                      Number(runner.nswTabWin) ||
                                      Number(runner.fixedWin) ||
                                      0;

                                    return (
                                      <button
                                        key={runner.tabNumber}
                                        type="button"
                                        onClick={() =>
                                          onToggleQuaddieExtraRunner(
                                            cardMeeting.id,
                                            leg.raceNumber,
                                            runner.tabNumber
                                          )
                                        }
                                        className={`px-2.5 py-1.5 rounded border text-left text-xs flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                                          inExtraPicks
                                            ? "bg-[#152920] border-[#10B981] text-[#F3F4F0]"
                                            : inUserPicks
                                            ? "bg-[#19221C] border-[#D4AF37]/50 text-[#F3F4F0]"
                                            : "bg-[#121A16] border-[#1F2D26] text-[#9BA8A1] hover:border-[#10B981]/50 hover:text-[#F3F4F0]"
                                        }`}
                                      >
                                        <div className="truncate">
                                          <span className="font-mono font-bold text-[#D4AF37] mr-1">
                                            #{runner.tabNumber}
                                          </span>
                                          <span className="font-medium">
                                            {runner.horseName}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                                          {odds > 0 && (
                                            <span className="text-[#8A9990]">
                                              ${odds.toFixed(2)}
                                            </span>
                                          )}
                                          {inUserPicks && (
                                            <span className="px-1 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37]">
                                              User
                                            </span>
                                          )}
                                          {inExtraPicks && (
                                            <span className="px-1 py-0.5 rounded bg-[#10B981] text-[#0B110E] font-bold">
                                              +Extra
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};
