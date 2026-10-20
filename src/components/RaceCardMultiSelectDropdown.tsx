import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Layers, MapPin, X } from "lucide-react";
import { PunterProfile, RaceMeeting } from "../types/racing";
import {
  getSydneyAndMelbourneMeetings,
  isMainMetroVenue,
  isRaceOfficialOrCompleted,
  sortMeetingsByMetroPriority,
} from "../data/seedNswTab";
import { getPunterSelectionsForMeeting } from "../utils/scoring";

export interface RaceCardMultiSelectDropdownProps {
  meetings: RaceMeeting[];
  selectedMeetingIds: string[];
  onChangeSelectedMeetingIds: (ids: string[]) => void;
  punters?: PunterProfile[];
  labelPrefix?: string;
  compact?: boolean;
  align?: "left" | "right";
}

export const RaceCardMultiSelectDropdown: React.FC<
  RaceCardMultiSelectDropdownProps
> = ({
  meetings,
  selectedMeetingIds,
  onChangeSelectedMeetingIds,
  punters = [],
  labelPrefix = "Race Cards",
  compact = false,
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const sortedMeetings = useMemo(
    () => sortMeetingsByMetroPriority(meetings),
    [meetings]
  );

  const { combinedRequiredMeetings } = useMemo(
    () => getSydneyAndMelbourneMeetings(sortedMeetings),
    [sortedMeetings]
  );

  const effectiveSelectedIds = useMemo(() => {
    const validSet = new Set(sortedMeetings.map((m) => m.id));
    const filtered = selectedMeetingIds.filter((id) => validSet.has(id));
    if (filtered.length > 0) return filtered;
    if (combinedRequiredMeetings.length > 0) {
      return combinedRequiredMeetings.map((m) => m.id);
    }
    return sortedMeetings[0] ? [sortedMeetings[0].id] : [];
  }, [sortedMeetings, selectedMeetingIds, combinedRequiredMeetings]);

  const selectedMeetings = useMemo(
    () => sortedMeetings.filter((m) => effectiveSelectedIds.includes(m.id)),
    [sortedMeetings, effectiveSelectedIds]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleMeetingId = (id: string) => {
    if (effectiveSelectedIds.includes(id)) {
      if (effectiveSelectedIds.length <= 1) {
        // Keep at least 1 race card active
        return;
      }
      onChangeSelectedMeetingIds(
        effectiveSelectedIds.filter((item) => item !== id)
      );
    } else {
      // Preserve sorted order when adding
      const nextSet = new Set([...effectiveSelectedIds, id]);
      const ordered = sortedMeetings
        .filter((m) => nextSet.has(m.id))
        .map((m) => m.id);
      onChangeSelectedMeetingIds(ordered);
    }
  };

  const handleSelectOnlyOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeSelectedMeetingIds([id]);
  };

  const handleSelectSydneyAndMelbourne = () => {
    if (combinedRequiredMeetings.length > 0) {
      onChangeSelectedMeetingIds(combinedRequiredMeetings.map((m) => m.id));
    } else {
      onChangeSelectedMeetingIds(sortedMeetings.slice(0, 2).map((m) => m.id));
    }
  };

  const handleSelectAll = () => {
    onChangeSelectedMeetingIds(sortedMeetings.map((m) => m.id));
  };

  const summaryLabel = useMemo(() => {
    if (selectedMeetings.length === 0) return "Select Race Cards";
    if (selectedMeetings.length === 1) {
      const m = selectedMeetings[0];
      return `${m.venue} (${m.state || "TAB"} · ${m.races.length}R)`;
    }
    if (selectedMeetings.length === 2) {
      return `${selectedMeetings[0].venue} (${selectedMeetings[0].state}) + ${selectedMeetings[1].venue} (${selectedMeetings[1].state})`;
    }
    if (selectedMeetings.length === sortedMeetings.length) {
      return `All ${sortedMeetings.length} Race Cards (${selectedMeetings
        .map((m) => m.venue)
        .join(", ")})`;
    }
    return `${selectedMeetings.length} Cards: ${selectedMeetings
      .map((m) => m.venue)
      .join(", ")}`;
  }, [selectedMeetings, sortedMeetings]);

  if (sortedMeetings.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2.5 rounded-full border transition-all cursor-pointer ${
          compact
            ? "min-h-[36px] px-3.5 py-1.5 text-xs"
            : "min-h-[40px] px-4 py-2 text-xs"
        } ${
          isOpen
            ? "bg-white border-[#0071E3] text-[#1D1D1F] ring-2 ring-[#0071E3]/20 shadow-sm"
            : "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
          <span className="text-[11px] uppercase tracking-wider text-[#86868B] hidden sm:inline shrink-0 font-medium">
            {labelPrefix}:
          </span>
          <span className="font-semibold text-[#1D1D1F] truncate max-w-[200px] sm:max-w-[300px]">
            {summaryLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#EBF5FF] text-[#0071E3] text-[10px] font-semibold shrink-0">
            {selectedMeetings.length}/{sortedMeetings.length}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#86868B] shrink-0 transition-transform ${
            isOpen ? "rotate-180 text-[#0071E3]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={labelPrefix}
          className={`absolute z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-xl space-y-3 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Dropdown Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[#F2F2F7] pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1D1D1F]">
                <Layers className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Select Race Cards / Venues</span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                Check 1 or multiple race cards to view across today's fixture
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F2F2F7] cursor-pointer"
              aria-label="Close Race Cards Dropdown"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Selection Presets */}
          <div className="flex flex-wrap items-center gap-2">
            {combinedRequiredMeetings.length > 0 && (
              <button
                type="button"
                onClick={handleSelectSydneyAndMelbourne}
                className="px-3 py-1 rounded-full bg-[#EBF5FF] text-[#0071E3] text-[11px] font-semibold hover:bg-[#D6EBFF] transition-colors cursor-pointer"
              >
                Syd &amp; Melb ({combinedRequiredMeetings.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1 rounded-full bg-[#F2F2F7] text-[#1D1D1F] text-[11px] font-medium hover:bg-[#E5E5EA] transition-colors cursor-pointer"
            >
              Check All ({sortedMeetings.length})
            </button>
          </div>

          {/* Checkbox List of Race Cards / Locations */}
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {sortedMeetings.map((m) => {
              const isChecked = effectiveSelectedIds.includes(m.id);
              const isLastRemaining =
                isChecked && effectiveSelectedIds.length === 1;
              const isMetro = isMainMetroVenue(m.venue, m.meetingCode);
              const finalizedCount = m.races.filter((r) =>
                isRaceOfficialOrCompleted(r, m.date)
              ).length;
              const pickedCount =
                punters.length > 0
                  ? punters.reduce((acc, p) => {
                      const map = getPunterSelectionsForMeeting(p, m);
                      const count = Object.values(map).filter(
                        (t) =>
                          t &&
                          (t.firstPref !== null ||
                            t.secondPref !== null ||
                            t.thirdPref !== null)
                      ).length;
                      return acc + count;
                    }, 0)
                  : 0;

              return (
                <div
                  key={m.id}
                  role="option"
                  aria-selected={isChecked}
                  onClick={() => handleToggleMeetingId(m.id)}
                  className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isChecked
                      ? "bg-[#F2F7FF] border-[#0071E3]/30 text-[#1D1D1F]"
                      : "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F9F9FB]"
                  }`}
                >
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLastRemaining}
                      onChange={() => handleToggleMeetingId(m.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                        isChecked
                          ? "bg-[#0071E3] border-[#0071E3] text-white"
                          : "bg-white border-[#D2D2D7]"
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            isChecked
                              ? "bg-[#0071E3]/15 text-[#0071E3]"
                              : isMetro
                              ? "bg-[#F2F2F7] text-[#1D1D1F]"
                              : "bg-[#F2F2F7] text-[#86868B]"
                          }`}
                        >
                          {m.state || "TAB"}
                        </span>
                        <span className="font-semibold text-[#1D1D1F] truncate">
                          {m.venue}
                        </span>
                        <span className="text-[11px] text-[#86868B]">
                          ({m.races.length}R)
                        </span>
                      </div>
                      <div className="text-[10px] text-[#86868B] mt-0.5">
                        {m.trackCondition || m.trackRating} · {finalizedCount}/
                        {m.races.length} Final
                        {pickedCount > 0 ? ` · ${pickedCount} Tips` : ""}
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {sortedMeetings.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnlyOne(m.id, e)}
                        title={`Select only ${m.venue}`}
                        className="px-2 py-0.5 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-[10px] text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3] transition-colors cursor-pointer"
                      >
                        Only
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Status */}
          <div className="flex items-center justify-between border-t border-[#F2F2F7] pt-2 text-xs text-[#86868B]">
            <span>
              {selectedMeetings.length} of {sortedMeetings.length} cards selected
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#0071E3] font-semibold hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
