import React, { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Clock,
  Check,
  ChevronUp,
  Target,
  Table2,
  Trophy,
  Flame,
  X,
  Sparkles,
} from "lucide-react";
import { RaceMeeting, PunterProfile } from "../types/racing";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab";

export interface PersistentRaceRibbonProps {
  meetings: RaceMeeting[];
  activeMeeting: RaceMeeting | null;
  onSelectMeeting: (id: string) => void;
  selectedRaceNumber: number;
  onSelectRaceNumber: (raceNumber: number) => void;
  activeTab: "overview" | "selections" | "exotics" | "results";
  onJumpTo: (
    tab: "overview" | "selections" | "exotics" | "results",
    raceNumber: number,
    meetingId?: string
  ) => void;
  punters: PunterProfile[];
}

export const PersistentRaceRibbon: React.FC<PersistentRaceRibbonProps> = ({
  meetings,
  activeMeeting,
  onSelectMeeting,
  selectedRaceNumber,
  onSelectRaceNumber,
  activeTab,
  onJumpTo,
  punters,
}) => {
  const [activeMenuRaceNumber, setActiveMenuRaceNumber] = useState<number | null>(null);
  const [showMeetingPicker, setShowMeetingPicker] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meetingPickerRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuRaceNumber(null);
      }
      if (meetingPickerRef.current && !meetingPickerRef.current.contains(event.target as Node)) {
        setShowMeetingPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activeMeeting || !activeMeeting.races || activeMeeting.races.length === 0) {
    return null;
  }

  // Find next upcoming race (first non-completed race)
  const nextUpcomingRace = activeMeeting.races.find(
    (r) => !isRaceOfficialOrCompleted(r, activeMeeting.date)
  );

  const activeMenuRace = activeMenuRaceNumber
    ? activeMeeting.races.find((r) => r.raceNumber === activeMenuRaceNumber)
    : null;

  // Contributing punter tips for the selected menu race
  const activeRaceTips = activeMenuRace
    ? punters
        .map((p) => {
          const trio = p.selectionsByMeeting?.[activeMeeting.id]?.[activeMenuRace.raceNumber];
          if (!trio) return null;
          const picks: string[] = [];
          if (trio.firstPref) picks.push(`#${trio.firstPref} (1st)`);
          if (trio.secondPref) picks.push(`#${trio.secondPref} (2nd)`);
          if (trio.thirdPref) picks.push(`#${trio.thirdPref} (3rd)`);
          if (picks.length === 0) return null;
          return { punterName: p.name, picks: picks.join(", ") };
        })
        .filter(Boolean)
    : [];

  const handleRacePillClick = (raceNo: number) => {
    onSelectRaceNumber(raceNo);
    setActiveMenuRaceNumber((prev) => (prev === raceNo ? null : raceNo));
    setShowMeetingPicker(false);
  };

  const handleActionClick = (tab: "overview" | "selections" | "exotics" | "results") => {
    if (activeMenuRaceNumber !== null) {
      onJumpTo(tab, activeMenuRaceNumber, activeMeeting.id);
      setActiveMenuRaceNumber(null);
    }
  };

  return (
    <aside
      aria-label="Persistent race venue and navigation ribbon"
      className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-[#070D0A]/95 backdrop-blur-md border-t border-[#1E2E25] shadow-[0_-8px_24px_rgba(0,0,0,0.6)] px-2 sm:px-4 py-2 text-[#F3F4F0] select-none"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: Meeting Venue + Track Condition + Switcher */}
        <div className="relative flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowMeetingPicker((prev) => !prev);
              setActiveMenuRaceNumber(null);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#121E18] border border-[#23352B] hover:border-[#D4AF37]/50 hover:bg-[#182820] text-xs font-mono font-bold transition cursor-pointer"
            title="Switch Active Meeting"
          >
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-[#F3F4F0] font-display uppercase tracking-wide">
              {activeMeeting.venue}
            </span>
            <span className="text-[10px] text-[#8A9990] hidden sm:inline">
              ({activeMeeting.state || "NSW"})
            </span>
            <ChevronUp
              className={`w-3.5 h-3.5 text-[#8A9990] transition-transform ${
                showMeetingPicker ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Track Condition & Weather / Rail */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-[#8A9990]">
            <span className="px-2 py-0.5 rounded-md bg-[#0F1814] border border-[#1E2E25] text-[#10B981] font-bold">
              {activeMeeting.trackCondition || "Good 4"}
            </span>
            {activeMeeting.weather && (
              <span className="text-[10px] text-[#8A9990]">· {activeMeeting.weather}</span>
            )}
            {nextUpcomingRace && (
              <span className="flex items-center gap-1 text-[10px] text-[#D4AF37] pl-1 font-semibold">
                <Clock className="w-3 h-3 animate-spin text-[#D4AF37]" />
                Next: R{nextUpcomingRace.raceNumber} ({nextUpcomingRace.startTime})
              </span>
            )}
          </div>

          {/* Meeting Picker Dropdown Popup */}
          {showMeetingPicker && (
            <div
              ref={meetingPickerRef}
              className="absolute bottom-full mb-2 left-0 w-64 rounded-2xl bg-[#0E1713] border border-[#23352B] p-2 shadow-2xl space-y-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="text-[10px] font-mono font-bold text-[#8A9990] px-2 py-1 uppercase tracking-wider border-b border-[#1E2E25]">
                Switch Race Meeting
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 pt-1 pr-1">
                {meetings.map((m) => {
                  const isCur = m.id === activeMeeting.id;
                  const compRaces = m.races.filter((r) =>
                    isRaceOfficialOrCompleted(r, m.date)
                  ).length;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectMeeting(m.id);
                        setShowMeetingPicker(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-mono transition text-left cursor-pointer ${
                        isCur
                          ? "bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F3F4F0] font-bold"
                          : "hover:bg-[#15231C] text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <span className="truncate">{m.venue}</span>
                        <span className="text-[10px] text-[#55695D]">({m.state})</span>
                      </div>
                      <span className="text-[10px] text-[#8A9990] shrink-0">
                        {compRaces}/{m.races.length} Run
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center / Right: Race Pills Ribbon (R1 .. R10) */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 no-scrollbar max-w-full">
          {activeMeeting.races.map((r) => {
            const isOfficial = isRaceOfficialOrCompleted(r, activeMeeting.date);
            const isNext = nextUpcomingRace?.raceNumber === r.raceNumber;
            const isSelected = selectedRaceNumber === r.raceNumber;
            const isMenuOpen = activeMenuRaceNumber === r.raceNumber;

            // Check if syndicate has tips in this race
            const hasTips = punters.some((p) => {
              const trio = p.selectionsByMeeting?.[activeMeeting.id]?.[r.raceNumber];
              return trio && (trio.firstPref || trio.secondPref || trio.thirdPref);
            });

            return (
              <button
                key={r.raceNumber}
                type="button"
                onClick={() => handleRacePillClick(r.raceNumber)}
                className={`relative shrink-0 flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  isMenuOpen
                    ? "bg-[#D4AF37] text-[#070B09] ring-2 ring-[#D4AF37]/50 shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                    : isSelected
                    ? "bg-[#16271F] border border-[#D4AF37] text-[#D4AF37]"
                    : isOfficial
                    ? "bg-[#0F1814] border border-[#1E2E25] text-[#8A9990] hover:text-[#F3F4F0] hover:border-[#10B981]/50"
                    : isNext
                    ? "bg-[#1A261D] border border-[#D4AF37]/60 text-[#F3F4F0] animate-pulse"
                    : "bg-[#0A100D] border border-[#1E2E25]/80 text-[#6B7D73] hover:text-[#F3F4F0]"
                }`}
                title={`Race ${r.raceNumber}: ${r.raceName || "Event"} (${r.distance}m)`}
              >
                <span>R{r.raceNumber}</span>
                {isOfficial ? (
                  <Check className="w-3 h-3 text-[#10B981]" />
                ) : isNext ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-ping" />
                ) : null}
                {hasTips && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
                    title="Syndicate selections active"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Action Popover Menu when a race pill is tapped */}
      {activeMenuRace && (
        <div
          ref={menuRef}
          className="fixed bottom-28 md:bottom-14 left-1/2 -translate-x-1/2 w-[92vw] max-w-md rounded-2xl bg-[#0D1511]/98 border border-[#D4AF37]/40 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[#1E2E25] pb-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] font-mono text-[10px] font-bold">
                  {activeMeeting.venue} · Race {activeMenuRace.raceNumber}
                </span>
                <span className="text-[11px] font-mono text-[#8A9990]">
                  {activeMenuRace.distance}m · Jumps {activeMenuRace.startTime}
                </span>
              </div>
              <h4 className="text-sm font-display font-bold text-[#F3F4F0] mt-1 truncate">
                {activeMenuRace.raceName}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActiveMenuRaceNumber(null)}
              className="p-1 rounded-lg text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#1A2620] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Syndicate Selections Summary in this race */}
          <div className="py-2.5 border-b border-[#1E2E25]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#8A9990] mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              Syndicate Selections (R{activeMenuRace.raceNumber}):
            </div>
            {activeRaceTips && activeRaceTips.length > 0 ? (
              <div className="space-y-1">
                {activeRaceTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs font-mono bg-[#080D0B] px-2.5 py-1 rounded-lg border border-[#1E2E25]"
                  >
                    <span className="font-bold text-[#F3F4F0]">{tip?.punterName}:</span>
                    <span className="text-[#D4AF37]">{tip?.picks}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-[#55695D] italic">
                No syndicate selections made yet for this race.
              </p>
            )}
          </div>

          {/* Quick Jump 3-Action Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            <button
              type="button"
              onClick={() => handleActionClick("selections")}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#14231B] border border-[#23352B] hover:border-[#D4AF37] hover:bg-[#1A2C22] text-[#F3F4F0] transition group cursor-pointer"
            >
              <Table2 className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[11px] font-mono font-bold">Selections</span>
              <span className="text-[9px] text-[#8A9990]">Picks & Form</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionClick("exotics")}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#14231B] border border-[#23352B] hover:border-[#10B981] hover:bg-[#1A2C22] text-[#F3F4F0] transition group cursor-pointer"
            >
              <Target className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[11px] font-mono font-bold">Exotics</span>
              <span className="text-[9px] text-[#8A9990]">Trifecta & Quaddie</span>
            </button>

            <button
              type="button"
              onClick={() => handleActionClick("results")}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[#14231B] border border-[#23352B] hover:border-[#38BDF8] hover:bg-[#1A2C22] text-[#F3F4F0] transition group cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-[#38BDF8] group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[11px] font-mono font-bold">Results</span>
              <span className="text-[9px] text-[#8A9990]">Standings & Report</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
