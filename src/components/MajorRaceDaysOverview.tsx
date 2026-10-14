import React, { useState, useEffect, useMemo } from "react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import {
  getSydneyAndMelbourneMeetings,
  isRaceOfficialOrCompleted,
  sortMeetingsByMetroPriority,
} from "../data/seedNswTab";
import { getFeatureRaceNumberForMeeting } from "../utils/scoring";
import {
  Flame,
  Trophy,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Eye,
  X,
  BarChart3,
} from "lucide-react";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { HarvillePlackettLuceModel } from "./HarvillePlackettLuceModel";

interface MajorRaceDaysOverviewProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters?: PunterProfile[];
  selectedRaceNumber: number;
  onInspectRace: (meetingId: string, raceNumber: number) => void;
  onJumpToSelectionsForMeeting: (meetingId: string) => void;
  verifiedSourcesUsed?: string[];
  extraSelectedMeetingIds?: string[];
  onChangeExtraSelectedMeetingIds?: (ids: string[]) => void;
}

function getTopFavourites(runners: RaceRunner[], count = 3): RaceRunner[] {
  return [...runners]
    .filter((r) => (r.fixedWin || r.nswTabWin || 0) > 1.0)
    .sort((a, b) => {
      const aOdds = a.fixedWin > 1 ? a.fixedWin : a.nswTabWin || 999;
      const bOdds = b.fixedWin > 1 ? b.fixedWin : b.nswTabWin || 999;
      if (aOdds !== bOdds) return aOdds - bOdds;
      return a.tabNumber - b.tabNumber;
    })
    .slice(0, count);
}

