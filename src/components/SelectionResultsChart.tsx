import React, { useState, useMemo, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  DollarSign,
  Layers,
  Play,
  RotateCcw,
  StepForward,
  Trophy,
} from "lucide-react";
import { PunterProfile, RaceMeeting } from "../types/racing";
import {
  getSydneyAndMelbourneMeetings,
  isRaceOfficialOrCompleted,
} from "../data/seedNswTab";
import {
  EvaluatedRaceResult,
  evaluateRaceTrio,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";

import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";

export type ChartMetricMode = "points" | "dollars" | "both";
export type MultiMeetCombineView = "by_race_number" | "chronological";

interface UserCardSummaryForChart {
  punter: PunterProfile;
  raceEvaluations: Record<number, EvaluatedRaceResult>;
  completedRaces: number;
  firstPlaceHits?: number;
  secondPlaceHits?: number;
  thirdPlaceHits?: number;
  totalPoints: number;
  totalDollarReturn: number;
}

interface SelectionResultsChartProps {
  meeting: RaceMeeting;
  meetings?: RaceMeeting[];
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters?: PunterProfile[];
  userSummaries: UserCardSummaryForChart[];
  defaultMetricMode: "points" | "dollars";
  onSyncGlobalMode?: (mode: "points" | "dollars") => void;
  onPushRaceResultNotification?: (raceNumber: number) => void;
}

const USER_PALETTE = [
  {
    stroke: "#D4AF37",
    fill: "#D4AF37",
    softBg: "rgba(212, 175, 55, 0.16)",
    label: "Gold",
  },
  {
    stroke: "#10B981",
    fill: "#10B981",
    softBg: "rgba(16, 185, 129, 0.16)",
    label: "Emerald",
  },
  {
    stroke: "#38BDF8",
    fill: "#38BDF8",
    softBg: "rgba(56, 189, 248, 0.16)",
    label: "Cyan",
  },
  {
    stroke: "#F43F5E",
    fill: "#F43F5E",
    softBg: "rgba(244, 63, 94, 0.16)",
    label: "Coral",
  },
  {
    stroke: "#A855F7",
    fill: "#A855F7",
    softBg: "rgba(168, 85, 247, 0.16)",
    label: "Violet",
  },
  {
    stroke: "#F59E0B",
    fill: "#F59E0B",
    softBg: "rgba(245, 158, 11, 0.16)",
    label: "Amber",
  },
];

const CARD_SEGMENT_OPACITIES = [0.88, 0.58, 0.38, 0.72, 0.48];

export const SelectionResultsChart: React.FC<SelectionResultsChartProps> = ({
  meeting,
  meetings = [],
  selectedMeetingIds: controlledSelectedIds,
  onChangeSelectedMeetingIds,
  punters = [],
  userSummaries,
  onSyncGlobalMode,
  onPushRaceResultNotification,
}) => {
  const [chartMode, setChartMode] = useState<ChartMetricMode>("both");
  const allAvailableMeetings = useMemo(
    () => (meetings.length > 0 ? meetings : [meeting]),
    [meetings, meeting]
  );
  const allPunters = useMemo(
    () =>
      punters.length > 0 ? punters : userSummaries.map((u) => u.punter),
    [punters, userSummaries]
  );

  // Allow 1 or more racecards to be stacked and shown on the graph
  const [combineMultiMeets, setCombineMultiMeets] = useState<boolean>(true);
  const [multiMeetView, setMultiMeetView] =
    useState<MultiMeetCombineView>("by_race_number");
  const [combinedMeetingIds, setCombinedMeetingIds] = useState<string[]>(() => {
    if (controlledSelectedIds && controlledSelectedIds.length > 0) {
      return controlledSelectedIds;
    }
    const { combinedRequiredMeetings } =
      getSydneyAndMelbourneMeetings(allAvailableMeetings);
    if (combinedRequiredMeetings.length >= 2) {
      return combinedRequiredMeetings.map((m) => m.id);
    }
    return allAvailableMeetings.slice(0, 2).map((m) => m.id);
  });

  useEffect(() => {
    if (controlledSelectedIds && controlledSelectedIds.length > 0) {
      setCombinedMeetingIds(controlledSelectedIds);
      setCombineMultiMeets(controlledSelectedIds.length > 1);
    }
  }, [controlledSelectedIds?.join(",")]);

  const updateChartSelectedIds = (nextIds: string[]) => {
    const safeIds = nextIds.length > 0 ? nextIds : [meeting.id];
    setCombinedMeetingIds(safeIds);
    setCombineMultiMeets(safeIds.length > 1);
    onChangeSelectedMeetingIds?.(safeIds);
  };

  const handleToggleMultiMeets = () => {
    setCombineMultiMeets((prev) => {
      const next = !prev;
      if (next) {
        const { combinedRequiredMeetings } =
          getSydneyAndMelbourneMeetings(allAvailableMeetings);
        const defaultIds = new Set<string>([meeting.id]);
        for (const m of combinedRequiredMeetings) {
          defaultIds.add(m.id);
        }
        if (defaultIds.size < 2 && allAvailableMeetings.length >= 2) {
          defaultIds.add(
            allAvailableMeetings.find((m) => m.id !== meeting.id)?.id ||
              meeting.id
          );
        }
        const nextArr = Array.from(defaultIds);
        setCombinedMeetingIds(nextArr);
        onChangeSelectedMeetingIds?.(nextArr);
      } else {
        setCombinedMeetingIds([meeting.id]);
        onChangeSelectedMeetingIds?.([meeting.id]);
      }
      return next;
    });
  };

  const toggleMeetingInCombinedPool = (mtgId: string) => {
    if (combinedMeetingIds.includes(mtgId)) {
      if (combinedMeetingIds.length <= 1) return;
      const next = combinedMeetingIds.filter((id) => id !== mtgId);
      updateChartSelectedIds(next);
    } else {
      const next = [...combinedMeetingIds, mtgId];
      updateChartSelectedIds(next);
    }
  };

  const selectedCombinedMeetings = useMemo(() => {
    const filtered = allAvailableMeetings.filter((m) =>
      combinedMeetingIds.includes(m.id)
    );
    return filtered.length > 0 ? filtered : [meeting];
  }, [allAvailableMeetings, combinedMeetingIds, meeting]);

  // Individual per-racecard totals for each user (so both Individual Racecard Scores & Cumulative Total are always shown)
  const perCardUserBreakdown = useMemo(() => {
    return allPunters.map((punter, uIdx) => {
      const palette = USER_PALETTE[uIdx % USER_PALETTE.length];
      let cumulativePoints = 0;
      let cumulativeDollars = 0;
      let cumulativeCompletedRaces = 0;

      const cardScores = selectedCombinedMeetings.map((m, cIdx) => {
        const mSel = getPunterSelectionsForMeeting(punter, m);
        const jokerRace = getPunterJokerForMeeting(punter, m);
        let cardPts = 0;
        let cardDlrs = 0;
        let cardCompleted = 0;
        let cardWins = 0;

        for (const r of m.races) {
          const done = isRaceOfficialOrCompleted(r, m.date);
          if (done) cardCompleted += 1;
          const ev = evaluateRaceTrio(
            r,
            mSel[r.raceNumber],
            m.date,
            jokerRace === r.raceNumber
          );
          if (done && ev.hasAnySelection) {
            cardPts += ev.racePointsTally;
            cardDlrs = Number(
              (cardDlrs + (ev.raceDollarReturn ?? 0)).toFixed(2)
            );
            if (ev.picks.some((p) => p.finishPosition === 1)) {
              cardWins += 1;
            }
          }
        }

        cumulativePoints += cardPts;
        cumulativeDollars = Number((cumulativeDollars + cardDlrs).toFixed(2));
        cumulativeCompletedRaces += cardCompleted;

        return {
          meeting: m,
          cardIndex: cIdx,
          points: cardPts,
          dollars: cardDlrs,
          completedRaces: cardCompleted,
          totalRaces: m.races.length,
          wins: cardWins,
        };
      });

      return {
        punter,
        palette,
        cardScores,
        cumulativePoints,
        cumulativeDollars,
        cumulativeCompletedRaces,
      };
    });
  }, [allPunters, selectedCombinedMeetings]);

  // Build unified slot definitions (either by Race Number R1..RN across meets, or Chronological sequence)
  const chartSlots = useMemo(() => {
    if (selectedCombinedMeetings.length === 1) {
      const singleMtg = selectedCombinedMeetings[0];
      return singleMtg.races.map((r) => ({
        slotNumber: r.raceNumber,
        shortLabel: `R${r.raceNumber}`,
        title: `${singleMtg.venue} R${r.raceNumber} — ${r.raceName}`,
        subLabel: r.startTime,
        isOfficiallyCompleted: isRaceOfficialOrCompleted(r, singleMtg.date),
        items: [{ meeting: singleMtg, race: r, cardIndex: 0 }],
      }));
    }

    if (multiMeetView === "chronological") {
      const flat: Array<{
        meeting: RaceMeeting;
        race: RaceMeeting["races"][0];
        cardIndex: number;
      }> = [];
      selectedCombinedMeetings.forEach((m, cIdx) => {
        for (const r of m.races) {
          flat.push({ meeting: m, race: r, cardIndex: cIdx });
        }
      });
      flat.sort((a, b) => {
        const tA = a.race.startTime || "99:99";
        const tB = b.race.startTime || "99:99";
        if (tA !== tB) return tA.localeCompare(tB);
        return a.race.raceNumber - b.race.raceNumber;
      });
      return flat.map((entry, idx) => {
        const code = (
          entry.meeting.meetingCode || entry.meeting.venue.slice(0, 3)
        ).toUpperCase();
        return {
          slotNumber: idx + 1,
          shortLabel: `${code} R${entry.race.raceNumber}`,
          title: `${entry.meeting.venue} R${entry.race.raceNumber}: ${entry.race.raceName}`,
          subLabel: entry.race.startTime,
          isOfficiallyCompleted: isRaceOfficialOrCompleted(
            entry.race,
            entry.meeting.date
          ),
          items: [entry],
        };
      });
    }

    // Default Multi-Meet Mode: Stack by Race Number (R1∑, R2∑, ..., RN∑)
    const maxRaces = Math.max(
      1,
      ...selectedCombinedMeetings.map((m) =>
        m.races.reduce((acc, r) => Math.max(acc, r.raceNumber), 0)
      )
    );
    const slots = [];
    for (let rNo = 1; rNo <= maxRaces; rNo++) {
      const items: Array<{
        meeting: RaceMeeting;
        race: RaceMeeting["races"][0];
        cardIndex: number;
      }> = [];
      selectedCombinedMeetings.forEach((m, cIdx) => {
        const found = m.races.find((r) => r.raceNumber === rNo);
        if (found) items.push({ meeting: m, race: found, cardIndex: cIdx });
      });
      if (items.length === 0) continue;
      const completedCount = items.filter((it) =>
        isRaceOfficialOrCompleted(it.race, it.meeting.date)
      ).length;
      const venueBreakdown = items
        .map((it) => `${it.meeting.venue} (${it.race.startTime})`)
        .join(" + ");
      slots.push({
        slotNumber: rNo,
        shortLabel: `R${rNo}∑`,
        title: `Stacked Race ${rNo} (${venueBreakdown})`,
        subLabel: `${completedCount}/${items.length} Done`,
        isOfficiallyCompleted: completedCount > 0,
        items,
      });
    }
    return slots;
  }, [multiMeetView, selectedCombinedMeetings]);

  const maxOfficialSlot = useMemo(() => {
    const completedNums = chartSlots
      .filter((s) => s.isOfficiallyCompleted)
      .map((s) => s.slotNumber);
    if (completedNums.length === 0) return 0;
    return Math.max(...completedNums);
  }, [chartSlots]);

  const [completedUpToRace, setCompletedUpToRace] = useState<number>(
    maxOfficialSlot
  );
  const [selectedRaceFocus, setSelectedRaceFocus] = useState<number | null>(
    null
  );
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  useEffect(() => {
    setCompletedUpToRace(maxOfficialSlot);
    setSelectedRaceFocus(null);
    setIsAutoPlaying(false);
  }, [
    meeting.id,
    combineMultiMeets,
    multiMeetView,
    combinedMeetingIds.join(","),
    maxOfficialSlot,
  ]);

  useEffect(() => {
    setCompletedUpToRace((prev) => Math.max(prev, maxOfficialSlot));
  }, [maxOfficialSlot]);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const totalSlots = chartSlots.length;
    const timer = setInterval(() => {
      setCompletedUpToRace((prev) => {
        if (prev >= totalSlots) {
          setIsAutoPlaying(false);
          return totalSlots;
        }
        const nextSlot = prev + 1;
        onPushRaceResultNotification?.(nextSlot);
        return nextSlot;
      });
    }, 1400);
    return () => clearInterval(timer);
  }, [isAutoPlaying, chartSlots.length, onPushRaceResultNotification]);

  // Build progressive per-slot (with stacked segments per racecard!) and cumulative series for every user
  const progressiveSeries = useMemo(() => {
    return allPunters.map((punter, uIdx) => {
      const palette = USER_PALETTE[uIdx % USER_PALETTE.length];
      let runningPoints = 0;
      let runningDollars = 0;
      const runningCardPoints: Record<string, number> = {};
      const runningCardDollars: Record<string, number> = {};

      const slotPointsAndDollars = chartSlots.map((slot) => {
        const isSlotWithinCutoff = slot.slotNumber <= completedUpToRace;
        const isSlotCompleted =
          isSlotWithinCutoff && (slot.isOfficiallyCompleted || isAutoPlaying);

        let slotPts = 0;
        let slotDlrs = 0;
        let hasSelectionInSlot = false;
        const perVenueDetails: string[] = [];
        const stackedSegments: Array<{
          meetingId: string;
          venue: string;
          state: string;
          cardIndex: number;
          raceNumber: number;
          points: number;
          dollars: number;
          cumulativeCardPoints: number;
          cumulativeCardDollars: number;
        }> = [];

        for (const { meeting: m, race: r, cardIndex } of slot.items) {
          const mSel = getPunterSelectionsForMeeting(punter, m);
          const jokerRace = getPunterJokerForMeeting(punter, m);
          const trio = mSel[r.raceNumber];
          const ev = evaluateRaceTrio(
            r,
            trio,
            m.date,
            jokerRace === r.raceNumber
          );
          if (ev.hasAnySelection) {
            hasSelectionInSlot = true;
          }
          const itemDone =
            isSlotWithinCutoff &&
            (isRaceOfficialOrCompleted(r, m.date) || isAutoPlaying);
          const segPts = itemDone && ev.hasAnySelection ? ev.racePointsTally : 0;
          const segDlrs =
            itemDone && ev.hasAnySelection
              ? Number((ev.raceDollarReturn ?? 0).toFixed(2))
              : 0;

          if (itemDone) {
            slotPts += segPts;
            slotDlrs = Number((slotDlrs + segDlrs).toFixed(2));
            runningCardPoints[m.id] = (runningCardPoints[m.id] || 0) + segPts;
            runningCardDollars[m.id] = Number(
              ((runningCardDollars[m.id] || 0) + segDlrs).toFixed(2)
            );
          }

          stackedSegments.push({
            meetingId: m.id,
            venue: m.venue,
            state: m.state,
            cardIndex,
            raceNumber: r.raceNumber,
            points: segPts,
            dollars: segDlrs,
            cumulativeCardPoints: runningCardPoints[m.id] || 0,
            cumulativeCardDollars: runningCardDollars[m.id] || 0,
          });

          const code = (m.meetingCode || m.venue.slice(0, 3)).toUpperCase();
          perVenueDetails.push(
            `${code} R${r.raceNumber}: ${
              itemDone
                ? `${segPts}p / ${formatDollarReturn(segDlrs)} (Card Cumul: ${
                    runningCardPoints[m.id] || 0
                  }p)`
                : "Pending"
            }`
          );
        }

        if (isSlotCompleted) {
          runningPoints += slotPts;
          runningDollars = Number((runningDollars + slotDlrs).toFixed(2));
        }

        return {
          raceNumber: slot.slotNumber,
          shortLabel: slot.shortLabel,
          raceName: slot.title,
          startTime: slot.subLabel,
          isCompleted: isSlotCompleted,
          hasSelectionInSlot,
          racePoints: slotPts,
          cumulativePoints: isSlotCompleted ? runningPoints : null,
          raceDollars: slotDlrs,
          cumulativeDollars: isSlotCompleted ? runningDollars : null,
          stackedSegments,
          perVenueSummary: perVenueDetails.join(" · "),
        };
      });

      return {
        punter,
        palette,
        pointsToDate: runningPoints,
        dollarsToDate: runningDollars,
        data: slotPointsAndDollars,
      };
    });
  }, [allPunters, chartSlots, completedUpToRace, isAutoPlaying]);

  const anyUserHasSelectionsInScope = useMemo(() => {
    return progressiveSeries.some((s) =>
      s.data.some((d) => d.hasSelectionInSlot)
    );
  }, [progressiveSeries]);

  const { maxPointsScale, maxDollarsScale } = useMemo(() => {
    let maxPts = 6;
    let maxDlrs = 10;
    for (const s of progressiveSeries) {
      for (const d of s.data) {
        if (d.cumulativePoints !== null && d.cumulativePoints > maxPts) {
          maxPts = d.cumulativePoints;
        }
        if (d.racePoints > maxPts) {
          maxPts = d.racePoints;
        }
        if (d.cumulativeDollars !== null && d.cumulativeDollars > maxDlrs) {
          maxDlrs = d.cumulativeDollars;
        }
        if (d.raceDollars > maxDlrs) {
          maxDlrs = d.raceDollars;
        }
      }
    }
    return {
      maxPointsScale: Math.ceil(maxPts * 1.15),
      maxDollarsScale: Math.ceil(maxDlrs * 1.15),
    };
  }, [progressiveSeries]);

  const activeInspectedRaceNumber = useMemo(() => {
    if (selectedRaceFocus !== null) return selectedRaceFocus;
    return completedUpToRace || chartSlots[0]?.slotNumber || 1;
  }, [selectedRaceFocus, completedUpToRace, chartSlots]);

  const numSlots = Math.max(chartSlots.length, 1);
  const svgWidth = Math.max(960, numSlots * 76);
  const svgHeight = 335;
  const padLeft = 56;
  const padRight = 64;
  const padTop = 28;
  const padBottom = 50;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const slotWidth = plotW / numSlots;

  const getRaceCenterX = (raceIdx: number) =>
    padLeft + slotWidth * raceIdx + slotWidth / 2;

  const getPointsY = (pts: number) =>
    padTop + plotH - (Math.max(0, pts) / maxPointsScale) * plotH;

  const getDollarsY = (dlrs: number) =>
    padTop + plotH - (Math.max(0, dlrs) / maxDollarsScale) * plotH;

  const yGridTicks = [0, 0.25, 0.5, 0.75, 1];

  const isMultiCardActive = selectedCombinedMeetings.length > 1;
  const combinedTitleText = isMultiCardActive
    ? `Stacked Multi-Racecard & Cumulative Results Graph (${selectedCombinedMeetings
        .map((m) => m.venue)
        .join(" + ")})`
    : `Progressive Race-by-Race & Cumulative Results Chart — ${selectedCombinedMeetings[0]?.venue} (${selectedCombinedMeetings[0]?.date})`;

  return (
    <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg overflow-hidden">
      {/* Top Bar: Chart Title + Stack Racecards Toggle + Metric Mode Toggle */}
      <div className="p-4 border-b border-[#1F2D26] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
              <h2 className="text-sm font-semibold text-[#F3F4F0]">
                {combinedTitleText}
              </h2>
            </div>
            <p className="text-xs text-[#8A9990]">
              {anyUserHasSelectionsInScope ? (
                <>
                  Bars show{" "}
                  <span className="text-[#F3F4F0]">
                    {isMultiCardActive
                      ? "stacked individual racecard scores per race"
                      : "each individual race score"}
                  </span>{" "}
                  · Connected lines track{" "}
                  <span className="text-[#F3F4F0]">
                    {isMultiCardActive
                      ? "combined cumulative scores across all selected racecards"
                      : "cumulative total score to date"}
                  </span>
                  .
                </>
              ) : (
                <span className="text-[#D4AF37]">
                  Showing {maxOfficialSlot}/{chartSlots.length} completed{" "}
                  {isMultiCardActive ? "stacked race slots" : "races"} — enter
                  user selections to plot live individual &amp; cumulative scores.
                </span>
              )}
            </p>
          </div>

          {/* Toggle Switch for Stacking Multiple Racecards + 3-Way Metric Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={combineMultiMeets}
              onClick={handleToggleMultiMeets}
              className={`min-h-[36px] px-3 py-1.5 rounded-md border text-xs font-semibold transition-all flex items-center gap-2.5 cursor-pointer ${
                combineMultiMeets
                  ? "bg-[#152920] border-[#10B981] text-[#10B981] shadow-sm"
                  : "bg-[#0B110E] border-[#2B3E34] text-[#D5DDD8] hover:border-[#D4AF37]"
              }`}
              title="Toggle switch to stack 1 or more racecards and display both individual and cumulative scores"
            >
              <span
                className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
                  combineMultiMeets ? "bg-[#10B981]" : "bg-[#26382E]"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-[#0B110E] transition-transform ${
                    combineMultiMeets ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>
                {combineMultiMeets
                  ? `Stacking ${selectedCombinedMeetings.length} Racecard${
                      selectedCombinedMeetings.length > 1 ? "s" : ""
                    } (Indiv + Cumul)`
                  : "Stack & Combine Multiple Racecards"}
              </span>
            </button>

            <div
              role="group"
              aria-label="Chart Metric Toggle: Points, Dollar Return, or Both"
              className="flex items-center p-1 bg-[#0B110E] border border-[#1F2D26] rounded-md"
            >
              <button
                type="button"
                onClick={() => {
                  setChartMode("points");
                  onSyncGlobalMode?.("points");
                }}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  chartMode === "points"
                    ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Points</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChartMode("dollars");
                  onSyncGlobalMode?.("dollars");
                }}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  chartMode === "dollars"
                    ? "bg-[#10B981] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>$ Return</span>
              </button>

              <button
                type="button"
                onClick={() => setChartMode("both")}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  chartMode === "both"
                    ? "bg-[#192620] text-[#F3F4F0] border border-[#D4AF37] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Both (Pts + $)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Always-Visible Racecard Stack Selector Bar (1 or more racecards) */}
        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26] space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <RaceCardMultiSelectDropdown
                meetings={allAvailableMeetings}
                selectedMeetingIds={selectedCombinedMeetings.map((m) => m.id)}
                onChangeSelectedMeetingIds={updateChartSelectedIds}
                punters={allPunters}
                labelPrefix="Graph Race Cards"
                compact
              />

              <button
                type="button"
                onClick={() => updateChartSelectedIds([meeting.id])}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer border ${
                  selectedCombinedMeetings.length === 1
                    ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37]"
                    : "bg-[#121A16] border-[#1F2D26] text-[#9BA8A1] hover:text-white"
                }`}
              >
                Single Card ({meeting.venue})
              </button>
              <button
                type="button"
                onClick={() => {
                  const { combinedRequiredMeetings } =
                    getSydneyAndMelbourneMeetings(allAvailableMeetings);
                  if (combinedRequiredMeetings.length > 0) {
                    updateChartSelectedIds(
                      combinedRequiredMeetings.map((m) => m.id)
                    );
                  }
                }}
                className="px-2.5 py-1 rounded bg-[#16241D] border border-[#D4AF37]/50 text-[#D4AF37] text-[11px] font-mono font-semibold hover:bg-[#1E3127] cursor-pointer"
              >
                Stack Sydney + Melbourne
              </button>
              <button
                type="button"
                onClick={() => {
                  const withPicks = allAvailableMeetings
                    .filter((m) =>
                      allPunters.some((p) => {
                        const map = getPunterSelectionsForMeeting(p, m);
                        return Object.values(map).some(
                          (t) =>
                            t &&
                            (t.firstPref !== null ||
                              t.secondPref !== null ||
                              t.thirdPref !== null)
                        );
                      })
                    )
                    .map((m) => m.id);
                  if (withPicks.length > 0) {
                    updateChartSelectedIds(withPicks);
                  } else {
                    updateChartSelectedIds(
                      allAvailableMeetings.map((m) => m.id)
                    );
                  }
                }}
                className="px-2.5 py-1 rounded bg-[#16241D] border border-[#10B981]/40 text-[#10B981] text-[11px] font-mono font-semibold hover:bg-[#1E3127] cursor-pointer"
              >
                Stack All Cards With Picks
              </button>
              <button
                type="button"
                onClick={() =>
                  updateChartSelectedIds(allAvailableMeetings.map((m) => m.id))
                }
                className="px-2.5 py-1 rounded bg-[#121A16] border border-[#1F2D26] text-[#D5DDD8] text-[11px] font-mono hover:border-[#D4AF37] cursor-pointer"
              >
                Stack All ({allAvailableMeetings.length} Cards)
              </button>
            </div>

            {isMultiCardActive && (
              <div className="flex items-center p-1 bg-[#121A16] border border-[#1F2D26] rounded-md self-start">
                <button
                  type="button"
                  onClick={() => setMultiMeetView("by_race_number")}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    multiMeetView === "by_race_number"
                      ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                      : "text-[#8A9990] hover:text-[#F3F4F0]"
                  }`}
                >
                  Stacked by Race # (R1∑, R2∑...)
                </button>
                <button
                  type="button"
                  onClick={() => setMultiMeetView("chronological")}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    multiMeetView === "chronological"
                      ? "bg-[#10B981] text-[#0B110E] font-bold"
                      : "text-[#8A9990] hover:text-[#F3F4F0]"
                  }`}
                >
                  Chronological All Races
                </button>
              </div>
            )}
          </div>

          {/* Clickable Racecard Checkboxes to Add/Stack 1 or More Racecards */}
          <div className="flex flex-wrap items-center gap-1.5">
            {allAvailableMeetings.map((m) => {
              const isIncluded = selectedCombinedMeetings.some(
                (sel) => sel.id === m.id
              );
              const doneCount = m.races.filter((r) =>
                isRaceOfficialOrCompleted(r, m.date)
              ).length;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMeetingInCombinedPool(m.id)}
                  className={`min-h-[32px] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer ${
                    isIncluded
                      ? "bg-[#152920] text-[#10B981] border-[#10B981] font-semibold"
                      : "bg-[#121A16] text-[#8A9990] border-[#1F2D26] hover:text-[#F3F4F0]"
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      isIncluded ? "text-[#10B981]" : "text-[#8A9990]/40"
                    }`}
                  />
                  <span className="font-mono text-[10px] text-[#D4AF37]">
                    {m.state}
                  </span>
                  <span>{m.venue}</span>
                  <span className="font-mono text-[10px] opacity-80">
                    ({doneCount}/{m.races.length}R)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Individual Racecard vs. Cumulative Scoreboard Table (When 1+ Racecards Selected) */}
          <div className="pt-2 border-t border-[#1F2D26] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8A9990]">
              <span className="uppercase tracking-wider text-[#D4AF37] font-bold">
                {isMultiCardActive
                  ? `Individual Racecard Scores & Combined Cumulative Totals (${selectedCombinedMeetings.length} Racecards Stacked)`
                  : `Racecard Score & Cumulative Total (${selectedCombinedMeetings[0]?.venue})`}
              </span>
              <span>
                Showing both individual racecard scores and cumulative total across selected cards
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {perCardUserBreakdown.map((u) => {
                const maxUserPts = Math.max(
                  1,
                  ...perCardUserBreakdown.map((x) => x.cumulativePoints)
                );
                return (
                  <div
                    key={u.punter.id}
                    className="rounded-lg border border-[#1F2D26] bg-[#121A16] p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: u.palette.fill }}
                        />
                        <span className="font-bold text-xs sm:text-sm text-[#F3F4F0]">
                          {u.punter.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-[#8A9990] text-[11px]">
                          Cumulative Total:
                        </span>
                        <span className="font-bold text-[#D4AF37]">
                          {u.cumulativePoints} pts
                        </span>
                        <span className="text-[#8A9990]">·</span>
                        <span className="font-bold text-[#10B981]">
                          {formatDollarReturn(u.cumulativeDollars)}
                        </span>
                      </div>
                    </div>

                    {/* Visual Horizontal Stacked Bar showing each Racecard's share */}
                    <div className="h-3 w-full rounded-full bg-[#0B110E] border border-[#1F2D26] overflow-hidden flex">
                      {u.cardScores.map((cs, idx) => {
                        const widthPct =
                          u.cumulativePoints > 0
                            ? (cs.points / maxUserPts) * 100
                            : 0;
                        if (widthPct <= 0) return null;
                        const opacity =
                          CARD_SEGMENT_OPACITIES[
                            idx % CARD_SEGMENT_OPACITIES.length
                          ];
                        return (
                          <div
                            key={cs.meeting.id}
                            style={{
                              width: `${Math.max(widthPct, 4)}%`,
                              backgroundColor: u.palette.fill,
                              opacity,
                            }}
                            className="h-full border-r border-[#0B110E] transition-all"
                            title={`${cs.meeting.venue} (${cs.meeting.state}): ${cs.points} pts · ${formatDollarReturn(cs.dollars)}`}
                          />
                        );
                      })}
                    </div>

                    {/* Individual Racecard Score Breakdown Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {u.cardScores.map((cs, idx) => (
                        <div
                          key={cs.meeting.id}
                          className="flex items-center justify-between rounded bg-[#0B110E] border border-[#1F2D26] px-2.5 py-1.5 text-[11px] font-mono"
                        >
                          <span className="flex items-center gap-1.5 truncate text-[#D5DDD8]">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{
                                backgroundColor: u.palette.fill,
                                opacity:
                                  CARD_SEGMENT_OPACITIES[
                                    idx % CARD_SEGMENT_OPACITIES.length
                                  ],
                              }}
                            />
                            <span className="truncate font-sans font-semibold">
                              {cs.meeting.venue} ({cs.meeting.state})
                            </span>
                          </span>
                          <span className="shrink-0 ml-2">
                            <strong className="text-[#D4AF37]">
                              {cs.points}p
                            </strong>{" "}
                            ·{" "}
                            <strong className="text-[#10B981]">
                              {formatDollarReturn(cs.dollars)}
                            </strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progressive Race Completion Stepper & Live Cumulative Totals Strip */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2 border-t border-[#1F2D26]/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#8A9990] font-medium mr-1">
              {isMultiCardActive
                ? "Stacked Slots Populated:"
                : "Completed Races Populated:"}
            </span>
            {chartSlots.map((s) => {
              const isPopulated = s.slotNumber <= completedUpToRace;
              const isCurrentCutoff = s.slotNumber === completedUpToRace;
              return (
                <button
                  key={s.slotNumber}
                  type="button"
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCompletedUpToRace(s.slotNumber);
                    setSelectedRaceFocus(s.slotNumber);
                    onPushRaceResultNotification?.(s.slotNumber);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded text-xs font-mono tabular-nums border transition-colors cursor-pointer ${
                    isCurrentCutoff
                      ? "bg-[#D4AF37] text-[#0B110E] border-[#D4AF37] font-bold"
                      : isPopulated
                      ? "bg-[#152920] text-[#10B981] border-[#10B981]/40 font-medium"
                      : "bg-[#0B110E] text-[#8A9990] border-[#1F2D26] opacity-65 hover:opacity-100"
                  }`}
                  title={s.title}
                >
                  {s.shortLabel}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsAutoPlaying(false);
                const nextR =
                  completedUpToRace < chartSlots.length
                    ? completedUpToRace + 1
                    : 1;
                setCompletedUpToRace(nextR);
                setSelectedRaceFocus(nextR);
                onPushRaceResultNotification?.(nextR);
              }}
              className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs text-[#F3F4F0] hover:border-[#D4AF37] transition-colors cursor-pointer"
              title="Populate next completed race and trigger result sound notification"
            >
              <StepForward className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>+1 Race Result</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAutoPlaying) {
                  setIsAutoPlaying(false);
                } else {
                  setCompletedUpToRace(1);
                  onPushRaceResultNotification?.(1);
                  setIsAutoPlaying(true);
                }
              }}
              className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs text-[#10B981] hover:border-[#10B981] transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>{isAutoPlaying ? "Playing..." : "Replay Progression"}</span>
            </button>

            {completedUpToRace < chartSlots.length && (
              <button
                type="button"
                onClick={() => {
                  setIsAutoPlaying(false);
                  setCompletedUpToRace(chartSlots.length);
                }}
                className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs text-[#8A9990] hover:text-[#F3F4F0] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Show All {chartSlots.length} Slots</span>
              </button>
            )}
          </div>

          {/* User Legend & Cumulative Score Callouts through Completed Races */}
          <div className="flex flex-wrap items-center gap-3">
            {progressiveSeries.map((s) => (
              <div
                key={s.punter.id}
                className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs font-mono tabular-nums"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.palette.fill }}
                />
                <span className="font-sans font-semibold text-[#F3F4F0]">
                  {s.punter.name}
                  {isMultiCardActive ? " (Cumul)" : ""}:
                </span>
                {(chartMode === "points" || chartMode === "both") && (
                  <span className="text-[#D4AF37] font-semibold">
                    {s.pointsToDate} pts
                  </span>
                )}
                {chartMode === "both" && (
                  <span className="text-[#8A9990]">·</span>
                )}
                {(chartMode === "dollars" || chartMode === "both") && (
                  <span className="text-[#10B981] font-semibold">
                    {formatDollarReturn(s.dollarsToDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main SVG Combo Chart Canvas: Stacked Individual Racecard Bars + Cumulative Progression Lines */}
      <div className="p-4 bg-[#0D1410] overflow-x-auto">
        <div className="min-w-[680px]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none"
            role="img"
            aria-label={combinedTitleText}
          >
            {yGridTicks.map((ratio, idx) => {
              const y = padTop + plotH - ratio * plotH;
              const ptsVal = Math.round(ratio * maxPointsScale);
              const dlrVal = Math.round(ratio * maxDollarsScale);

              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="#1F2D26"
                    strokeDasharray={ratio === 0 ? undefined : "4 4"}
                    strokeWidth={ratio === 0 ? 1.5 : 1}
                  />
                  {(chartMode === "points" || chartMode === "both") && (
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#D4AF37] font-mono text-[11px]"
                    >
                      {ptsVal}p
                    </text>
                  )}
                  {chartMode === "dollars" && (
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#10B981] font-mono text-[11px]"
                    >
                      ${dlrVal}
                    </text>
                  )}
                  {(chartMode === "both" || chartMode === "dollars") && (
                    <text
                      x={svgWidth - padRight + 10}
                      y={y + 4}
                      textAnchor="start"
                      className="fill-[#10B981] font-mono text-[11px]"
                    >
                      ${dlrVal}
                    </text>
                  )}
                </g>
              );
            })}

            {(chartMode === "points" || chartMode === "both") && (
              <text
                x={padLeft}
                y={16}
                className="fill-[#D4AF37] font-mono text-[10px] font-semibold"
              >
                ▲{" "}
                {isMultiCardActive
                  ? "STACKED INDIVIDUAL CARD POINTS (BARS) & CUMULATIVE POINTS (LINE)"
                  : "INDIVIDUAL RACE POINTS (BAR) & CUMULATIVE POINTS (LINE)"}
              </text>
            )}
            {(chartMode === "dollars" || chartMode === "both") && (
              <text
                x={svgWidth - padRight}
                y={16}
                textAnchor="end"
                className="fill-[#10B981] font-mono text-[10px] font-semibold"
              >
                {isMultiCardActive
                  ? "STACKED INDIVIDUAL CARD $ & CUMULATIVE $ ▲"
                  : "$ RETURN (INDIVIDUAL & CUMULATIVE) ▲"}
              </text>
            )}

            {/* Race Columns, Stacked Per-Card Result Bars, and X-Axis Labels */}
            {chartSlots.map((slot, rIdx) => {
              const centerX = getRaceCenterX(rIdx);
              const isCompleted =
                slot.slotNumber <= completedUpToRace &&
                (slot.isOfficiallyCompleted || isAutoPlaying);
              const isFocused = slot.slotNumber === activeInspectedRaceNumber;

              const numUsers = Math.max(progressiveSeries.length, 1);
              const barsPerUser = chartMode === "both" ? 2 : 1;
              const totalBarsInSlot = numUsers * barsPerUser;
              const barW = Math.min(
                18,
                Math.max(6, (slotWidth * 0.65) / Math.max(totalBarsInSlot, 1))
              );
              const groupW = totalBarsInSlot * barW + (numUsers - 1) * 4;
              const startBarX = centerX - groupW / 2;

              return (
                <g
                  key={slot.slotNumber}
                  onClick={() => setSelectedRaceFocus(slot.slotNumber)}
                  className="cursor-pointer"
                >
                  <rect
                    x={padLeft + slotWidth * rIdx + 2}
                    y={padTop}
                    width={slotWidth - 4}
                    height={plotH}
                    rx={4}
                    fill={
                      isFocused
                        ? "rgba(212, 175, 55, 0.07)"
                        : !isCompleted
                        ? "rgba(11, 17, 14, 0.45)"
                        : "transparent"
                    }
                    stroke={isFocused ? "rgba(212, 175, 55, 0.35)" : "none"}
                  />

                  {!isCompleted && (
                    <text
                      x={centerX}
                      y={padTop + plotH / 2}
                      textAnchor="middle"
                      className="fill-[#8A9990]/50 font-mono text-[10px]"
                    >
                      Pending
                    </text>
                  )}

                  {isCompleted &&
                    progressiveSeries.map((uSeries, uIdx) => {
                      const rData = uSeries.data[rIdx];
                      if (!rData) return null;

                      const userOffset =
                        startBarX + uIdx * (barsPerUser * barW + 4);

                      // Build stacked segments for Points bar
                      let ptsBaseValue = 0;
                      const ptsSegments = rData.stackedSegments.map(
                        (seg, sIdx) => {
                          const bottomVal = ptsBaseValue;
                          const topVal = ptsBaseValue + seg.points;
                          ptsBaseValue = topVal;
                          const yTop = getPointsY(topVal);
                          const yBottom = getPointsY(bottomVal);
                          return {
                            ...seg,
                            y: yTop,
                            h: Math.max(seg.points > 0 ? 2 : 0, yBottom - yTop),
                            opacity:
                              CARD_SEGMENT_OPACITIES[
                                sIdx % CARD_SEGMENT_OPACITIES.length
                              ],
                          };
                        }
                      );

                      // Build stacked segments for Dollars bar
                      let dlrBaseValue = 0;
                      const dlrSegments = rData.stackedSegments.map(
                        (seg, sIdx) => {
                          const bottomVal = dlrBaseValue;
                          const topVal = Number(
                            (dlrBaseValue + seg.dollars).toFixed(2)
                          );
                          dlrBaseValue = topVal;
                          const yTop = getDollarsY(topVal);
                          const yBottom = getDollarsY(bottomVal);
                          return {
                            ...seg,
                            y: yTop,
                            h: Math.max(seg.dollars > 0 ? 2 : 0, yBottom - yTop),
                            opacity:
                              CARD_SEGMENT_OPACITIES[
                                sIdx % CARD_SEGMENT_OPACITIES.length
                              ],
                          };
                        }
                      );

                      return (
                        <g key={uSeries.punter.id}>
                          {(chartMode === "points" || chartMode === "both") &&
                            (ptsBaseValue > 0 ? (
                              ptsSegments.map((seg) =>
                                seg.h > 0 ? (
                                  <rect
                                    key={`pt-seg-${seg.meetingId}-${seg.raceNumber}`}
                                    x={userOffset}
                                    y={seg.y}
                                    width={barW - 1}
                                    height={seg.h}
                                    rx={1.5}
                                    fill={uSeries.palette.fill}
                                    fillOpacity={seg.opacity}
                                    stroke={uSeries.palette.stroke}
                                    strokeWidth={0.9}
                                  >
                                    <title>
                                      {`${uSeries.punter.name} — ${seg.venue} R${seg.raceNumber} Individual: ${seg.points} pts | Slot Total: ${rData.racePoints} pts | Overall Cumulative: ${rData.cumulativePoints} pts`}
                                    </title>
                                  </rect>
                                ) : null
                              )
                            ) : (
                              <rect
                                x={userOffset}
                                y={padTop + plotH - 2}
                                width={barW - 1}
                                height={2}
                                fill={uSeries.palette.fill}
                                fillOpacity={0.25}
                              />
                            ))}

                          {(chartMode === "dollars" || chartMode === "both") &&
                            (dlrBaseValue > 0 ? (
                              dlrSegments.map((seg) =>
                                seg.h > 0 ? (
                                  <rect
                                    key={`dlr-seg-${seg.meetingId}-${seg.raceNumber}`}
                                    x={
                                      chartMode === "both"
                                        ? userOffset + barW
                                        : userOffset
                                    }
                                    y={seg.y}
                                    width={barW - 1}
                                    height={seg.h}
                                    rx={1.5}
                                    fill={uSeries.palette.fill}
                                    fillOpacity={seg.opacity}
                                    stroke="#10B981"
                                    strokeWidth={0.9}
                                  >
                                    <title>
                                      {`${uSeries.punter.name} — ${seg.venue} R${seg.raceNumber} Individual: ${formatDollarReturn(seg.dollars)} | Slot Total: ${formatDollarReturn(rData.raceDollars)} | Overall Cumulative: ${formatDollarReturn(rData.cumulativeDollars || 0)}`}
                                    </title>
                                  </rect>
                                ) : null
                              )
                            ) : (
                              <rect
                                x={
                                  chartMode === "both"
                                    ? userOffset + barW
                                    : userOffset
                                }
                                y={padTop + plotH - 2}
                                width={barW - 1}
                                height={2}
                                fill={uSeries.palette.fill}
                                fillOpacity={0.25}
                              />
                            ))}
                        </g>
                      );
                    })}

                  <text
                    x={centerX}
                    y={svgHeight - 24}
                    textAnchor="middle"
                    className={`font-mono text-[10px] ${
                      isFocused
                        ? "fill-[#D4AF37] font-bold"
                        : isCompleted
                        ? "fill-[#F3F4F0] font-semibold"
                        : "fill-[#8A9990]"
                    }`}
                  >
                    {slot.shortLabel}
                  </text>
                  <text
                    x={centerX}
                    y={svgHeight - 9}
                    textAnchor="middle"
                    className="fill-[#8A9990] font-mono text-[9px]"
                  >
                    {isCompleted ? slot.subLabel : "Upcoming"}
                  </text>
                </g>
              );
            })}

            {/* Cumulative Progression Lines & Nodes for Each User */}
            {progressiveSeries.map((uSeries) => {
              const completedPoints = uSeries.data
                .map((d, idx) => ({ ...d, idx }))
                .filter((d) => d.isCompleted);

              if (completedPoints.length === 0) return null;

              const pointsPath = completedPoints
                .map((d, i) => {
                  const x = getRaceCenterX(d.idx);
                  const y = getPointsY(d.cumulativePoints || 0);
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ");

              const dollarsPath = completedPoints
                .map((d, i) => {
                  const x = getRaceCenterX(d.idx);
                  const y = getDollarsY(d.cumulativeDollars || 0);
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ");

              return (
                <g key={`lines-${uSeries.punter.id}`}>
                  {(chartMode === "points" || chartMode === "both") && (
                    <>
                      <path
                        d={pointsPath}
                        fill="none"
                        stroke={uSeries.palette.stroke}
                        strokeWidth={2.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {completedPoints.map((d) => {
                        const cx = getRaceCenterX(d.idx);
                        const cy = getPointsY(d.cumulativePoints || 0);
                        const isLast =
                          d.raceNumber ===
                          completedPoints[completedPoints.length - 1]
                            .raceNumber;
                        return (
                          <g key={`pt-node-${d.raceNumber}`}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isLast ? 5 : 3.8}
                              fill="#0B110E"
                              stroke={uSeries.palette.stroke}
                              strokeWidth={2.5}
                            >
                              <title>
                                {`${uSeries.punter.name} — Individual Slot: +${d.racePoints} pts | Cumulative: ${d.cumulativePoints} pts`}
                              </title>
                            </circle>
                            {isLast && (
                              <text
                                x={cx}
                                y={cy - 9}
                                textAnchor="middle"
                                className="font-mono text-[10px] font-bold"
                                fill={uSeries.palette.stroke}
                              >
                                {d.cumulativePoints}p
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}

                  {(chartMode === "dollars" || chartMode === "both") && (
                    <>
                      <path
                        d={dollarsPath}
                        fill="none"
                        stroke={uSeries.palette.stroke}
                        strokeWidth={chartMode === "dollars" ? 2.75 : 2.25}
                        strokeDasharray={
                          chartMode === "both" ? "5 4" : undefined
                        }
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {completedPoints.map((d) => {
                        const cx = getRaceCenterX(d.idx);
                        const cy = getDollarsY(d.cumulativeDollars || 0);
                        const isLast =
                          d.raceNumber ===
                          completedPoints[completedPoints.length - 1]
                            .raceNumber;
                        return (
                          <g key={`dlr-node-${d.raceNumber}`}>
                            <rect
                              x={cx - 3.5}
                              y={cy - 3.5}
                              width={7}
                              height={7}
                              rx={1.5}
                              fill="#0B110E"
                              stroke={uSeries.palette.stroke}
                              strokeWidth={2}
                            >
                              <title>
                                {`${uSeries.punter.name} — Individual Slot: ${formatDollarReturn(
                                  d.raceDollars
                                )} | Cumulative: ${formatDollarReturn(
                                  d.cumulativeDollars || 0
                                )}`}
                              </title>
                            </rect>
                            {isLast && (
                              <text
                                x={cx}
                                y={chartMode === "both" ? cy + 15 : cy - 9}
                                textAnchor="middle"
                                className="font-mono text-[10px] font-bold"
                                fill={uSeries.palette.stroke}
                              >
                                {formatDollarReturn(d.cumulativeDollars || 0)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Synchronized Individual & Cumulative Race Slot Inspector */}
      <div className="px-4 py-3 bg-[#0B110E] border-t border-[#1F2D26] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold text-[#D4AF37]">
            INSPECTING{" "}
            {isMultiCardActive
              ? `STACKED SLOT #${activeInspectedRaceNumber}`
              : `RACE ${activeInspectedRaceNumber}`}
            :
          </span>
          <span className="text-[#F3F4F0] font-medium">
            {chartSlots.find(
              (s) => s.slotNumber === activeInspectedRaceNumber
            )?.title || `Race ${activeInspectedRaceNumber}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {progressiveSeries.map((uSeries) => {
            const rItem = uSeries.data.find(
              (d) => d.raceNumber === activeInspectedRaceNumber
            );
            if (!rItem) return null;

            return (
              <div
                key={`inspect-${uSeries.punter.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-1.5 px-3 py-1.5 rounded bg-[#121A16] border border-[#1F2D26] font-mono tabular-nums"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: uSeries.palette.fill }}
                  />
                  <span className="font-sans font-semibold text-[#F3F4F0]">
                    {uSeries.punter.name}
                  </span>
                </div>
                {rItem.isCompleted ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(chartMode === "points" || chartMode === "both") && (
                      <span className="text-[#D4AF37]">
                        Indiv: +{rItem.racePoints}p (Cumul:{" "}
                        <strong>{rItem.cumulativePoints}p</strong>)
                      </span>
                    )}
                    {chartMode === "both" && (
                      <span className="text-[#8A9990]">|</span>
                    )}
                    {(chartMode === "dollars" || chartMode === "both") && (
                      <span className="text-[#10B981]">
                        Indiv: {formatDollarReturn(rItem.raceDollars)} (Cumul:{" "}
                        <strong>
                          {formatDollarReturn(rItem.cumulativeDollars || 0)}
                        </strong>
                        )
                      </span>
                    )}
                    {isMultiCardActive && rItem.perVenueSummary && (
                      <span className="text-[10px] text-[#8A9990]">
                        [{rItem.perVenueSummary}]
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[#8A9990]">Race Pending</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
