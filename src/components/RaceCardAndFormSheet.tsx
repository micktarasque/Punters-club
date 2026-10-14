import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  PunterProfile,
  RaceEvent,
  RaceMeeting,
  RaceSelectionTrio,
} from "../types/racing";
import { JockeySilkSvg } from "./JockeySilkSvg";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { generateRaceAutoPickTrio } from "../utils/autoPick";
import { TanStackVirtualRunnersTable } from "./TanStackVirtualRunnersTable";
import { HarvillePlackettLuceModel } from "./HarvillePlackettLuceModel";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";

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
}) => {
  const [runnerSearch, setRunnerSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("finishPosition");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRunners, setExpandedRunners] = useState<
    Record<number, boolean>
  >({});
  const [expandAllForm, setExpandAllForm] = useState(false);
  const [useTanStackVirtualView, setUseTanStackVirtualView] = useState(true);
  const [showHarvilleModel, setShowHarvilleModel] = useState(true);

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
    <div className="space-y-4">
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
                          <span className="text-[10px] font-mono tabular-nums text-[#8A9990] mt-0.5">
                            {winner
                              ? `1st #${winner.tabNumber} ($${winner.nswTabWin.toFixed(
                                  2
                                )})`
                              : r.startTime}
                          </span>
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
          </div>
        </div>
      </div>

      {/* NSW TAB Exotic Dividends & Speed Map Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* NSW TAB Exotic Tote Dividends */}
        <div className="lg:col-span-7 bg-[#121A16] border border-[#1F2D26] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-[#F3F4F0]">
              NSW TAB Official Exotic Tote Dividends (R{activeRace.raceNumber})
            </h3>
            <span className="text-xs text-[#8A9990]">
              Status: {activeRace.status} · Scoring: 1st = 3 pts · 2nd = 2 pts · 3rd = 1 pt
            </span>
          </div>
          {activeRace.exotics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {activeRace.exotics.map((ex, idx) => (
                <div
                  key={`${ex.poolType}-${idx}`}
                  className="bg-[#0B110E] border border-[#1F2D26] rounded p-2.5"
                >
                  <div className="text-xs text-[#8A9990]">{ex.poolType}</div>
                  <div className="font-mono text-xs font-semibold text-[#F3F4F0] mt-0.5 tabular-nums">
                    {ex.combination}
                  </div>
                  <div className="font-mono text-sm font-semibold text-[#10B981] mt-1 tabular-nums">
                    ${ex.dividend.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0B110E] border border-[#1F2D26] rounded p-3 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[#D4AF37] font-semibold">
                  Race Upcoming ({activeRace.startTime}) — Exotics Pending Official All-Clear
                </span>
                {activeRace.tip && (
                  <span className="font-mono text-[#10B981]">
                    Top Rated: {activeRace.tip}
                  </span>
                )}
              </div>
              {activeRace.verdict && (
                <p className="text-[#8A9990]">{activeRace.verdict}</p>
              )}
            </div>
          )}
        </div>

        {/* Pace & Speed Map Overview */}
        <div className="lg:col-span-5 bg-[#121A16] border border-[#1F2D26] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-[#F3F4F0]">
              Race Speed Map & Settling Positions ({activeRace.distance}m)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8A9990]">
                {activePunterName}:{" "}
                <span className="font-mono text-[#D4AF37]">
                  1st #{activeRaceTrio.firstPref ?? "-"} · 2nd #
                  {activeRaceTrio.secondPref ?? "-"} · 3rd #
                  {activeRaceTrio.thirdPref ?? "-"}
                </span>
              </span>
              <button
                type="button"
                onClick={handleAutoPickActiveRace}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#152920] border border-[#10B981]/50 text-[#10B981] hover:bg-[#1A3327] cursor-pointer transition-colors"
                title="Randomly select at least one of the top three favourites, and then randomly pick the other two"
              >
                🎲 Auto Pick
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(["Leader", "On Pace", "Midfield", "Backmarker"] as const).map(
              (posLabel) => {
                const matching = activeRace.runners.filter(
                  (r) => (r.speedMapPosition || "Midfield") === posLabel
                );
                return (
                  <div
                    key={posLabel}
                    className="bg-[#0B110E] border border-[#1F2D26] rounded p-2"
                  >
                    <div className="text-[11px] text-[#8A9990] mb-1">
                      {posLabel}
                    </div>
                    <div className="space-y-1">
                      {matching.length === 0 ? (
                        <span className="text-[11px] text-[#8A9990]/50">-</span>
                      ) : (
                        matching.map((m) => (
                          <div
                            key={m.tabNumber}
                            className="font-mono text-[11px] text-[#F3F4F0] truncate"
                            title={`#${m.tabNumber} ${m.horseName} (Barrier ${m.barrier})`}
                          >
                            #{m.tabNumber} {m.horseName.split(" ")[0]}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

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
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A9990] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={runnerSearch}
                onChange={(e) => setRunnerSearch(e.target.value)}
                placeholder="Filter horse, jockey, trainer, #..."
                className="bg-[#0B110E] border border-[#1F2D26] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#F3F4F0] placeholder-[#8A9990] focus:outline-none focus:border-[#D4AF37] w-64"
              />
            </div>
            <span className="text-xs text-[#8A9990] font-mono tabular-nums">
              {sortedRunners.length} Runners
            </span>
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
                        <div className="font-semibold text-[#F3F4F0] text-sm">
                          {runner.horseName}
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
                        <div className="text-[#F3F4F0] font-medium">
                          Rtg {runner.speedRating || 90}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          {runner.sectional600m || "34.20s"} ·{" "}
                          {runner.speedMapPosition || "Midfield"}
                        </div>
                      </td>

                      {/* Live Betting Odds Fluctuations */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 text-[#F3F4F0]">
                          <span className="text-[#8A9990] text-[11px]">
                            ${openPrice.toFixed(2)}
                          </span>
                          <span className="text-[#8A9990]">→</span>
                          <span className="font-semibold">
                            ${runner.fixedWin.toFixed(2)}
                          </span>
                          {marketTrend === "Firming" ? (
                            <span title="Market Firming (Backed)">
                              <TrendingDown className="w-3.5 h-3.5 text-[#10B981]" />
                            </span>
                          ) : marketTrend === "Drifting" ? (
                            <span title="Market Drifting">
                              <TrendingUp className="w-3.5 h-3.5 text-[#F59E0B]" />
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          {marketTrend}
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

                      {/* Quick Preference Assignment Buttons (1st, 2nd, 3rd) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
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
                                <span className="text-[#D4AF37] font-semibold">
                                  Form Analyst Note:{" "}
                                </span>
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[#F3F4F0]">
                          #{runner.tabNumber} {runner.horseName}
                        </span>
                        <span className="font-mono text-xs text-[#8A9990]">
                          (Bar {runner.barrier})
                        </span>
                      </div>
                      <div className="text-xs text-[#8A9990] mt-0.5">
                        J: {runner.jockey} · T: {runner.trainer} ·{" "}
                        <span className="font-mono">
                          {runner.weight.toFixed(1)}kg
                        </span>
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
                    <p className="text-[#F3F4F0] leading-relaxed pt-1 border-t border-[#1F2D26]">
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
    </div>
  );
};