export const MajorRaceDaysOverview: React.FC<MajorRaceDaysOverviewProps> = ({
  meetings,
  selectedMeetingId,
  selectedMeetingIds: controlledSelectedIds,
  onChangeSelectedMeetingIds,
  punters = [],
  selectedRaceNumber,
  onInspectRace,
  onJumpToSelectionsForMeeting,
  verifiedSourcesUsed = [
    "Ladbrokes AU API (v1)",
    "Neds AU API (v1)",
    "PointsBet AU API (v3)",
    "Racing & Sports AU",
  ],
}) => {
  const sorted = useMemo(() => sortMeetingsByMetroPriority(meetings), [meetings]);
  const { sydneyMeeting, melbourneMeeting, combinedRequiredMeetings } = useMemo(
    () => getSydneyAndMelbourneMeetings(sorted),
    [sorted]
  );

  // Default 2 cards: Melbourne (VIC) and Sydney (NSW)
  const defaultSelectedIds = useMemo(() => {
    if (combinedRequiredMeetings.length > 0) {
      return combinedRequiredMeetings.map((m) => m.id);
    }
    return sorted.slice(0, 2).map((m) => m.id);
  }, [combinedRequiredMeetings, sorted]);

  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(
    defaultSelectedIds
  );
  const [expandedProbRaceKey, setExpandedProbRaceKey] = useState<string | null>(null);

  useEffect(() => {
    setInternalSelectedIds(defaultSelectedIds);
  }, [defaultSelectedIds.join(",")]);

  const activeSelectedIds = useMemo(() => {
    const raw =
      controlledSelectedIds && controlledSelectedIds.length > 0
        ? controlledSelectedIds
        : internalSelectedIds;
    const validSet = new Set(sorted.map((m) => m.id));
    const filtered = raw.filter((id) => validSet.has(id));
    return filtered.length > 0 ? filtered : defaultSelectedIds;
  }, [controlledSelectedIds, internalSelectedIds, sorted, defaultSelectedIds]);

  const handleUpdateSelectedIds = (nextIds: string[]) => {
    setInternalSelectedIds(nextIds);
    onChangeSelectedMeetingIds?.(nextIds);
  };

  const displayedMeetings = useMemo(
    () => sorted.filter((m) => activeSelectedIds.includes(m.id)),
    [sorted, activeSelectedIds]
  );

  const renderMeetingColumn = (
    meeting: RaceMeeting | null,
    stateBadgeLabel: string,
    stateAccentClass: string,
    onRemoveExtraCard?: () => void
  ) => {
    if (!meeting) {
      return (
        <div className="rounded-2xl border border-[#1E2E26] bg-[#0E1713] p-6 text-center text-sm text-[#8A9990]">
          No scheduled {stateBadgeLabel} thoroughbred race meeting on this date.
        </div>
      );
    }

    const completedCount = meeting.races.filter((r) =>
      isRaceOfficialOrCompleted(r, meeting.date)
    ).length;

    return (
      <div
        key={meeting.id}
        className="flex flex-col rounded-2xl border border-[#23352C] bg-[#0D1612] shadow-xl overflow-hidden"
      >
        {/* Major Meeting Header */}
        <div className="border-b border-[#1E2E26] bg-gradient-to-r from-[#13221B] via-[#101C16] to-[#0D1612] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-[#9BA8A1]">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${stateAccentClass}`}
              >
                <MapPin className="h-3 w-3" />
                {stateBadgeLabel}
              </span>
              <span>·</span>
              <span className="font-mono text-[#D4AF37] font-semibold">
                {meeting.races.length} Races
              </span>
              <span>·</span>
              <span>{meeting.tier}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onJumpToSelectionsForMeeting(meeting.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/25 transition cursor-pointer"
              >
                Enter Selections ({meeting.races.length}R)
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {onRemoveExtraCard && (
                <button
                  type="button"
                  onClick={onRemoveExtraCard}
                  title={`Hide ${meeting.venue} card`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2E4237] bg-[#14221B] px-2 py-1 text-xs text-[#9BA8A1] hover:border-rose-500/50 hover:text-rose-300 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Hide</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl font-bold tracking-tight text-[#F3F4F0]">
                {meeting.venue}{" "}
                <span className="text-base font-normal text-[#8A9990]">
                  ({meeting.state})
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-[#8A9990]">
                Track:{" "}
                <strong className="text-emerald-300">
                  {meeting.trackRating}
                </strong>{" "}
                · Weather:{" "}
                <strong className="text-[#D5DDD8]">{meeting.weather}</strong> ·
                Rail:{" "}
                <span className="text-[#9BA8A1]">{meeting.railPosition}</span>
              </p>
            </div>
            <div className="text-right font-mono text-xs text-[#9BA8A1]">
              {completedCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {completedCount}/{meeting.races.length} Final
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  Upcoming Card ({meeting.races.length} Races)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Individual Races List with Top Favourites */}
        <div className="divide-y divide-[#1A2921]">
          {meeting.races.map((race: RaceEvent) => {
            const isCompleted = isRaceOfficialOrCompleted(race, meeting.date);
            const topFavs = getTopFavourites(race.runners, 3);
            const isSelected =
              selectedMeetingId === meeting.id &&
              selectedRaceNumber === race.raceNumber;

            const winner = isCompleted
              ? race.runners.find((r) => r.finishPosition === 1)
              : null;
            const second = isCompleted
              ? race.runners.find((r) => r.finishPosition === 2)
              : null;
            const third = isCompleted
              ? race.runners.find((r) => r.finishPosition === 3)
              : null;

            return (
              <div
                key={race.raceNumber}
                className={`p-4 transition ${
                  isSelected
                    ? "bg-[#15251D] ring-1 ring-inset ring-[#D4AF37]/40"
                    : "hover:bg-[#111D17]"
                }`}
              >
                {/* Race Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-9 items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 font-mono text-xs font-bold text-[#D4AF37]">
                      R{race.raceNumber}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-sm sm:text-base text-[#F3F4F0]">
                          {race.raceName}
                        </h4>
                        {getFeatureRaceNumberForMeeting(meeting) ===
                          race.raceNumber && (
                          <span className="rounded border border-[#D4AF37]/60 bg-[#D4AF37]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#D4AF37]">
                            ★ FEATURE · 🃏 DEFAULT JOKER (2×)
                          </span>
                        )}
                        {race.classGrade &&
                          race.classGrade !== "Thoroughbred" && (
                            <span className="text-[11px] font-medium text-[#9BD4B5]">
                              · {race.classGrade}
                            </span>
                          )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#8A9990]">
                        <span className="inline-flex items-center gap-1 text-[#D5DDD8]">
                          <Clock className="h-3 w-3 text-[#D4AF37]" />
                          {race.startTime} AEDT
                        </span>
                        <span>·</span>
                        <span>{race.distance}m</span>
                        {race.prizeMoney && race.prizeMoney !== "-" && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-300">
                              {race.prizeMoney}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{race.runners.length} Runners</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        OFFICIAL FINAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#D4AF37]">
                        FIXED ODDS OPEN
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProbRaceKey((prev) =>
                          prev === `${meeting.id}-R${race.raceNumber}`
                            ? null
                            : `${meeting.id}-R${race.raceNumber}`
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        expandedProbRaceKey === `${meeting.id}-R${race.raceNumber}`
                          ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]"
                          : "border-[#283D32] bg-[#16261E] text-[#9BA8A1] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                      }`}
                      title="Toggle Runner Win Likelihood & Market Probability Chart"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Win Likelihood</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onInspectRace(meeting.id, race.raceNumber)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#283D32] bg-[#16261E] px-2.5 py-1 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] transition cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Full Field ({race.runners.length})
                    </button>
                  </div>
                </div>

                {/* Official Podium Banner if Race is Completed */}
                {isCompleted && winner && (
                  <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-300">
                        <Trophy className="h-3.5 w-3.5 text-[#D4AF37]" />
                        Official Result:
                      </span>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        <span className="font-bold text-[#F3F4F0]">
                          1st: #{winner.tabNumber} {winner.horseName}{" "}
                          <span className="text-emerald-300">
                            (${winner.nswTabWin.toFixed(2)} / $
                            {winner.nswTabPlace.toFixed(2)})
                          </span>
                        </span>
                        {second && (
                          <span className="text-[#C2CEC7]">
                            2nd: #{second.tabNumber} {second.horseName}{" "}
                            <span className="text-[#8A9990]">
                              (${second.nswTabPlace.toFixed(2)})
                            </span>
                          </span>
                        )}
                        {third && (
                          <span className="text-[#C2CEC7]">
                            3rd: #{third.tabNumber} {third.horseName}{" "}
                            <span className="text-[#8A9990]">
                              (${third.nswTabPlace.toFixed(2)})
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Favourites in this Race */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      Top Market Favourites (Verified Live Fixed Odds)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {topFavs.map((fav, idx) => (
                      <div
                        key={fav.tabNumber}
                        onClick={() =>
                          onInspectRace(meeting.id, race.raceNumber)
                        }
                        className="group flex flex-col justify-between rounded-xl border border-[#21332A] bg-[#111D17] p-2.5 hover:border-[#D4AF37]/50 transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-5 w-5 shrink-0 rounded-full border border-white/20 shadow-inner flex items-center justify-center font-mono text-[10px] font-bold"
                              style={{
                                background: `linear-gradient(135deg, ${fav.silkPrimary} 55%, ${fav.silkSecondary} 45%)`,
                                color: "#FFFFFF",
                                textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                              }}
                            >
                              {fav.tabNumber}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-xs text-[#F3F4F0] group-hover:text-[#D4AF37]">
                                #{fav.tabNumber} {fav.horseName}
                              </div>
                              <div className="truncate text-[10px] text-[#8A9990]">
                                B{fav.barrier} · {fav.jockey}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-[10px] font-bold ${
                              idx === 0 ? "text-[#D4AF37]" : "text-[#9BA8A1]"
                            }`}
                          >
                            FAV #{idx + 1}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between border-t border-[#1B2A22] pt-1.5 font-mono text-[11px]">
                          <span className="truncate text-[10px] text-[#7A8A81] max-w-[110px]">
                            {fav.trainer}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-300">
                              ${(fav.fixedWin || fav.nswTabWin || 0).toFixed(2)}W
                            </span>
                            <span className="text-[#8A9990]">
                              $
                              {(fav.fixedPlace || fav.nswTabPlace || 0).toFixed(
                                2
                              )}
                              P
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Harville Plackett-Luce Runner Win Likelihood Chart */}
                {expandedProbRaceKey === `${meeting.id}-R${race.raceNumber}` && (
                  <div className="mt-3 pt-2 border-t border-[#1F2D26]">
                    <HarvillePlackettLuceModel race={race} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section id="section-todays-races" className="scroll-mt-28 space-y-5">
      {/* Section Header + Multi-Select Checkbox Race Card Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-[#23352C] bg-[#0E1813] p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A9990]">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Default View: Sydney &amp; Melbourne Feature Race Cards
            </span>
            <span>·</span>
            <span>Sources: {verifiedSourcesUsed.join(" · ")}</span>
          </div>
          <h2 className="mt-1.5 font-serif text-2xl sm:text-3xl font-bold text-[#F3F4F0]">
            Active Race Cards ({displayedMeetings.length} Selected:{" "}
            {displayedMeetings.map((m) => m.venue).join(" · ")})
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#9BA8A1]">
            Showing the primary <strong>Melbourne (VIC)</strong> and{" "}
            <strong>Sydney (NSW)</strong> race cards by default. Use the{" "}
            <strong className="text-[#D4AF37]">
              Race Cards / Locations checkbox dropdown
            </strong>{" "}
            to select one or multiple race cards across the day.
          </p>
        </div>

        {/* Multi-Select Race Card Dropdown with Checkboxes */}
        <div className="self-start lg:self-center flex flex-wrap items-center gap-2">
          <RaceCardMultiSelectDropdown
            meetings={sorted}
            selectedMeetingIds={activeSelectedIds}
            onChangeSelectedMeetingIds={handleUpdateSelectedIds}
            punters={punters}
            labelPrefix="Race Cards / Locations"
            align="right"
          />

          {activeSelectedIds.join(",") !== defaultSelectedIds.join(",") && (
            <button
              type="button"
              onClick={() => handleUpdateSelectedIds(defaultSelectedIds)}
              className="min-h-[40px] rounded-lg border border-[#23352C] bg-[#121F18] px-3 py-2 text-xs font-semibold text-[#9BA8A1] hover:border-[#D4AF37] hover:text-[#F3F4F0] transition cursor-pointer"
              title="Reset to showing only Sydney and Melbourne cards"
            >
              Reset to Sydney &amp; Melbourne Default
            </button>
          )}
        </div>
      </div>

      {/* Active Race Cards Quick-Toggle Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1E2E26] bg-[#101A15] px-4 py-2.5 text-xs">
        <span className="font-semibold text-[#D4AF37]">
          Checked Race Cards ({displayedMeetings.length}/{sorted.length}):
        </span>
        {displayedMeetings.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#10B981]/40 bg-[#152920] px-2.5 py-1 font-medium text-[#F3F4F0]"
          >
            <span>
              {m.venue} ({m.state} · {m.races.length}R)
            </span>
            {displayedMeetings.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  handleUpdateSelectedIds(
                    activeSelectedIds.filter((id) => id !== m.id)
                  )
                }
                className="text-[#8A9990] hover:text-rose-300 cursor-pointer"
                title={`Uncheck ${m.venue}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Selected Race Cards Grid (Side-by-Side) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {displayedMeetings.map((mtg) => {
          const isMelb = mtg.id === melbourneMeeting?.id;
          const isSyd = mtg.id === sydneyMeeting?.id;
          const badgeLabel = isMelb
            ? "Melbourne Feature Card (VIC)"
            : isSyd
            ? "Sydney Feature Card (NSW)"
            : `${mtg.state || "TAB"} Race Card`;
          const accentClass = isMelb
            ? "bg-blue-950/80 text-blue-200 border border-blue-400/40"
            : isSyd
            ? "bg-sky-950/80 text-sky-200 border border-sky-400/40"
            : "bg-emerald-950/80 text-emerald-200 border border-emerald-400/40";

          return renderMeetingColumn(
            mtg,
            badgeLabel,
            accentClass,
            displayedMeetings.length > 1
              ? () =>
                  handleUpdateSelectedIds(
                    activeSelectedIds.filter((id) => id !== mtg.id)
                  )
              : undefined
          );
        })}
      </div>
    </section>
  );
};
