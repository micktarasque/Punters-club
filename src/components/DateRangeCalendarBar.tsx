import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react";
import { PunterProfile, RaceMeeting } from "../types/racing";
import {
  getCurrentAustralianDateIso,
  getCurrentSydneyClock,
  normalizeAustralianDateIso,
  getMaxAllowedDateIso,
  isDateBeyond5DaysAhead,
} from "../data/seedNswTab";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";

interface DateRangeCalendarBarProps {
  dateMode: "single" | "range";
  onDateModeChange: (mode: "single" | "range") => void;
  selectedDate: string;
  endDate: string;
  onDateSelect: (startDate: string, endDate: string) => void;
  trackFilter: string;
  onTrackFilterChange: (track: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters?: PunterProfile[];
  availableMeetingsForDate?: RaceMeeting[];
  availableTracksForDate?: RaceMeeting[];
  autoScrapeOnDateChange: boolean;
  onToggleAutoScrape: () => void;
  onTriggerScrape: (startDate?: string, endDate?: string, venue?: string) => void;
  isScraping: boolean;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const clean = normalizeAustralianDateIso(isoDate);
  const [y, m, d] = clean.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function formatReadableDate(isoDate: string): string {
  const clean = normalizeAustralianDateIso(isoDate);
  const [y, m, d] = clean.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const DateRangeCalendarBar: React.FC<DateRangeCalendarBarProps> = ({
  dateMode,
  onDateModeChange,
  selectedDate,
  endDate,
  onDateSelect,
  trackFilter,
  onTrackFilterChange,
  selectedMeetingIds = [],
  onChangeSelectedMeetingIds,
  punters = [],
  availableMeetingsForDate,
  availableTracksForDate,
  autoScrapeOnDateChange,
  onToggleAutoScrape,
  onTriggerScrape,
  isScraping,
}) => {
  const meetingsList = availableMeetingsForDate ?? availableTracksForDate ?? [];
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rangePickingStep, setRangePickingStep] = useState<"start" | "end">("start");
  const [sydneyClock, setSydneyClock] = useState(() => getCurrentSydneyClock());

  useEffect(() => {
    const timer = setInterval(() => {
      setSydneyClock(getCurrentSydneyClock());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todaySydneyIso = sydneyClock.dateIso || getCurrentAustralianDateIso();
  const normalizedSelectedDate = normalizeAustralianDateIso(selectedDate);
  const normalizedEndDate = normalizeAustralianDateIso(endDate);

  const initialMonthParts = normalizedSelectedDate.split("-").map(Number);
  const [viewYear, setViewYear] = useState(initialMonthParts[0] || 2026);
  const [viewMonth, setViewMonth] = useState((initialMonthParts[1] || 10) - 1);

  useEffect(() => {
    const parts = normalizedSelectedDate.split("-").map(Number);
    if (parts[0] && parts[1]) {
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    }
  }, [normalizedSelectedDate]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startWeekday = firstDayOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ iso: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(viewMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({ iso: `${viewYear}-${mm}-${dd}`, dayNum: d });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const monthTitle = useMemo(() => {
    const dt = new Date(Date.UTC(viewYear, viewMonth, 1));
    return dt.toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [viewYear, viewMonth]);

  const maxAllowedDate = getMaxAllowedDateIso(todaySydneyIso);

  const handleDayClick = (iso: string) => {
    if (isDateBeyond5DaysAhead(iso, todaySydneyIso)) {
      return;
    }
    onTrackFilterChange("");
    if (dateMode === "single") {
      onDateSelect(iso, iso);
      setCalendarOpen(false);
      if (autoScrapeOnDateChange) {
        onTriggerScrape(iso, iso, "");
      }
    } else {
      if (rangePickingStep === "start") {
        onDateSelect(iso, iso);
        setRangePickingStep("end");
      } else {
        const start = iso < normalizedSelectedDate ? iso : normalizedSelectedDate;
        const rawEnd = iso < normalizedSelectedDate ? normalizedSelectedDate : iso;
        const end = rawEnd > maxAllowedDate ? maxAllowedDate : rawEnd;
        onDateSelect(start, end);
        setRangePickingStep("start");
        setCalendarOpen(false);
        if (autoScrapeOnDateChange) {
          onTriggerScrape(start, end, "");
        }
      }
    }
  };

  const handleStepDate = (delta: number) => {
    onTrackFilterChange("");
    const rawNextStart = shiftIsoDate(normalizedSelectedDate, delta);
    if (rawNextStart > maxAllowedDate) return;
    const nextStart = rawNextStart;
    const rawNextEnd = dateMode === "range" ? shiftIsoDate(normalizedEndDate, delta) : nextStart;
    const nextEnd = rawNextEnd > maxAllowedDate ? maxAllowedDate : rawNextEnd;
    onDateSelect(nextStart, nextEnd);
    if (autoScrapeOnDateChange) {
      onTriggerScrape(nextStart, nextEnd, "");
    }
  };

  const applyPresetRange = (
    startIso: string,
    endIso: string,
    mode: "single" | "range"
  ) => {
    const normStart = normalizeAustralianDateIso(startIso);
    const normEnd = normalizeAustralianDateIso(endIso);
    onTrackFilterChange("");
    onDateModeChange(mode);
    onDateSelect(normStart, normEnd);
    setCalendarOpen(false);
    if (autoScrapeOnDateChange) {
      onTriggerScrape(normStart, normEnd, "");
    }
  };

  return (
    <div className="relative bg-[#121A16] border border-[#1F2D26] rounded-lg p-4">
      {/* Top Calibrated Sydney Time Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1F2D26]/80 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0B110E] border border-[#10B981]/40 text-[#10B981] font-mono font-medium">
            <Clock className="w-3.5 h-3.5 text-[#10B981]" />
            <span>
              SYDNEY ({sydneyClock.tzAbbr}): {sydneyClock.shortDateStr} • {sydneyClock.timeStr}
            </span>
          </span>
          <span className="text-[#8A9990]">
            Viewing:{" "}
            <strong className="text-[#F3F4F0] font-mono">
              {dateMode === "single"
                ? `${formatReadableDate(normalizedSelectedDate)} (${normalizedSelectedDate})`
                : `${formatReadableDate(normalizedSelectedDate)} → ${formatReadableDate(normalizedEndDate)}`}
            </strong>
            {normalizedSelectedDate === todaySydneyIso && dateMode === "single" && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                Calibrated to Live Sydney Today
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {normalizedSelectedDate !== todaySydneyIso && (
            <button
              type="button"
              onClick={() => applyPresetRange(todaySydneyIso, todaySydneyIso, "single")}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#10B981]/20 border border-[#10B981] text-[#10B981] hover:bg-[#10B981]/30 transition-colors cursor-pointer"
            >
              Jump to Today ({formatReadableDate(todaySydneyIso)})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Mode Toggle + Interactive Date / Date Range Picker */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Single Date vs Date Range Segmented Control */}
          <div className="flex items-center p-1 bg-[#0B110E] border border-[#1F2D26] rounded-md">
            <button
              type="button"
              onClick={() => {
                onDateModeChange("single");
                onDateSelect(normalizedSelectedDate, normalizedSelectedDate);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                dateMode === "single"
                  ? "bg-[#1C2A23] text-[#F3F4F0]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Single Date
            </button>
            <button
              type="button"
              onClick={() => {
                onDateModeChange("range");
                if (normalizedEndDate === normalizedSelectedDate) {
                  const defaultStart = shiftIsoDate(normalizedSelectedDate, -2);
                  onDateSelect(defaultStart, normalizedSelectedDate);
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                dateMode === "range"
                  ? "bg-[#1C2A23] text-[#F3F4F0]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Date Range
            </button>
          </div>

          {/* Stepper + Calendar Trigger */}
          <div className="flex items-center bg-[#0B110E] border border-[#1F2D26] rounded-md">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center p-2 text-[#8A9990] hover:text-[#F3F4F0] transition-colors cursor-pointer"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCalendarOpen((prev) => !prev)}
              className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-[#F3F4F0] hover:bg-[#16201B] transition-colors whitespace-nowrap border-x border-[#1F2D26] cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="font-mono tabular-nums">
                {dateMode === "single"
                  ? `${formatReadableDate(normalizedSelectedDate)} (${normalizedSelectedDate})`
                  : `${formatReadableDate(normalizedSelectedDate)} → ${formatReadableDate(normalizedEndDate)}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleStepDate(1)}
              className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center p-2 text-[#8A9990] hover:text-[#F3F4F0] transition-colors cursor-pointer"
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Direct Native Date Input(s) with 5-Day Ahead Limit */}
          <div className="flex items-center gap-2 text-xs text-[#8A9990]">
            <input
              type="date"
              value={normalizedSelectedDate}
              max={maxAllowedDate}
              onChange={(e) => {
                if (!e.target.value) return;
                const val =
                  e.target.value > maxAllowedDate
                    ? maxAllowedDate
                    : e.target.value;
                onTrackFilterChange("");
                const newEnd =
                  dateMode === "single" || val > normalizedEndDate ? val : normalizedEndDate;
                onDateSelect(val, newEnd);
                if (autoScrapeOnDateChange) {
                  onTriggerScrape(val, newEnd, "");
                }
              }}
              aria-label="Start or Single Race Date"
              className="bg-[#0B110E] border border-[#1F2D26] rounded px-2.5 py-1.5 font-mono text-xs text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37]"
            />
            {dateMode === "range" && (
              <>
                <span>to</span>
                <input
                  type="date"
                  value={normalizedEndDate}
                  min={normalizedSelectedDate}
                  max={maxAllowedDate}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const newEnd =
                      e.target.value > maxAllowedDate
                        ? maxAllowedDate
                        : e.target.value;
                    onDateSelect(normalizedSelectedDate, newEnd);
                    if (autoScrapeOnDateChange) {
                      onTriggerScrape(normalizedSelectedDate, newEnd, trackFilter);
                    }
                  }}
                  aria-label="End Race Date"
                  className="bg-[#0B110E] border border-[#1F2D26] rounded px-2.5 py-1.5 font-mono text-xs text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37]"
                />
              </>
            )}
          </div>

          {/* Calibrated Quick 1-Click Race Day Buttons */}
          <button
            type="button"
            onClick={() => applyPresetRange(todaySydneyIso, todaySydneyIso, "single")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              normalizedSelectedDate === todaySydneyIso && dateMode === "single"
                ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981] font-semibold"
                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            Today • {formatReadableDate(todaySydneyIso).replace(/,?\s*\d{4}$/, "")} (Tamworth &amp; Bairnsdale)
          </button>

          <button
            type="button"
            onClick={() => applyPresetRange("2026-10-13", "2026-10-13", "single")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              normalizedSelectedDate === "2026-10-13" && dateMode === "single"
                ? "bg-[#10B981]/20 border-[#10B981] text-[#10B981] font-semibold"
                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            Tue 13 Oct (Kilmore &amp; Grafton)
          </button>

          <button
            type="button"
            onClick={() => applyPresetRange("2026-10-11", "2026-10-11", "single")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              normalizedSelectedDate === "2026-10-11" && dateMode === "single"
                ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] font-semibold"
                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            Sun 11 Oct (Seymour, Coonamble &amp; Queanbeyan)
          </button>

          <button
            type="button"
            onClick={() => applyPresetRange("2026-10-10", "2026-10-10", "single")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              normalizedSelectedDate === "2026-10-10" && dateMode === "single"
                ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] font-semibold"
                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            Sat 10 Oct (Caulfield &amp; Rosehill)
          </button>
        </div>

        {/* Right: Multi-Select Checkbox Race Card Dropdown + Auto-Scrape Toggle + Live Scrape Trigger */}
        <div className="flex flex-wrap items-center gap-3">
          <RaceCardMultiSelectDropdown
            meetings={meetingsList}
            selectedMeetingIds={selectedMeetingIds}
            onChangeSelectedMeetingIds={(ids) => {
              onTrackFilterChange("");
              onChangeSelectedMeetingIds?.(ids);
            }}
            punters={punters}
            labelPrefix="Race Cards / Locations"
            compact
            align="right"
          />

          <button
            type="button"
            onClick={onToggleAutoScrape}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              autoScrapeOnDateChange
                ? "bg-[#152920] border-[#10B981]/50 text-[#10B981]"
                : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            Auto-Fetch: {autoScrapeOnDateChange ? "On" : "Off"}
          </button>

          <button
            type="button"
            disabled={isScraping}
            onClick={() => onTriggerScrape(normalizedSelectedDate, normalizedEndDate, trackFilter)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-[#D4AF37] text-[#0B110E] hover:bg-[#E2C152] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            {isScraping ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing TAB...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>
                  {dateMode === "range" ? "Sync TAB Range" : "Sync TAB Date"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Calendar Popover */}
      {calendarOpen && (
        <div className="mt-3 pt-3 border-t border-[#1F2D26] flex flex-col md:flex-row gap-6 justify-between">
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else {
                    setViewMonth((m) => m - 1);
                  }
                }}
                className="p-1 text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-[#F3F4F0]">
                {monthTitle}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else {
                    setViewMonth((m) => m + 1);
                  }
                }}
                className="p-1 text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#8A9990] mb-1">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, idx) => {
                if (!cell.iso || !cell.dayNum) {
                  return <div key={`empty-${idx}`} className="h-7" />;
                }
                const isSelectedStart = cell.iso === normalizedSelectedDate;
                const isSelectedEnd = cell.iso === normalizedEndDate;
                const isTodaySydney = cell.iso === todaySydneyIso;
                const isInRange =
                  dateMode === "range" &&
                  cell.iso > normalizedSelectedDate &&
                  cell.iso < normalizedEndDate;
                const isBeyond5Days = isDateBeyond5DaysAhead(cell.iso, todaySydneyIso);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={isBeyond5Days}
                    title={
                      isBeyond5Days
                        ? `Unconfirmed future fields (>5 days ahead, max ${maxAllowedDate})`
                        : isTodaySydney
                        ? `${cell.iso} (Today in Sydney)`
                        : cell.iso
                    }
                    onClick={() => handleDayClick(cell.iso!)}
                    className={`h-7 text-xs font-mono tabular-nums rounded transition-colors relative ${
                      isBeyond5Days
                        ? "text-[#8A9990]/30 cursor-not-allowed line-through"
                        : isSelectedStart || isSelectedEnd
                        ? "bg-[#D4AF37] text-[#0B110E] font-semibold cursor-pointer"
                        : isInRange
                        ? "bg-[#D4AF37]/20 text-[#F3F4F0] cursor-pointer"
                        : isTodaySydney
                        ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981] font-bold cursor-pointer"
                        : "text-[#F3F4F0] hover:bg-[#1C2A23] cursor-pointer"
                    }`}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Race Days */}
          <div className="flex-1 flex flex-col justify-between bg-[#0B110E] border border-[#1F2D26] rounded-md p-3">
            <div>
              <p className="text-xs font-semibold text-[#F3F4F0] mb-1">
                Calibrated Sydney Race Day Presets (Live Sydney Today: {formatReadableDate(todaySydneyIso)} • Max +5 Days Ahead: {maxAllowedDate})
              </p>
              <p className="text-xs text-[#8A9990] mb-3">
                Select any race day or multi-day window to load official finalized results and live NSW/VIC TAB fields.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetRange(todaySydneyIso, todaySydneyIso, "single")}
                  className="px-3 py-1.5 text-xs rounded bg-[#152920] hover:bg-[#1F3A2D] text-[#10B981] font-semibold border border-[#10B981]/60 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Today ({formatReadableDate(todaySydneyIso)}) — Live Racecards (Tamworth NSW 8R · Bairnsdale VIC 8R)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange("2026-10-13", "2026-10-13", "single")}
                  className="px-3 py-1.5 text-xs rounded bg-[#16201B] hover:bg-[#1F2D26] text-[#10B981] font-semibold border border-[#10B981]/40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Tue 13 Oct 2026 — Upcoming Fields (Kilmore VIC 7R · Grafton NSW 6R)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange("2026-10-11", "2026-10-11", "single")}
                  className="px-3 py-1.5 text-xs rounded bg-[#16201B] hover:bg-[#1F2D26] text-[#D4AF37] font-semibold border border-[#D4AF37]/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sun 11 Oct 2026 — 100% Final Results (Seymour 10R · Coonamble Cup 8R · Queanbeyan 7R · Cairns 8R · Halidon 7R)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange("2026-10-10", "2026-10-10", "single")}
                  className="px-3 py-1.5 text-xs rounded bg-[#16201B] hover:bg-[#1F2D26] text-[#D4AF37] font-semibold border border-[#D4AF37]/50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sat 10 Oct 2026 — 100% Final Feature Metro (Caulfield Guineas 10R · Rosehill Hill Stakes 10R · Eagle Farm 10R · Morphettville 9R)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange("2026-10-09", "2026-10-09", "single")}
                  className="px-3 py-1.5 text-xs rounded bg-[#16201B] hover:bg-[#1F2D26] text-[#F3F4F0] border border-[#1F2D26] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Fri 9 Oct 2026 — Completed Results (Cranbourne 9R · Ballarat 10R · Port Macquarie Cup 8R · Canberra 8R)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetRange("2026-10-10", todaySydneyIso, "range")}
                  className="px-3 py-1.5 text-xs rounded bg-[#16201B] hover:bg-[#1F2D26] text-[#D4AF37] border border-[#D4AF37]/40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Weekend + Today Range (10 Oct → {todaySydneyIso})
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#1F2D26] flex items-center justify-between text-xs text-[#8A9990]">
              <span>
                {dateMode === "range"
                  ? `Selecting range (${rangePickingStep === "start" ? "Click start date" : "Click end date"})`
                  : "Click any date on the calendar to load its active tracks"}
              </span>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="text-[#D4AF37] hover:underline font-medium cursor-pointer"
              >
                Close Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
