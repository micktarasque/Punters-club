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
  labelPrefix = "Race Cards / Locations",
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
        className={`inline-flex items-center justify-between gap-2.5 rounded-lg border transition-colors cursor-pointer ${
          compact ? "min-h-[36px] px-3 py-1.5 text-xs" : "min-h-[40px] px-3.5 py-2 text-xs"
        } ${
          isOpen
            ? "bg-[#17281F] border-[#D4AF37] text-[#F3F4F0] shadow-md"
            : "bg-[#0B110E] border-[#2A3F34] text-[#F3F4F0] hover:border-[#D4AF37]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A9990] hidden sm:inline shrink-0">
            {labelPrefix}:
          </span>
          <span className="font-semibold text-[#F3F4F0] truncate max-w-[220px] sm:max-w-[320px]">
            {summaryLabel}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-[10px] font-bold shrink-0">
            {selectedMeetings.length}/{sortedMeetings.length} Checked
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#D4AF37] shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={labelPrefix}
          className={`absolute z-50 mt-2 w-80 sm:w-96 rounded-xl border border-[#D4AF37]/60 bg-[#0E1813] p-3.5 shadow-2xl space-y-3 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Dropdown Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[#1F2D26] pb-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F3F4F0]">
                <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Select Race Cards / Locations</span>
              </div>
              <p className="text-[11px] text-[#8A9990] mt-0.5">
                Tick checkboxes to view &amp; score 1 or multiple race cards at once
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
              aria-label="Close Race Cards Dropdown"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Selection Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {combinedRequiredMeetings.length > 0 && (
              <button
                type="button"
                onClick={handleSelectSydneyAndMelbourne}
                className="px-2.5 py-1 rounded-md bg-[#16241D] border border-[#D4AF37]/50 text-[#D4AF37] text-[11px] font-mono font-semibold hover:bg-[#1E3127] transition-colors cursor-pointer"
              >
                Sydney &amp; Melbourne Default ({combinedRequiredMeetings.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-md bg-[#152920] border border-[#10B981]/50 text-[#10B981] text-[11px] font-mono font-semibold hover:bg-[#1C372B] transition-colors cursor-pointer"
            >
              Check All ({sortedMeetings.length} Cards)
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
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isChecked
                      ? "bg-[#152920] border-[#10B981] text-[#F3F4F0]"
                      : "bg-[#0B110E] border-[#1F2D26] text-[#9BA8A1] hover:border-[#D4AF37]/50 hover:text-[#F3F4F0]"
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
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                        isChecked
                          ? "bg-[#10B981] border-[#10B981] text-[#0B110E]"
                          : "bg-[#0B110E] border-[#52665B]"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            isChecked
                              ? "bg-[#0B110E]/40 text-[#D4AF37]"
                              : isMetro
                              ? "bg-[#192620] text-[#D4AF37]"
                              : "bg-[#141E19] text-[#8A9990]"
                          }`}
                        >
                          {m.state || "TAB"}
                        </span>
                        <span className="font-bold text-[#F3F4F0] truncate">
                          {m.venue}
                        </span>
                        <span className="font-mono text-[11px] text-[#8A9990]">
                          ({m.races.length}R)
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8A9990] mt-0.5">
                        {m.trackCondition || m.trackRating} · {finalizedCount}/
                        {m.races.length} Final
                        {pickedCount > 0 ? ` · ${pickedCount} Picks` : ""}
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {sortedMeetings.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnlyOne(m.id, e)}
                        title={`Select only ${m.venue}`}
                        className="px-2 py-0.5 rounded bg-[#0B110E] border border-[#23352C] text-[10px] font-mono text-[#8A9990] hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer"
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
          <div className="flex items-center justify-between border-t border-[#1F2D26] pt-2 text-[11px] font-mono text-[#8A9990]">
            <span>
              {selectedMeetings.length} of {sortedMeetings.length} race card(s)
              active
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#D4AF37] font-semibold hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
