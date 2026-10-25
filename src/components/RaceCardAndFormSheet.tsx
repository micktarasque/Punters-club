import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  TrendingDown,
  TrendingUp,
  Zap,
  Clock,
  Radio,
  Flame,
  AlertCircle,
  Timer,
  Trophy,
  Sparkles,
  Lock,
  Undo2,
} from "lucide-react";
import {
  PunterProfile,
  RaceEvent,
  RaceMeeting,
  RaceSelectionTrio,
} from "../types/racing";
import { CupTournamentState } from "../types/cupMode";
import {
  getActiveDraftPunter,
  isHorseTakenInRace,
  getDraftOrderForRace,
} from "../utils/cupMode";
import { JockeySilkSvg } from "./JockeySilkSvg";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { generateRaceAutoPickTrio } from "../utils/autoPick";
import { TanStackVirtualRunnersTable } from "./TanStackVirtualRunnersTable";
import { HarvillePlackettLuceModel } from "./HarvillePlackettLuceModel";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";
import { RunnerAiAnalysisButton } from "./RunnerAiAnalysisButton";
import {
  RaceCardCountdownClock,
  computeMinutesAndSecondsToJump,
} from "./RaceCardCountdownClock";
import { RaceIntelligenceBrief } from "./RaceIntelligenceBrief";
import { RaceSpeedMapVisualizer } from "./RaceSpeedMapVisualizer";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab";

interface RaceCardAndFormSheetProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters?: PunterProfile[];
  selectedRaceNumber: number;
  onSelectRaceNumber: (num: number) => void;
  activePunterName: string;
  currentMeetingSelections: Record<number, RaceSelectionTrio>;
  onAssignPreference: (
    meetingId: string,
    raceNumber: number,
    preferenceRank: 1 | 2 | 3,
    tabNumber: number
  ) => void;
  onJumpToSelections?: (meetingId: string, raceNumber: number) => void;
  cupTournament?: CupTournamentState;
  onAssignCupPick?: (raceNumber: number, punterName: string, tabNumber: number) => void;
  onRemoveCupPick?: (raceNumber: number, punterName: string) => void;
  onOpenCupView?: () => void;
  isApple?: boolean;
  isObsidian?: boolean;
}

type SortField =
  | "finishPosition"
  | "tabNumber"
  | "nswTabWin"
  | "weight"
  | "speedRating";

export const RaceCardAndFormSheet: React.FC<RaceCardAndFormSheetProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  selectedMeetingIds = [],
  onChangeSelectedMeetingIds,
  punters = [],
  selectedRaceNumber,
  onSelectRaceNumber,
  activePunterName,
  currentMeetingSelections,
  onAssignPreference,
  onJumpToSelections,
  cupTournament,
  onAssignCupPick,
  onRemoveCupPick,
  onOpenCupView,
  isApple = false,
  isObsidian = false,
}) => {
  const [runnerSearch, setRunnerSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("finishPosition");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRunners, setExpandedRunners] = useState<
    Record<number, boolean>
  >({});
  const [expandAllForm, setExpandAllForm] = useState(false);
  const [useTanStackVirtualView, setUseTanStackVirtualView] = useState(false);
  const [showHarvilleModel, setShowHarvilleModel] = useState(true);
  const [inspectionMode, setInspectionMode] = useState<"stepper" | "all">("stepper");
  const [stepperStep, setStepperStep] = useState<1 | 2 | 3>(1);

  const effectiveSelectedIds = useMemo(() => {
    const valid = selectedMeetingIds.filter((id) =>
      meetings.some((m) => m.id === id)
    );
    if (valid.length > 0) return valid;
    return [selectedMeetingId || meetings[0]?.id].filter(Boolean);
  }, [meetings, selectedMeetingIds, selectedMeetingId]);

  const checkedMeetings = useMemo(
    () => meetings.filter((m) => effectiveSelectedIds.includes(m.id)),
    [meetings, effectiveSelectedIds]
  );

  const activeMeeting = useMemo(() => {
    return (
      meetings.find((m) => m.id === selectedMeetingId) ||
      checkedMeetings[0] ||
      meetings[0] ||
      null
    );
  }, [meetings, selectedMeetingId, checkedMeetings]);

  const activeRace = useMemo(() => {
    if (!activeMeeting) return null;
    return (
      activeMeeting.races.find((r) => r.raceNumber === selectedRaceNumber) ||
      activeMeeting.races[0] ||
      null
    );
  }, [activeMeeting, selectedRaceNumber]);

  const activeRaceTrio: RaceSelectionTrio = useMemo(() => {
    if (!activeRace) {
      return { firstPref: null, secondPref: null, thirdPref: null };
    }
    return (
      currentMeetingSelections[activeRace.raceNumber] || {
        firstPref: null,
        secondPref: null,
        thirdPref: null,
      }
    );
  }, [currentMeetingSelections, activeRace]);

  // Cup Mode active drafter & race draft status
  const isCupActive = Boolean(cupTournament?.isActive);
  const activeCupDrafter = useMemo(() => {
    if (!cupTournament?.isActive || !activeRace) return null;
    return getActiveDraftPunter(cupTournament, activeRace.raceNumber);
  }, [cupTournament, activeRace]);

  const activeRaceCupPicks = useMemo(() => {
    if (!cupTournament || !activeRace) return {};
    return cupTournament.selectionsByRace[activeRace.raceNumber] || {};
  }, [cupTournament, activeRace]);

  const activeRaceDraftOrder = useMemo(() => {
    if (!cupTournament || !activeRace) return [];
    return getDraftOrderForRace(
      activeRace.raceNumber,
      cupTournament.participants,
      cupTournament.draftType
    );
  }, [cupTournament, activeRace]);

  // Live 1-second interval ticker for dynamic "Time to Start" calculations
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine if active race has completed / official results
  const isCurrentRaceOfficial = useMemo(() => {
    if (!activeRace || !activeMeeting) return false;
    return isRaceOfficialOrCompleted(activeRace, activeMeeting.date);
  }, [activeRace, activeMeeting]);

  // Dynamic countdown to jump time fetched from current meeting's race objects
  const jumpCountdown = useMemo(() => {
    if (!activeRace || !activeMeeting || isCurrentRaceOfficial) return null;
    return computeMinutesAndSecondsToJump(
      activeMeeting.date,
      activeRace.startTime,
      nowMs
    );
  }, [activeMeeting, activeRace, nowMs, isCurrentRaceOfficial]);

  const timeToStartInfo = useMemo(() => {
    if (!jumpCountdown || !activeRace) return null;
    const { totalSeconds } = jumpCountdown;
    const isRacing = totalSeconds <= 0 && totalSeconds > -600;
    const isOverdue = totalSeconds <= -600;
    const isImminent = totalSeconds > 0 && totalSeconds <= 120;
    const isUrgent = totalSeconds > 120 && totalSeconds <= 600;
    const absSec = Math.abs(totalSeconds);
    const hrs = Math.floor(absSec / 3600);
    const mins = Math.floor((absSec % 3600) / 60);
    const secs = absSec % 60;

    let formattedDisplay = "";
    if (isRacing) {
      formattedDisplay = "GATES OPEN · RACING NOW";
    } else if (isOverdue) {
      formattedDisplay = "Awaiting Official Result";
    } else if (hrs > 0) {
      formattedDisplay = `${hrs}h ${mins}m ${String(secs).padStart(2, "0")}s`;
    } else {
      formattedDisplay = `${mins}m ${String(secs).padStart(2, "0")}s`;
    }

    return {
      formattedDisplay,
      isRacing,
      isOverdue,
      isImminent,
      isUrgent,
      totalSeconds,
      scheduledTime: activeRace.startTime,
    };
  }, [jumpCountdown, activeRace]);

  // Compute career closing speed percentiles across the active field
  const runnerClosingSpeedPercentiles = useMemo(() => {
    if (!activeRace)
      return new Map<number, { percentile: number; label: string; speedKmh: number }>();
    const map = new Map<number, { percentile: number; label: string; speedKmh: number }>();
    const validRunners = activeRace.runners.map((r) => {
      const speedKmh =
        r.careerClosingSpeed ||
        Number((54 + ((r.speedRating || 80) - 70) * 0.35).toFixed(1));
      return { tabNumber: r.tabNumber, speedKmh };
    });

    validRunners.sort((a, b) => a.speedKmh - b.speedKmh);
    const count = validRunners.length;

    validRunners.forEach((item, index) => {
      const percentile = count > 1 ? Math.round(((index + 1) / count) * 100) : 100;
      let label = `${percentile}th %ile`;
      if (percentile >= 90) label = "Top 10% Burst";
      else if (percentile >= 75) label = "Top 25% Finisher";
      else if (percentile <= 25) label = "Bottom 25%";
      map.set(item.tabNumber, { percentile, label, speedKmh: item.speedKmh });
    });

    return map;
  }, [activeRace]);

  // Compute live market movers & betting fluctuation status for each runner
  const runnerMarketMoverMap = useMemo(() => {
    if (!activeRace)
      return new Map<
        number,
        {
          status: "firming" | "drifting" | "solid";
          pctChange: number;
          openOdds: number;
          curOdds: number;
          label: string;
        }
      >();
    const map = new Map<
      number,
      {
        status: "firming" | "drifting" | "solid";
        pctChange: number;
        openOdds: number;
        curOdds: number;
        label: string;
      }
    >();

    activeRace.runners.forEach((r) => {
      const curOdds = Number(r.nswTabWin) || Number(r.fixedWin) || 10;
      const openOdds =
        Number(r.openingOdds) ||
        (r.flucs && r.flucs[0] ? parseFloat(r.flucs[0].replace(/[^0-9.]/g, "")) : null) ||
        curOdds;
      const pctChange =
        openOdds > 0 ? Number((((curOdds - openOdds) / openOdds) * 100).toFixed(1)) : 0;

      let status: "firming" | "drifting" | "solid" = "solid";
      let label = "SOLID ⚖️";

      if (r.marketSupport === "Firming" || pctChange <= -10 || r.oddsTrend === "shortening") {
        status = "firming";
        label = `FIRMING 🔥 (${pctChange < 0 ? `${pctChange}%` : "-15%"})`;
      } else if (r.marketSupport === "Drifting" || pctChange >= 12 || r.oddsTrend === "drifting") {
        status = "drifting";
        label = `DRIFTING ❄️ (+${pctChange}%)`;
      }

      map.set(r.tabNumber, { status, pctChange, openOdds, curOdds, label });
    });

    return map;
  }, [activeRace]);

  const sortedRunners = useMemo(() => {
    if (!activeRace) return [];
    const q = runnerSearch.trim().toLowerCase();
    const filtered = activeRace.runners.filter((r) => {
      if (!q) return true;
      return (
        r.horseName.toLowerCase().includes(q) ||
        r.jockey.toLowerCase().includes(q) ||
        r.trainer.toLowerCase().includes(q) ||
        String(r.tabNumber) === q
      );
    });

    return [...filtered].sort((a, b) => {
      let valA: number;
      let valB: number;
      if (sortField === "finishPosition") {
        valA = a.finishPosition > 0 ? a.finishPosition : 999 + a.tabNumber;
        valB = b.finishPosition > 0 ? b.finishPosition : 999 + b.tabNumber;
      } else if (sortField === "speedRating") {
        valA = a.speedRating || 80;
        valB = b.speedRating || 80;
      } else {
        valA = a[sortField] || 0;
        valB = b[sortField] || 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [activeRace, runnerSearch, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field !== "speedRating");
    }
  };

  const [jurisdictionFilter, setJurisdictionFilter] = useState<
    "ALL" | "METRO" | "NSW" | "VIC" | "QLD" | "SA"
  >("ALL");

  // Only show states that actually have a track racing on the selected date
  const activeStatesOnDay = useMemo(() => {
    const set = new Set<string>();
    for (const m of meetings) {
      if (m.state) set.add(m.state);
    }
    return set;
  }, [meetings]);

  // Filter and sort meetings so Main Metro sites (Flemington, Randwick, etc.) are always at the top
  const filteredMeetings = useMemo(() => {
    const list = meetings.filter((m) => {
      if (jurisdictionFilter === "ALL") return true;
      if (jurisdictionFilter === "METRO") {
        return m.tier === "Metro" || !m.tier;
      }
      return m.state === jurisdictionFilter;
    });
    return list.length > 0 ? list : meetings;
  }, [meetings, jurisdictionFilter]);

  const toggleRunnerForm = (tabNo: number) => {
    setExpandedRunners((prev) => ({
      ...prev,
      [tabNo]: !prev[tabNo],
    }));
  };

  const handleToggleMeetingCheckbox = (id: string) => {
    if (effectiveSelectedIds.includes(id)) {
      if (effectiveSelectedIds.length > 1) {
        const nextIds = effectiveSelectedIds.filter((item) => item !== id);
        onChangeSelectedMeetingIds?.(nextIds);
        if (activeMeeting?.id === id && nextIds[0]) {
          onSelectMeeting(nextIds[0]);
        }
      } else {
        onSelectMeeting(id);
      }
    } else {
      const nextIds = [...effectiveSelectedIds, id];
      onChangeSelectedMeetingIds?.(nextIds);
      onSelectMeeting(id);
    }
  };

  const handleAutoPickActiveRace = () => {
    if (!activeMeeting || !activeRace) return;
    const result = generateRaceAutoPickTrio(
      activeRace.runners,
      activeRace.raceNumber
    );
    if (result.firstPref) {
      onAssignPreference(
        activeMeeting.id,
        activeRace.raceNumber,
        1,
        result.firstPref
      );
    }
    if (result.secondPref) {
      onAssignPreference(
        activeMeeting.id,
        activeRace.raceNumber,
        2,
        result.secondPref
      );
    }
    if (result.thirdPref) {
      onAssignPreference(
        activeMeeting.id,
        activeRace.raceNumber,
        3,
        result.thirdPref
      );
    }
  };

  if (!activeMeeting || !activeRace) {
    return (
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg p-8 text-center">
        <p className="text-sm text-[#F3F4F0] font-semibold mb-1">
          No TAB Race Meetings Loaded for Selected Date
        </p>
        <p className="text-xs text-[#8A9990]">
          Click &ldquo;Sync Races&rdquo; above or choose another race date to load official TAB racecards and live form guides.
        </p>
      </div>
    );
  }

  const mainMetroMeetings = filteredMeetings.filter(
    (m) => m.tier === "Metro" || !m.tier
  );
  const regionalMeetings = filteredMeetings.filter(
    (m) => m.tier && m.tier !== "Metro"
  );

  return (
    <div id="section-full-racecard" className="space-y-4 scroll-mt-24">
      {/* Venue & Race Switcher Strip */}
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg p-4 space-y-3.5">
        {/* Top Filter Row: Multi-Select Checkbox Dropdown + Jurisdiction Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-[#1F2D26]">
          <div className="flex items-center gap-2 flex-wrap">
            <RaceCardMultiSelectDropdown
              meetings={meetings}
              selectedMeetingIds={effectiveSelectedIds}
              onChangeSelectedMeetingIds={(ids) => {
                onChangeSelectedMeetingIds?.(ids);
                if (ids.length > 0 && !ids.includes(activeMeeting.id)) {
                  onSelectMeeting(ids[0]);
                }
              }}
              punters={punters}
              labelPrefix="Form Guide Race Cards"
              compact
            />

            <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold ml-1">
              Filter:
            </span>
            {(
              [
                { id: "ALL", label: `All (${meetings.length})` },
                { id: "METRO", label: "Main Metro" },
                ...(activeStatesOnDay.has("VIC")
                  ? [{ id: "VIC", label: "VIC" }]
                  : []),
                ...(activeStatesOnDay.has("NSW")
                  ? [{ id: "NSW", label: "NSW" }]
                  : []),
                ...(activeStatesOnDay.has("QLD")
                  ? [{ id: "QLD", label: "QLD" }]
                  : []),
                ...(activeStatesOnDay.has("SA")
                  ? [{ id: "SA", label: "SA" }]
                  : []),
              ] as Array<{
                id: "ALL" | "METRO" | "NSW" | "VIC" | "QLD" | "SA";
                label: string;
              }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJurisdictionFilter(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
                  jurisdictionFilter === tab.id
                    ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                    : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Unboxed Metadata Discipline */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A9990]">
            <span className="text-[#F3F4F0] font-medium">
              {activeMeeting.venue} ({activeMeeting.state || "TAB"} ·{" "}
              {activeMeeting.meetingCode})
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#10B981] font-medium">
              Track: {activeMeeting.trackCondition}
            </span>
            <span aria-hidden="true">·</span>
            <span>Rail: {activeMeeting.railPosition}</span>
            <span aria-hidden="true">·</span>
            <span>{activeMeeting.weather}</span>
          </div>
        </div>

        {/* Main Metro Venues Row with Checkbox Indicators */}
        <div className="space-y-2 pb-3 border-b border-[#1F2D26]">
          {mainMetroMeetings.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                Main Metropolitan Venues (Sydney · Melbourne · Brisbane · Adelaide) — Click Checkbox to Multi-Select or Venue Name to Inspect
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {mainMetroMeetings.map((m) => {
                  const isActiveInspect = m.id === activeMeeting.id;
                  const isChecked = effectiveSelectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`min-h-[38px] sm:min-h-[34px] rounded-md transition-colors flex items-center border overflow-hidden ${
                        isActiveInspect
                          ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-semibold shadow-sm"
                          : isChecked
                          ? "bg-[#152920] text-[#F3F4F0] border-[#10B981]"
                          : "bg-[#0B110E] text-[#F3F4F0] hover:border-[#D4AF37] border-[#1F2D26]"
                      }`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => handleToggleMeetingCheckbox(m.id)}
                        title={`Toggle ${m.venue} in multi-card selection`}
                        className="px-2 py-1.5 flex items-center justify-center border-r border-current/15 cursor-pointer"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? isActiveInspect
                                ? "bg-[#0B110E] border-[#0B110E] text-[#D4AF37]"
                                : "bg-[#10B981] border-[#10B981] text-[#0B110E]"
                              : "bg-[#0B110E] border-[#52665B]"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isChecked) {
                            onChangeSelectedMeetingIds?.([
                              ...effectiveSelectedIds,
                              m.id,
                            ]);
                          }
                          onSelectMeeting(m.id);
                          if (m.races[0]) {
                            onSelectRaceNumber(m.races[0].raceNumber);
                          }
                        }}
                        className="px-3 py-1.5 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            isActiveInspect
                              ? "bg-[#0B110E]/20 text-[#0B110E]"
                              : "bg-[#192620] text-[#D4AF37]"
                          }`}
                        >
                          {m.state || "METRO"}
                        </span>
                        <span>{m.venue}</span>
                        <span className="opacity-70 font-mono text-[11px]">
                          ({m.races.length}R)
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {regionalMeetings.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#8A9990]">
                Provincial & Country TAB Venues Racing Today
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {regionalMeetings.map((m) => {
                  const isActiveInspect = m.id === activeMeeting.id;
                  const isChecked = effectiveSelectedIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`min-h-[36px] sm:min-h-[32px] rounded-md transition-colors flex items-center border overflow-hidden ${
                        isActiveInspect
                          ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-semibold"
                          : isChecked
                          ? "bg-[#152920] text-[#F3F4F0] border-[#10B981]"
                          : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border-[#1F2D26]"
                      }`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onClick={() => handleToggleMeetingCheckbox(m.id)}
                        className="px-2 py-1 flex items-center justify-center border-r border-current/15 cursor-pointer"
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked
                              ? isActiveInspect
                                ? "bg-[#0B110E] border-[#0B110E] text-[#D4AF37]"
                                : "bg-[#10B981] border-[#10B981] text-[#0B110E]"
                              : "bg-[#0B110E] border-[#52665B]"
                          }`}
                        >
                          {isChecked && (
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isChecked) {
                            onChangeSelectedMeetingIds?.([
                              ...effectiveSelectedIds,
                              m.id,
                            ]);
                          }
                          onSelectMeeting(m.id);
                          if (m.races[0]) {
                            onSelectRaceNumber(m.races[0].raceNumber);
                          }
                        }}
                        className="px-2.5 py-1 text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <span
                          className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                            isActiveInspect
                              ? "bg-[#0B110E]/20 text-[#0B110E] font-bold"
                              : "bg-[#121A16] text-[#8A9990]"
                          }`}
                        >
                          {m.state || "TAB"}
                        </span>
                        <span>{m.venue}</span>
                        <span className="opacity-60 font-mono text-[11px]">
                          ({m.races.length}R)
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Multi-Card Race Selector Strips (Shows a Race Row for Every Checked Race Card) */}
        <div className="space-y-2.5">
          {(checkedMeetings.length > 0 ? checkedMeetings : [activeMeeting]).map(
            (cardMtg) => {
              const isCurrentCard = cardMtg.id === activeMeeting.id;
              return (
                <div
                  key={cardMtg.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 p-2 rounded-lg bg-[#0B110E]/60 border border-[#1F2D26]"
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                        isCurrentCard
                          ? "bg-[#D4AF37] text-[#0B110E]"
                          : "bg-[#152920] text-[#10B981]"
                      }`}
                    >
                      {cardMtg.venue} ({cardMtg.state})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
                    {cardMtg.races.map((r) => {
                      const isSelected =
                        isCurrentCard && r.raceNumber === activeRace.raceNumber;
                      const winner = r.runners.find(
                        (rn) => rn.finishPosition === 1
                      );
                      return (
                        <button
                          key={r.raceNumber}
                          type="button"
                          onClick={() => {
                            onSelectMeeting(cardMtg.id);
                            onSelectRaceNumber(r.raceNumber);
                          }}
                          className={`min-h-[42px] flex flex-col items-start px-3 py-1.5 rounded-md border text-left transition-colors shrink-0 cursor-pointer ${
                            isSelected
                              ? "bg-[#192620] border-[#D4AF37] text-[#F3F4F0]"
                              : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                          }`}
                        >
                          <div className="flex items-center gap-2 w-full justify-between">
                            <span className="font-mono text-xs font-semibold text-[#F3F4F0]">
                              R{r.raceNumber}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums">
                              {r.distance}m
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                            <span className="text-[10px] font-mono tabular-nums text-[#8A9990]">
                              {winner
                                ? `1st #${winner.tabNumber} ($${winner.nswTabWin.toFixed(
                                    2
                                  )})`
                                : r.startTime}
                            </span>
                            {!winner && (
                              <RaceCardCountdownClock
                                meeting={cardMtg}
                                race={r}
                                compact
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}

          {/* Active Race Header Info */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A9990] pt-1">
            <span className="text-sm font-semibold text-[#F3F4F0]">
              Race {activeRace.raceNumber}: {activeRace.raceName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activeRace.distance}m
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeRace.classGrade}</span>
            {activeRace.pattern && (
              <>
                <span aria-hidden="true">·</span>
                <span className="px-1.5 py-0.5 rounded bg-[#192620] text-[#10B981] font-mono text-[11px] font-semibold">
                  {activeRace.pattern}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#D4AF37]">
              {activeRace.prizeMoney}
            </span>
            {activeRace.winBook && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-[#8A9990]">
                  Win Book: {activeRace.winBook.toFixed(1)}%
                </span>
              </>
            )}
            {activeRace.winningTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Time {activeRace.winningTime} (L600m{" "}
                  {activeRace.last600m || "-"})
                </span>
              </>
            )}
            {timeToStartInfo && !isCurrentRaceOfficial && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                    timeToStartInfo.isRacing
                      ? "bg-[#EF4444]/20 text-[#EF4444] animate-pulse"
                      : timeToStartInfo.isImminent
                      ? "bg-[#FF3B30]/20 text-[#FF3B30] animate-bounce"
                      : isApple
                      ? "bg-[#0071E3]/10 text-[#0071E3]"
                      : "bg-[#10241A] text-[#10B981]"
                  }`}
                >
                  {timeToStartInfo.isRacing ? (
                    <Radio className="w-3 h-3 text-[#EF4444]" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  <span>
                    Time to Start: {timeToStartInfo.formattedDisplay}
                  </span>
                </span>
              </>
            )}

            {onJumpToSelections && (
              <button
                type="button"
                onClick={() => onJumpToSelections(activeMeeting.id, activeRace.raceNumber)}
                className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer border shadow-xs ${
                  isApple
                    ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3] hover:bg-[#0071E3]/20"
                    : "bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25"
                }`}
                title={`Jump directly to Selections for ${activeMeeting.venue} Race ${activeRace.raceNumber}`}
              >
                <span>🎯 Jump to Selections (R{activeRace.raceNumber}) →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Countdown Clock to Jump Time for the Next Active Race */}
      <RaceCardCountdownClock
        meeting={activeMeeting}
        race={activeRace}
        allMeetings={meetings}
        onSelectRaceNumber={onSelectRaceNumber}
        onSelectMeeting={onSelectMeeting}
        isApple={isApple}
        isObsidian={isObsidian}
      />

      {/* Cup Mode Live Race Draft Header Banner */}
      {isCupActive && activeRace && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
            isApple
              ? "bg-[#FFF9EB] border-[#D4AF37]/50 text-[#1D1D1F] shadow-sm"
              : isObsidian
              ? "bg-[#161D2B] border-[#D4AF37]/40 text-[#F1F5F9]"
              : "bg-[#181D14] border-[#D4AF37]/50 text-[#F3F4F0] shadow-[0_0_20px_rgba(212,175,55,0.12)]"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center text-lg shrink-0">
                🏆
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm sm:text-base font-mono">
                    Cup Mode Draft: Race {activeRace.raceNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4AF37] text-[#070B09] uppercase">
                    {activeCupDrafter ? `Now Drafting: ${activeCupDrafter}` : "All Picks Complete"}
                  </span>
                </div>
                <div className="text-xs opacity-75 mt-0.5">
                  Single horse per participant · Discretely locked · Snake order:{" "}
                  {activeRaceDraftOrder.map((p, idx) => (
                    <span key={p} className={activeRaceCupPicks[p] ? "opacity-50" : "text-[#D4AF37] font-bold"}>
                      {idx > 0 && " → "}
                      {p.split(" ")[0]}
                      {activeRaceCupPicks[p] && ` (#${activeRaceCupPicks[p]})`}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {onOpenCupView && (
              <button
                type="button"
                onClick={onOpenCupView}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ${
                  isApple
                    ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                    : "bg-[#D4AF37] text-[#070B09] hover:bg-[#c49f2e]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>View Cup Leaderboard →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progressive Race Stepper & Inspection Mode Control */}
      <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
          : isObsidian
          ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9]"
          : "bg-[#0E1612] border-[#1F2D26] text-[#F3F4F0]"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono uppercase font-bold tracking-wider ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}>
              Inspection Flow:
            </span>
            <div className={`flex items-center p-0.5 rounded-xl border text-xs font-mono ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
            }`}>
              <button
                type="button"
                onClick={() => setInspectionMode("stepper")}
                className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold flex items-center gap-1.5 ${
                  inspectionMode === "stepper"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isObsidian
                      ? "bg-[#38BDF8] text-[#09101D] font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>⚡️ Progressive Stepper</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectionMode("all")}
                className={`px-3 py-1 rounded-lg transition cursor-pointer font-bold flex items-center gap-1.5 ${
                  inspectionMode === "all"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isObsidian
                      ? "bg-[#38BDF8] text-[#09101D] font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>📑 Full Sheet</span>
              </button>
            </div>
          </div>

          {/* Right: Step Indicators (when in Stepper mode) */}
          {inspectionMode === "stepper" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
              {[
                { step: 1, label: "1. Speed Map & Pace", icon: "🏇" },
                { step: 2, label: "2. Key Form & Flucs", icon: "📊" },
                { step: 3, label: "3. Consensus & Picks", icon: "🎯" },
              ].map((s) => {
                const isActive = stepperStep === s.step;
                const isComplete =
                  (s.step === 3 && activeRaceTrio.firstPref !== null) ||
                  (s.step < stepperStep);
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setStepperStep(s.step as 1 | 2 | 3)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                      isActive
                        ? isApple
                          ? "bg-[#0071E3]/10 border-[#0071E3] text-[#0071E3] font-bold"
                          : isObsidian
                          ? "bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8] font-bold"
                          : "bg-[#10B981]/20 border-[#10B981] text-[#10B981] font-bold"
                        : isApple
                        ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
                        : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                    {isComplete && <span className="text-[#34C759] text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          STEP 1: SPEED MAP & PACE ANALYSIS
          ========================================================================= */}
      {(inspectionMode === "all" || stepperStep === 1) && (
        <div className="space-y-4 animate-fadeIn">
          {/* Short Overview of Speed Map, Probability and Predictions under Race Header */}
          <RaceIntelligenceBrief
            race={activeRace}
            meetingVenue={activeMeeting.venue}
            trackCondition={activeMeeting.trackCondition}
            railPosition={activeMeeting.railPosition}
            isApple={isApple}
            isObsidian={isObsidian}
            onAssignPreference={(rank, tabNo) =>
              onAssignPreference(activeMeeting.id, activeRace.raceNumber, rank, tabNo)
            }
          />

          {/* Comprehensive Speed Map Visualization based on Career Average Closing Speeds */}
          <RaceSpeedMapVisualizer
            race={activeRace}
            allRacesInMeeting={activeMeeting.races}
            selectedRaceNumber={activeRace.raceNumber}
            onSelectRaceNumber={onSelectRaceNumber}
            trackCondition={activeMeeting.trackCondition}
            railPosition={activeMeeting.railPosition}
            meetingVenue={activeMeeting.venue}
            activeRaceTrio={activeRaceTrio}
            onAssignPreference={(rank, tabNo) =>
              onAssignPreference(activeMeeting.id, activeRace.raceNumber, rank, tabNo)
            }
            isApple={isApple}
            isObsidian={isObsidian}
          />

          {inspectionMode === "stepper" && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0E1612] border-[#1F2D26]"
            }`}>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#10B981]">Step 1 / 3 Complete:</span>
                <span className="opacity-75 hidden sm:inline">Pace mapped by closing speed ratings</span>
              </div>
              <button
                type="button"
                onClick={() => setStepperStep(2)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                  isApple
                    ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                    : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                }`}
              >
                <span>Step 2: Key Form & Market Flucs →</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          STEP 2: KEY FORM, CLOSING SPEED & MARKET MOVERS
          ========================================================================= */}
      {(inspectionMode === "all" || stepperStep === 2) && (
        <div className="space-y-4 animate-fadeIn">
          {/* Race Overview Market Probability Model & Runner Win Likelihood */}
          {showHarvilleModel && (
            <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg overflow-hidden">
              <HarvillePlackettLuceModel
                race={activeRace}
                defaultTrio={activeRaceTrio}
              />
            </div>
          )}

          {/* Main High-Density NSW TAB Results, Live Betting Odds & Form Guide Sheet */}
          <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg overflow-hidden">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#1F2D26]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A9990] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={runnerSearch}
                onChange={(e) => setRunnerSearch(e.target.value)}
                placeholder="Filter horse, jockey, trainer, #..."
                className="bg-[#0B110E] border border-[#1F2D26] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#F3F4F0] placeholder-[#8A9990] focus:outline-none focus:border-[#D4AF37] w-56 sm:w-64"
              />
            </div>
            <span className="text-xs text-[#8A9990] font-mono tabular-nums">
              {sortedRunners.length} Runners
            </span>

            {/* Dynamic 'Time to Start' Countdown for Upcoming, Non-Completed Races */}
            {timeToStartInfo && !isCurrentRaceOfficial && (
              <div
                aria-live="polite"
                title={`Jump scheduled for ${activeRace?.startTime || ""} AEDT`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all shadow-xs ${
                  timeToStartInfo.isRacing
                    ? "bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444] animate-pulse font-bold"
                    : timeToStartInfo.isImminent
                    ? isApple
                      ? "bg-[#FFF2F0] border-[#FF3B30]/40 text-[#FF3B30] font-bold ring-1 ring-[#FF3B30]/20"
                      : "bg-[#2A0F0D] border-[#EF4444]/50 text-[#EF4444] font-bold ring-1 ring-[#EF4444]/25"
                    : timeToStartInfo.isUrgent
                    ? isApple
                      ? "bg-[#FFF9EB] border-[#FF9500]/40 text-[#B25E00] font-semibold"
                      : "bg-[#261A08] border-[#F59E0B]/40 text-[#FBBF24] font-semibold"
                    : isApple
                    ? "bg-[#F2F7FF] border-[#0071E3]/25 text-[#0071E3]"
                    : "bg-[#10241A] border-[#10B981]/30 text-[#10B981]"
                }`}
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  {timeToStartInfo.isRacing ? (
                    <Radio className="w-3.5 h-3.5 text-[#EF4444] animate-pulse" />
                  ) : timeToStartInfo.isImminent ? (
                    <Flame className="w-3.5 h-3.5 text-[#FF3B30] animate-bounce" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[11px] font-sans font-semibold tracking-wide uppercase">
                    {timeToStartInfo.isRacing ? "Racing Now" : "Time to Start"}
                  </span>
                </div>
                <span className="font-bold tabular-nums text-xs">
                  {timeToStartInfo.formattedDisplay}
                </span>
                <span className="text-[10px] text-current/70 hidden lg:inline">
                  (Starts {timeToStartInfo.scheduledTime})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoPickActiveRace}
              className="min-h-[40px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-[#16271E] border border-[#10B981]/50 text-[#10B981] hover:bg-[#1C3327] hover:border-[#10B981] transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              title="Randomly select at least one of the top three favourites, and then randomly pick the other two"
            >
              <span>🎲 Auto Pick R{activeRace.raceNumber}</span>
              <span className="hidden sm:inline text-[10px] text-[#8A9990] font-normal">
                (1 Fav + 2 Random)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setUseTanStackVirtualView((prev) => !prev)}
              className={`min-h-[40px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                useTanStackVirtualView
                  ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="Toggle TanStack Table & Virtual 60fps windowing mode"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{useTanStackVirtualView ? "⚡ TanStack Virtual ON" : "Standard View"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHarvilleModel((prev) => !prev)}
              className={`min-h-[40px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                showHarvilleModel
                  ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
              title="Toggle Harville Plackett-Luce Market Probability Model & Win Likelihood"
            >
              <span>📊 Probability Model</span>
            </button>

            <button
              type="button"
              onClick={() => setExpandAllForm((prev) => !prev)}
              className="min-h-[40px] sm:min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#0B110E] border border-[#1F2D26] text-[#F3F4F0] hover:border-[#D4AF37] transition-colors whitespace-nowrap cursor-pointer"
            >
              {expandAllForm ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Collapse All Form Guides</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Expand All Form Guides</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic 'Time to Start' Full-Width Sub-Strip for the Field */}
        {timeToStartInfo && !isCurrentRaceOfficial && (
          <div
            className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
              timeToStartInfo.isRacing
                ? "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"
                : timeToStartInfo.isImminent
                ? isApple
                  ? "bg-[#FFF5F4] border-[#FF3B30]/20 text-[#FF3B30]"
                  : "bg-[#250E0C] border-[#EF4444]/30 text-[#EF4444]"
                : timeToStartInfo.isUrgent
                ? isApple
                  ? "bg-[#FFFBF0] border-[#FF9500]/20 text-[#B25E00]"
                  : "bg-[#1E1609] border-[#F59E0B]/20 text-[#FBBF24]"
                : isApple
                ? "bg-[#F8F9FA] border-[#E5E5EA] text-[#48484A]"
                : "bg-[#0E1512] border-[#1F2D26] text-[#8A9990]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    timeToStartInfo.isRacing
                      ? "bg-red-500"
                      : timeToStartInfo.isImminent
                      ? "bg-orange-500"
                      : "bg-emerald-500"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    timeToStartInfo.isRacing
                      ? "bg-red-600"
                      : timeToStartInfo.isImminent
                      ? "bg-orange-600"
                      : "bg-emerald-600"
                  }`}
                />
              </span>
              <span className="font-semibold text-current">
                Race {activeRace?.raceNumber} ({activeMeeting?.venue}) · Jump Scheduled at{" "}
                <strong className="font-mono text-current font-bold">
                  {timeToStartInfo.scheduledTime}
                </strong>
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="font-mono tabular-nums">
                Fixed Odds Live &amp; Accepting Wagers
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span className="text-[11px] uppercase tracking-wider font-sans font-medium text-current/70">
                Time to Start:
              </span>
              <span
                className={`font-bold text-sm ${
                  timeToStartInfo.isImminent
                    ? "text-[#FF3B30] dark:text-[#EF4444] animate-pulse"
                    : "text-current"
                }`}
              >
                {timeToStartInfo.formattedDisplay}
              </span>
            </div>
          </div>
        )}

        {/* High-Density Data Table (Visible on iPad Pro & Desktop) */}
        {useTanStackVirtualView ? (
          <div className="hidden md:block">
            <TanStackVirtualRunnersTable
              race={activeRace}
              meetingId={activeMeeting.id}
              activeRaceTrio={activeRaceTrio}
              onAssignPreference={onAssignPreference}
              expandedRunners={expandedRunners}
              onToggleRunnerForm={toggleRunnerForm}
              isApple={isApple}
            />
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F2D26] bg-[#0B110E] text-[12px] text-[#8A9990] font-medium">
                <th className="py-2.5 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("finishPosition")}
                    className="flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
                  >
                    <span>Pos / Pts</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("tabNumber")}
                    className="flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
                  >
                    <span># (Bar)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap">
                  Runner · Pedigree · Form
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap">
                  Jockey / Trainer
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("weight")}
                    className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
                  >
                    <span>Wgt</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("speedRating")}
                    className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
                  >
                    <span>Rtg / L600m</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Live Odds Flucs
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("nswTabWin")}
                    className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
                  >
                    <span>NSW TAB Win / Plc</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Set Preference (1st · 2nd · 3rd)
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Form
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2D26] text-xs">
              {sortedRunners.map((runner) => {
                const isExpanded =
                  expandAllForm || Boolean(expandedRunners[runner.tabNumber]);
                const pos = runner.finishPosition;
                const openPrice =
                  runner.openingOdds ||
                  Number((runner.fixedWin * 1.1).toFixed(2));
                const marketTrend =
                  runner.marketSupport ||
                  (runner.fixedWin < openPrice ? "Firming" : "Steady");

                const is1stPref = activeRaceTrio.firstPref === runner.tabNumber;
                const is2ndPref =
                  activeRaceTrio.secondPref === runner.tabNumber;
                const is3rdPref = activeRaceTrio.thirdPref === runner.tabNumber;

                return (
                  <React.Fragment key={runner.tabNumber}>
                    <tr className="hover:bg-[#16201B] transition-colors">
                      {/* Finishing Position & Points Value */}
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                        {pos === 1 ? (
                          <div>
                            <span className="font-semibold text-[#D4AF37]">
                              1st · +3 pts
                            </span>
                            <div className="text-[11px] text-[#8A9990]">
                              Win ({runner.margin})
                            </div>
                          </div>
                        ) : pos === 2 ? (
                          <div>
                            <span className="font-semibold text-[#F3F4F0]">
                              2nd · +2 pts
                            </span>
                            <div className="text-[11px] text-[#8A9990]">
                              Mgn {runner.margin}
                            </div>
                          </div>
                        ) : pos === 3 ? (
                          <div>
                            <span className="font-semibold text-[#10B981]">
                              3rd · +1 pt
                            </span>
                            <div className="text-[11px] text-[#8A9990]">
                              Mgn {runner.margin}
                            </div>
                          </div>
                        ) : pos === 4 ? (
                          <div>
                            <span className="text-[#8A9990]">4th · 0 pts</span>
                            <div className="text-[11px] text-[#8A9990]">
                              Mgn {runner.margin}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[#8A9990]">Unp · 0 pts</span>
                            <div className="text-[11px] text-[#8A9990]">
                              Mgn {runner.margin}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Tab Number, Silk & Barrier */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <JockeySilkSvg
                            primary={runner.silkPrimary}
                            secondary={runner.silkSecondary}
                            seed={runner.tabNumber}
                          />
                          <div className="font-mono tabular-nums">
                            <span className="font-semibold text-[#F3F4F0]">
                              #{runner.tabNumber}
                            </span>
                            <span className="text-[#8A9990] ml-1">
                              ({runner.barrier})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Runner Name, Form & Age/Sex */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="font-semibold text-[#F3F4F0] text-sm">
                            {runner.horseName}
                          </div>
                          <RunnerAiAnalysisButton
                            runner={runner}
                            race={activeRace || undefined}
                            meeting={activeMeeting || undefined}
                            size="xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8A9990] mt-0.5">
                          <span className="font-mono text-[#D4AF37]">
                            {runner.form}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{runner.ageSex || "4yo g"}</span>
                          <span aria-hidden="true">·</span>
                          <span>{runner.careerRecord || "10: 3-2-1"}</span>
                        </div>
                      </td>

                      {/* Jockey & Trainer */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-[#F3F4F0] font-medium">
                          {runner.jockey}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          T: {runner.trainer}
                        </div>
                      </td>

                      {/* Weight */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-[#F3F4F0]">
                        {runner.weight.toFixed(1)}kg
                      </td>

                      {/* Speed Rating & Last 600m */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[#F3F4F0] font-medium">
                            Rtg {runner.speedRating || 90}
                          </span>
                          {runnerClosingSpeedPercentiles.get(runner.tabNumber) && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                (runnerClosingSpeedPercentiles.get(runner.tabNumber)?.percentile ?? 0) >= 75
                                  ? "bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]"
                                  : (runnerClosingSpeedPercentiles.get(runner.tabNumber)?.percentile ?? 0) >= 50
                                  ? "bg-[#0071E3]/20 border border-[#0071E3]/40 text-[#0071E3]"
                                  : "bg-white/10 text-[#8A9990]"
                              }`}
                              title={`Career closing burst: ${runnerClosingSpeedPercentiles.get(runner.tabNumber)?.speedKmh} km/h (${runnerClosingSpeedPercentiles.get(runner.tabNumber)?.percentile}th percentile)`}
                            >
                              ⚡️ {runnerClosingSpeedPercentiles.get(runner.tabNumber)?.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8A9990] flex items-center justify-end gap-1">
                          <span>{runner.sectional600m || "34.20s"}</span>
                          <span aria-hidden="true">·</span>
                          <span>{runner.speedMapPosition || "Midfield"}</span>
                        </div>
                      </td>

                      {/* Live Betting Odds Fluctuations & Market Movers */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 text-[#F3F4F0]">
                          <span className="text-[#8A9990] text-[11px]">
                            ${openPrice.toFixed(2)}
                          </span>
                          <span className="text-[#8A9990]">→</span>
                          <span className="font-semibold text-sm">
                            ${runner.fixedWin.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-end">
                          {runnerMarketMoverMap.get(runner.tabNumber)?.status === "firming" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]">
                              <TrendingDown className="w-3 h-3 text-[#10B981]" />
                              <span>{runnerMarketMoverMap.get(runner.tabNumber)?.label}</span>
                            </span>
                          ) : runnerMarketMoverMap.get(runner.tabNumber)?.status === "drifting" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B]">
                              <TrendingUp className="w-3 h-3 text-[#F59E0B]" />
                              <span>{runnerMarketMoverMap.get(runner.tabNumber)?.label}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#8A9990] font-mono">
                              SOLID ⚖️
                            </span>
                          )}
                        </div>
                      </td>

                      {/* NSW TAB Win & Place Dividends */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#10B981]">
                          Win ${runner.nswTabWin.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          Plc ${runner.nswTabPlace.toFixed(2)}
                        </div>
                      </td>

                      {/* Quick Preference Assignment Buttons OR Cup Mode Draft Button */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isCupActive ? (
                          (() => {
                            const taken = isHorseTakenInRace(
                              activeRace.raceNumber,
                              runner.tabNumber,
                              cupTournament?.selectionsByRace || {}
                            );
                            const drafter = activeCupDrafter || activePunterName;
                            const isTakenByMe = taken.takenBy === drafter;

                            if (taken.isTaken) {
                              return (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2A1D0B] border border-[#D4AF37]/50 text-[#D4AF37] font-mono text-xs font-bold shadow-xs">
                                  <Lock className="w-3 h-3 text-[#D4AF37]" />
                                  <span>Taken: {taken.takenBy}</span>
                                  {isTakenByMe && onRemoveCupPick && (
                                    <button
                                      type="button"
                                      onClick={() => onRemoveCupPick(activeRace.raceNumber, taken.takenBy!)}
                                      className="p-0.5 rounded hover:bg-black/30 text-red-400 cursor-pointer ml-1"
                                      title="Clear pick"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  onAssignCupPick?.(
                                    activeRace.raceNumber,
                                    drafter,
                                    runner.tabNumber
                                  )
                                }
                                className={`px-3 py-1 rounded-md text-xs font-bold font-mono transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm ${
                                  isApple
                                    ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                                    : "bg-[#D4AF37] text-[#070B09] hover:bg-[#c49f2e]"
                                }`}
                                title={`Draft #${runner.tabNumber} ${runner.horseName} for ${drafter}`}
                              >
                                <Trophy className="w-3 h-3" />
                                <span>Draft for {drafter.split(" ")[0]}</span>
                              </button>
                            );
                          })()
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-[#0B110E] p-1 rounded border border-[#1F2D26]">
                            <button
                              type="button"
                              onClick={() =>
                                onAssignPreference(
                                  activeMeeting.id,
                                  activeRace.raceNumber,
                                  1,
                                  runner.tabNumber
                                )
                              }
                              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                                is1stPref
                                  ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                                  : "text-[#8A9990] hover:text-[#F3F4F0]"
                              }`}
                            >
                              1st
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAssignPreference(
                                  activeMeeting.id,
                                  activeRace.raceNumber,
                                  2,
                                  runner.tabNumber
                                )
                              }
                              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                                is2ndPref
                                  ? "bg-[#10B981] text-[#0B110E] font-semibold"
                                  : "text-[#8A9990] hover:text-[#F3F4F0]"
                              }`}
                            >
                              2nd
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onAssignPreference(
                                  activeMeeting.id,
                                  activeRace.raceNumber,
                                  3,
                                  runner.tabNumber
                                )
                              }
                              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                                is3rdPref
                                  ? "bg-[#3B82F6] text-white font-semibold"
                                  : "text-[#8A9990] hover:text-[#F3F4F0]"
                              }`}
                            >
                              3rd
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Form Guide Expand Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleRunnerForm(runner.tabNumber)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B110E] hover:bg-[#1C2A23] border border-[#1F2D26] text-xs text-[#D4AF37] font-medium transition-colors cursor-pointer"
                        >
                          <span>Form</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Comprehensive Expandable Runner Form Guide Panel */}
                    {isExpanded && (
                      <tr className="bg-[#0E1612]">
                        <td colSpan={10} className="px-4 py-3.5">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                            {/* Column 1: Pedigree, Career & Track/Wet Splits */}
                            <div className="lg:col-span-5 space-y-1.5 border-b lg:border-b-0 lg:border-r border-[#1F2D26] pb-3 lg:pb-0 lg:pr-4">
                              <div className="text-[#F3F4F0] font-semibold">
                                #{runner.tabNumber} {runner.horseName} — Full Form Guide Profile
                              </div>
                              <div className="text-[#8A9990]">
                                <span className="text-[#F3F4F0]">Pedigree:</span>{" "}
                                {runner.sireDam || "Thoroughbred AUS"}
                                {runner.damsire ? ` (Damsire: ${runner.damsire})` : ""} ·{" "}
                                {runner.ageSex || "4yo g"} · Prize Money:{" "}
                                <span className="font-mono text-[#D4AF37]">
                                  {runner.prizeMoneyEarned || "$145,000"}
                                </span>
                              </div>
                              <div className="text-[#8A9990] font-mono text-[11px]">
                                <span className="text-[#F3F4F0]">Gear & Ratings:</span>{" "}
                                {runner.headgear || "Standard"} · RPR:{" "}
                                <span className="text-[#10B981]">
                                  {runner.rpr ?? (runner.speedRating || 90) + 4}
                                </span>{" "}
                                · TSR: {runner.tsr ?? (runner.speedRating || 90) - 2} ·{" "}
                                Trainer 14d Win: {runner.trainer14DayWinPct || "18%"}
                              </div>
                              <div className="text-[#8A9990] font-mono text-[11px]">
                                {runner.trackDistRecord ||
                                  "Track 3:1-1-0 · Dist 5:2-1-1"}{" "}
                                ·{" "}
                                {runner.wetTrackRecord ||
                                  "Soft 4:1-2-0 · Heavy 1:0-0-0"}
                              </div>
                              <div className="text-[#8A9990] font-mono text-[11px]">
                                {runner.firstUpSecondUp ||
                                  "1st Up 3:1-1-0 · 2nd Up 3:1-1-1"}{" "}
                                · Flucs:{" "}
                                {(
                                  runner.flucs || [
                                    openPrice.toFixed(2),
                                    runner.fixedWin.toFixed(2),
                                  ]
                                ).join(" → ")}
                              </div>
                            </div>

                            {/* Column 2: Analyst Form Comment & Past Runs */}
                            <div className="lg:col-span-7 flex flex-col justify-between space-y-2">
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                                  <span className="text-[#D4AF37] font-semibold">
                                    Form Analyst Note:{" "}
                                  </span>
                                  <RunnerAiAnalysisButton
                                    runner={runner}
                                    race={activeRace || undefined}
                                    meeting={activeMeeting || undefined}
                                    size="xs"
                                  />
                                </div>
                                <span className="text-[#F3F4F0] leading-relaxed">
                                  {runner.formComment ||
                                    "Competitive NSW TAB runner suited to current track conditions and distance."}
                                </span>
                              </div>

                              {runner.lastStarts &&
                                runner.lastStarts.length > 0 && (
                                  <div className="pt-1.5 border-t border-[#1F2D26] space-y-1">
                                    <div className="text-[11px] text-[#8A9990] font-medium">
                                      Recent NSW / Metro Starts:
                                    </div>
                                    {runner.lastStarts.map((st, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#8A9990]"
                                      >
                                        <span className="text-[#F3F4F0] font-semibold">
                                          {st.finish}
                                        </span>
                                        <span>{st.date}</span>
                                        <span>·</span>
                                        <span className="text-[#F3F4F0]">
                                          {st.track} {st.distance}m
                                        </span>
                                        <span>·</span>
                                        <span>{st.classGrade}</span>
                                        <span>·</span>
                                        <span>
                                          {st.trackRating} ({st.weight}kg,{" "}
                                          {st.jockey})
                                        </span>
                                        <span>·</span>
                                        <span className="text-[#10B981]">
                                          Mgn {st.margin} · SP {st.startingPrice}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
      )}

        {/* Mobile Touch-First Runner Cards (Optimized for Chrome on iPhone < 768px) */}
        <div className="md:hidden divide-y divide-[#1F2D26]">
          {timeToStartInfo && !isCurrentRaceOfficial && (
            <div
              className={`p-3 border-b flex items-center justify-between text-xs ${
                timeToStartInfo.isRacing
                  ? "bg-[#EF4444]/15 text-[#EF4444] font-bold"
                  : timeToStartInfo.isImminent
                  ? "bg-[#FF3B30]/15 text-[#FF3B30] font-bold"
                  : "bg-[#0B110E] text-[#10B981]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-semibold">Race {activeRace?.raceNumber} Time to Start:</span>
              </div>
              <span className="font-mono font-bold text-sm tabular-nums">
                {timeToStartInfo.formattedDisplay}
              </span>
            </div>
          )}
          {sortedRunners.map((runner) => {
            const isExpanded =
              expandAllForm || Boolean(expandedRunners[runner.tabNumber]);
            const pos = runner.finishPosition;
            const openPrice =
              runner.openingOdds || Number((runner.fixedWin * 1.1).toFixed(2));
            const is1stPref = activeRaceTrio.firstPref === runner.tabNumber;
            const is2ndPref = activeRaceTrio.secondPref === runner.tabNumber;
            const is3rdPref = activeRaceTrio.thirdPref === runner.tabNumber;

            return (
              <div key={runner.tabNumber} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <JockeySilkSvg
                      primary={runner.silkPrimary}
                      secondary={runner.silkSecondary}
                      seed={runner.tabNumber}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-[#F3F4F0]">
                          #{runner.tabNumber} {runner.horseName}
                        </span>
                        <span className="font-mono text-xs text-[#8A9990]">
                          (Bar {runner.barrier})
                        </span>
                        <RunnerAiAnalysisButton
                          runner={runner}
                          race={activeRace || undefined}
                          meeting={activeMeeting || undefined}
                          size="xs"
                        />
                      </div>
                      <div className="text-xs text-[#8A9990] mt-0.5">
                        J: {runner.jockey} · T: {runner.trainer} ·{" "}
                        <span className="font-mono">
                          {runner.weight.toFixed(1)}kg
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono mt-1">
                        {runnerClosingSpeedPercentiles.get(runner.tabNumber) && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]">
                            ⚡️ {runnerClosingSpeedPercentiles.get(runner.tabNumber)?.label}
                          </span>
                        )}
                        {runnerMarketMoverMap.get(runner.tabNumber)?.status === "firming" ? (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]">
                            {runnerMarketMoverMap.get(runner.tabNumber)?.label}
                          </span>
                        ) : runnerMarketMoverMap.get(runner.tabNumber)?.status === "drifting" ? (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B]">
                            {runnerMarketMoverMap.get(runner.tabNumber)?.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono text-xs tabular-nums shrink-0">
                    {pos === 1 ? (
                      <span className="font-semibold text-[#D4AF37]">
                        1st · +3 pts
                      </span>
                    ) : pos === 2 ? (
                      <span className="font-semibold text-[#F3F4F0]">
                        2nd · +2 pts
                      </span>
                    ) : pos === 3 ? (
                      <span className="font-semibold text-[#10B981]">
                        3rd · +1 pt
                      </span>
                    ) : (
                      <span className="text-[#8A9990]">0 pts</span>
                    )}
                    <div className="text-[11px] text-[#10B981] mt-0.5">
                      Win ${runner.nswTabWin.toFixed(2)} · Plc $
                      {runner.nswTabPlace.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 44px Touch Action Buttons for 1st, 2nd, 3rd Preference & Form */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {isCupActive ? (
                    (() => {
                      const taken = isHorseTakenInRace(
                        activeRace.raceNumber,
                        runner.tabNumber,
                        cupTournament?.selectionsByRace || {}
                      );
                      const drafter = activeCupDrafter || activePunterName;
                      const isTakenByMe = taken.takenBy === drafter;

                      if (taken.isTaken) {
                        return (
                          <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#2A1D0B] border border-[#D4AF37]/50 text-[#D4AF37] font-mono text-xs font-bold">
                            <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Taken: {taken.takenBy}</span>
                            {isTakenByMe && onRemoveCupPick && (
                              <button
                                type="button"
                                onClick={() => onRemoveCupPick(activeRace.raceNumber, taken.takenBy!)}
                                className="p-0.5 rounded hover:bg-black/30 text-red-400 cursor-pointer ml-1"
                                title="Clear pick"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() =>
                            onAssignCupPick?.(
                              activeRace.raceNumber,
                              drafter,
                              runner.tabNumber
                            )
                          }
                          className={`min-h-[44px] px-3.5 py-2 rounded-md font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                            isApple
                              ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                              : "bg-[#D4AF37] text-[#070B09] hover:bg-[#c49f2e]"
                          }`}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Draft for {drafter.split(" ")[0]}</span>
                        </button>
                      );
                    })()
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onAssignPreference(
                            activeMeeting.id,
                            activeRace.raceNumber,
                            1,
                            runner.tabNumber
                          )
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-md font-mono text-xs font-medium border transition-colors ${
                          is1stPref
                            ? "bg-[#D4AF37] border-[#D4AF37] text-[#0B110E] font-semibold"
                            : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                        }`}
                      >
                        1st Pref
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAssignPreference(
                            activeMeeting.id,
                            activeRace.raceNumber,
                            2,
                            runner.tabNumber
                          )
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-md font-mono text-xs font-medium border transition-colors ${
                          is2ndPref
                            ? "bg-[#10B981] border-[#10B981] text-[#0B110E] font-semibold"
                            : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                        }`}
                      >
                        2nd Pref
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAssignPreference(
                            activeMeeting.id,
                            activeRace.raceNumber,
                            3,
                            runner.tabNumber
                          )
                        }
                        className={`min-h-[44px] px-3 py-2 rounded-md font-mono text-xs font-medium border transition-colors ${
                          is3rdPref
                            ? "bg-[#3B82F6] border-[#3B82F6] text-white font-semibold"
                            : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                        }`}
                      >
                        3rd Pref
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleRunnerForm(runner.tabNumber)}
                    className="min-h-[44px] px-3 py-2 rounded-md bg-[#0B110E] border border-[#1F2D26] text-xs font-medium text-[#D4AF37] flex items-center gap-1"
                  >
                    <span>Form</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="bg-[#0B110E] border border-[#1F2D26] rounded-md p-3 text-xs space-y-1.5">
                    <div className="text-[#8A9990]">
                      <span className="text-[#F3F4F0] font-medium">
                        {runner.sireDam || "Thoroughbred AUS"}
                      </span>{" "}
                      · {runner.ageSex || "4yo g"} · Career{" "}
                      {runner.careerRecord || "10: 3-2-1"} ·{" "}
                      <span className="text-[#D4AF37] font-mono">
                        {runner.prizeMoneyEarned || "$145,000"}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#8A9990]">
                      {runner.trackDistRecord || "Track 3:1-1-0 · Dist 5:2-1-1"}{" "}
                      · Flucs ${openPrice.toFixed(2)} → $
                      {runner.fixedWin.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1F2D26]">
                      <span className="text-[#D4AF37] font-semibold text-[11px]">
                        Form Analyst Note:
                      </span>
                      <RunnerAiAnalysisButton
                        runner={runner}
                        race={activeRace || undefined}
                        meeting={activeMeeting || undefined}
                        size="xs"
                      />
                    </div>
                    <p className="text-[#F3F4F0] leading-relaxed">
                      {runner.formComment ||
                        "Competitive NSW TAB runner suited to current track rating and distance."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

          {/* Stepper Navigation Footer for Step 2 */}
          {inspectionMode === "stepper" && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0E1612] border-[#1F2D26]"
            }`}>
              <button
                type="button"
                onClick={() => setStepperStep(1)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isApple
                    ? "bg-white border-[#D1D1D6] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>← Step 1: Speed Map</span>
              </button>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#10B981]">Step 2 / 3:</span>
                <span className="opacity-75 hidden sm:inline">Form & market flucs inspected</span>
              </div>
              <button
                type="button"
                onClick={() => setStepperStep(3)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                  isApple
                    ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                    : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                }`}
              >
                <span>Step 3: Consensus & Selections →</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          STEP 3: NSW TAB OFFICIAL EXOTIC DIVIDENDS & CONSENSUS SELECTIONS
          ========================================================================= */}
      {(inspectionMode === "all" || stepperStep === 3) && (
        <div className="space-y-4 animate-fadeIn">
          {/* NSW TAB Official Exotic Dividends & Selections Box */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            isApple
              ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
              : isObsidian
              ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9]"
              : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  isApple ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#D4AF37]/15 text-[#D4AF37]"
                }`}>
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                    <span>NSW TAB Official Exotic Dividends & Consensus Selections</span>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                      isApple ? "bg-[#F2F2F7] text-[#86868B]" : "bg-[#0B110E] text-[#10B981]"
                    }`}>
                      Race {activeRace?.raceNumber} · {activeMeeting?.venue}
                    </span>
                  </h3>
                  <p className="text-xs text-current/70">
                    Syndicate trio preferences, multi-punter selections consensus, and official tote dividends
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoPickActiveRace}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    isApple
                      ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3] hover:bg-[#0071E3]/20"
                      : "bg-[#16271E] border-[#10B981]/50 text-[#10B981] hover:bg-[#1C3327]"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🎲 Auto-Pick Trio</span>
                </button>
                {onJumpToSelections && (
                  <button
                    type="button"
                    onClick={() => onJumpToSelections(activeMeeting.id, activeRace.raceNumber)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isApple
                        ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                        : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                    }`}
                  >
                    <span>🎯 Full Selections Sheet →</span>
                  </button>
                )}
              </div>
            </div>

            {/* When Cup Mode is active: Syndicate Flexi Box Trifecta from all users' discrete picks */}
            {isCupActive && activeRace && (
              <div className="mb-4 p-4 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏆</span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm font-mono text-[#D4AF37] uppercase tracking-wide">
                        Cup Mode Syndicate Flexi Box Trifecta (Race {activeRace.raceNumber})
                      </h4>
                      <p className="text-[11px] text-current/70 font-sans">
                        Combines all {cupTournament?.participants.length} users&apos; discrete selections into a collective Flexi Box
                      </p>
                    </div>
                  </div>
                  {onOpenCupView && (
                    <button
                      type="button"
                      onClick={onOpenCupView}
                      className="text-xs font-mono font-bold text-[#D4AF37] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Cup Tournament Board →</span>
                    </button>
                  )}
                </div>

                {/* Boxed runners chips */}
                <div className="flex flex-wrap items-center gap-2">
                  {cupTournament?.participants.map((punter) => {
                    const pickedTab = cupTournament.selectionsByRace[activeRace.raceNumber]?.[punter];
                    const runner = pickedTab ? activeRace.runners.find((r) => r.tabNumber === pickedTab) : null;
                    return (
                      <div
                        key={punter}
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono ${
                          runner
                            ? "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-current"
                            : "bg-black/20 border-dashed border-current/20 opacity-50"
                        }`}
                      >
                        <span className="font-bold opacity-75">{punter.split(" ")[0]}:</span>
                        {runner ? (
                          <span className="font-bold text-[#D4AF37]">
                            #{runner.tabNumber} {runner.horseName}
                          </span>
                        ) : (
                          <span className="italic text-[11px]">Not yet drafted</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Punter's Trio Selections for this Race */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              {/* 1st Preference */}
              <div className={`p-3 rounded-xl border ${
                activeRaceTrio.firstPref
                  ? isApple
                    ? "bg-[#F2F7FF] border-[#0071E3]/30"
                    : "bg-[#17231C] border-[#D4AF37]/40"
                  : isApple
                  ? "bg-[#F9F9FB] border-[#E5E5EA]"
                  : "bg-[#0B110E] border-[#1F2D26]"
              }`}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-[#D4AF37] flex items-center gap-1">
                    🥇 1st Preference
                  </span>
                  <span className="text-[10px] text-current/60 uppercase">Win / Top Pick</span>
                </div>
                {activeRaceTrio.firstPref ? (
                  (() => {
                    const r = activeRace?.runners.find((rn) => rn.tabNumber === activeRaceTrio.firstPref);
                    return (
                      <div>
                        <div className="font-bold text-sm text-[#F3F4F0] flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B110E] font-mono text-xs flex items-center justify-center font-black">
                            {r?.tabNumber}
                          </span>
                          <span className="truncate">{r?.horseName || `#${activeRaceTrio.firstPref}`}</span>
                        </div>
                        <div className="text-[11px] text-current/70 font-mono mt-1 flex items-center gap-2">
                          <span>TAB ${r?.nswTabWin?.toFixed(2) || "-"}</span>
                          <span>· Barrier {r?.barrier || "-"}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-current/50 italic py-1">No runner selected for 1st</p>
                )}
              </div>

              {/* 2nd Preference */}
              <div className={`p-3 rounded-xl border ${
                activeRaceTrio.secondPref
                  ? isApple
                    ? "bg-[#F2F7FF] border-[#0071E3]/30"
                    : "bg-[#17231C] border-[#10B981]/40"
                  : isApple
                  ? "bg-[#F9F9FB] border-[#E5E5EA]"
                  : "bg-[#0B110E] border-[#1F2D26]"
              }`}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-[#10B981] flex items-center gap-1">
                    🥈 2nd Preference
                  </span>
                  <span className="text-[10px] text-current/60 uppercase">Exacta / Quinella</span>
                </div>
                {activeRaceTrio.secondPref ? (
                  (() => {
                    const r = activeRace?.runners.find((rn) => rn.tabNumber === activeRaceTrio.secondPref);
                    return (
                      <div>
                        <div className="font-bold text-sm text-[#F3F4F0] flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#10B981] text-[#0B110E] font-mono text-xs flex items-center justify-center font-black">
                            {r?.tabNumber}
                          </span>
                          <span className="truncate">{r?.horseName || `#${activeRaceTrio.secondPref}`}</span>
                        </div>
                        <div className="text-[11px] text-current/70 font-mono mt-1 flex items-center gap-2">
                          <span>TAB ${r?.nswTabWin?.toFixed(2) || "-"}</span>
                          <span>· Barrier {r?.barrier || "-"}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-current/50 italic py-1">No runner selected for 2nd</p>
                )}
              </div>

              {/* 3rd Preference */}
              <div className={`p-3 rounded-xl border ${
                activeRaceTrio.thirdPref
                  ? isApple
                    ? "bg-[#F2F7FF] border-[#0071E3]/30"
                    : "bg-[#17231C] border-[#3B82F6]/40"
                  : isApple
                  ? "bg-[#F9F9FB] border-[#E5E5EA]"
                  : "bg-[#0B110E] border-[#1F2D26]"
              }`}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono font-bold text-[#3B82F6] flex items-center gap-1">
                    🥉 3rd Preference
                  </span>
                  <span className="text-[10px] text-current/60 uppercase">Trifecta Anchor</span>
                </div>
                {activeRaceTrio.thirdPref ? (
                  (() => {
                    const r = activeRace?.runners.find((rn) => rn.tabNumber === activeRaceTrio.thirdPref);
                    return (
                      <div>
                        <div className="font-bold text-sm text-[#F3F4F0] flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#3B82F6] text-white font-mono text-xs flex items-center justify-center font-black">
                            {r?.tabNumber}
                          </span>
                          <span className="truncate">{r?.horseName || `#${activeRaceTrio.thirdPref}`}</span>
                        </div>
                        <div className="text-[11px] text-current/70 font-mono mt-1 flex items-center gap-2">
                          <span>TAB ${r?.nswTabWin?.toFixed(2) || "-"}</span>
                          <span>· Barrier {r?.barrier || "-"}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-current/50 italic py-1">No runner selected for 3rd</p>
                )}
              </div>
            </div>

            {/* Official TAB Exotics Dividends (when race finalized / available) */}
            {activeRace?.exotics && activeRace.exotics.length > 0 && (
              <div className="mt-4 pt-3 border-t border-current/10">
                <span className="text-xs font-mono font-bold text-[#D4AF37] uppercase tracking-wider block mb-2">
                  Official NSW TAB Dividends Declared:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeRace.exotics.map((ex, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs font-mono ${
                        isApple
                          ? "bg-[#F2F2F7] border-[#E5E5EA]"
                          : "bg-[#0B110E] border-[#1F2D26]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-current/70 text-[11px]">
                        <span className="font-bold">{ex.poolType}</span>
                        <span>{ex.combination || "-"}</span>
                      </div>
                      <div className="text-sm font-bold text-[#10B981] mt-0.5">
                        ${Number(ex.dividend).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation Footer for Step 3 */}
          {inspectionMode === "stepper" && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0E1612] border-[#1F2D26]"
            }`}>
              <button
                type="button"
                onClick={() => setStepperStep(2)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isApple
                    ? "bg-white border-[#D1D1D6] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>← Step 2: Key Form</span>
              </button>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#10B981]">Step 3 / 3:</span>
                <span className="opacity-75 hidden sm:inline">Consensus selections ready</span>
              </div>
              {onJumpToSelections ? (
                <button
                  type="button"
                  onClick={() => onJumpToSelections(activeMeeting.id, activeRace.raceNumber)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                    isApple
                      ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                      : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                  }`}
                >
                  <span>🎯 View in Syndicate Selections Sheet →</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepperStep(1)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                    isApple
                      ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                      : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                  }`}
                >
                  <span>↺ Review Race from Step 1</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
