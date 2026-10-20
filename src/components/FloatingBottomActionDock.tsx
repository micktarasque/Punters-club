import React, { useState, useRef, useEffect } from "react";
import {
  ChevronUp,
  Flame,
  Layers,
  MapPin,
  Moon,
  Sparkles,
  Sun,
  Table2,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  FileText,
} from "lucide-react";
import { RaceMeeting } from "../types/racing";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab";
import { audioAlerts } from "../utils/audioAlerts";

interface FloatingBottomActionDockProps {
  meetings: RaceMeeting[];
  activeMeeting: RaceMeeting;
  onSelectMeeting: (meetingId: string) => void;
  selectedRaceNumber: number;
  onSelectRaceNumber: (raceNo: number) => void;
  activeTab: "overview" | "selections" | "exotics" | "results";
  onSwitchTab: (tab: "overview" | "selections" | "exotics" | "results") => void;
  onJumpToRace?: (raceNo: number) => void;
  isApple?: boolean;
  onToggleTheme?: () => void;
  onOpenReport?: () => void;
}

export const FloatingBottomActionDock: React.FC<FloatingBottomActionDockProps> = ({
  meetings,
  activeMeeting,
  onSelectMeeting,
  selectedRaceNumber,
  onSelectRaceNumber,
  activeTab,
  onSwitchTab,
  onJumpToRace,
  isApple = false,
  onToggleTheme,
  onOpenReport,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => audioAlerts.getMuted());
  const raceScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the race ribbon to keep active race centered
  useEffect(() => {
    if (raceScrollRef.current) {
      const activeBtn = raceScrollRef.current.querySelector(
        `[data-race-no="${selectedRaceNumber}"]`
      ) as HTMLElement | null;
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [selectedRaceNumber]);

  const handleToggleMute = () => {
    const nextMuted = audioAlerts.toggleMuted();
    setIsAudioMuted(nextMuted);
    if (!nextMuted) {
      audioAlerts.playTapClick();
    }
  };

  const sortedRaces = (activeMeeting?.races || [])
    .slice()
    .sort((a, b) => a.raceNumber - b.raceNumber);

  return (
    <aside
      aria-label="Race Day Floating Quick Action Bar"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.25rem)] max-w-xl transition-all duration-300 ease-out select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className={`rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 p-2 sm:p-2.5 ${
          isApple
            ? "bg-white/95 border-[#E5E5EA] text-[#1D1D1F] shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            : "bg-[#090E0B]/95 border-[#23352C] text-[#F3F4F0] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        }`}
      >
        {/* Expanded Drawer: Venue Meeting Switcher & Extra Actions */}
        {isExpanded && (
          <div
            className={`mb-2.5 pb-2.5 border-b space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              isApple ? "border-[#E5E5EA]" : "border-[#1F2D26]"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span
                className={`font-semibold uppercase tracking-wider text-[10px] ${
                  isApple ? "text-[#86868B]" : "text-[#8A9990]"
                }`}
              >
                Select Racing Venue
              </span>
              <div className="flex items-center gap-1.5">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={() => {
                      audioAlerts.playTapClick();
                      onToggleTheme();
                    }}
                    className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                      isApple
                        ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                        : "bg-[#121A16] border-[#1F2D26] text-[#D5DDD8] hover:bg-[#192620]"
                    }`}
                    title="Toggle Theme (Apple Minimalist / Turf Dark)"
                  >
                    {isApple ? (
                      <>
                        <Moon className="w-3.5 h-3.5 text-[#0071E3]" />
                        <span className="text-[10px]">Apple Theme</span>
                      </>
                    ) : (
                      <>
                        <Sun className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span className="text-[10px]">Turf Theme</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                    isAudioMuted
                      ? isApple
                        ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#86868B]"
                        : "bg-[#141A16] border-[#1F2D26] text-[#8A9990]"
                      : isApple
                      ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3]"
                      : "bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]"
                  }`}
                  title={isAudioMuted ? "Audio Chimes Muted (Click to Unmute)" : "Audio Chimes Active"}
                >
                  {isAudioMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  )}
                  <span className="text-[10px] font-mono">
                    {isAudioMuted ? "Muted" : "Chime"}
                  </span>
                </button>
              </div>
            </div>

            {/* Meetings Cards Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {meetings.map((m) => {
                const isCurrent = m.id === activeMeeting?.id;
                const completedCount = (m.races || []).filter((r) =>
                  isRaceOfficialOrCompleted(r, m.date)
                ).length;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      audioAlerts.playTapClick();
                      onSelectMeeting(m.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-left whitespace-nowrap text-xs transition-all cursor-pointer shrink-0 ${
                      isCurrent
                        ? isApple
                          ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs font-bold"
                          : "bg-[#10B981] text-[#070B09] border-[#10B981] font-bold shadow-xs"
                        : isApple
                        ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                        : "bg-[#121A16] border-[#1F2D26] text-[#D5DDD8] hover:bg-[#192620]"
                    }`}
                  >
                    <div className="font-sans font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {m.venue}
                    </div>
                    <div
                      className={`text-[9.5px] font-mono ${
                        isCurrent
                          ? "opacity-90"
                          : isApple
                          ? "text-[#86868B]"
                          : "text-[#8A9990]"
                      }`}
                    >
                      {completedCount}/{m.races.length} Fin · {m.trackCondition || "Good 4"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Row: Tab Navigation + Active Race Jump Ribbon + Toggle Handle */}
        <div className="space-y-2">
          {/* Top Sub-Row: Tabs */}
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  audioAlerts.playTapClick();
                  onSwitchTab("overview");
                }}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] truncate ${
                  activeTab === "overview"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    : "text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#121A16]"
                }`}
              >
                <Flame className="w-3 h-3 shrink-0" />
                <span>Form</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioAlerts.playTapClick();
                  onSwitchTab("selections");
                }}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] truncate ${
                  activeTab === "selections"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    : "text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#121A16]"
                }`}
              >
                <Table2 className="w-3 h-3 shrink-0" />
                <span>Picks</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioAlerts.playTapClick();
                  onSwitchTab("exotics");
                }}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] truncate ${
                  activeTab === "exotics"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    : "text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#121A16]"
                }`}
              >
                <Target className="w-3 h-3 shrink-0" />
                <span>Exotics</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  audioAlerts.playTapClick();
                  onSwitchTab("results");
                }}
                className={`flex-1 py-1 px-2 rounded-lg text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] truncate ${
                  activeTab === "results"
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-xs font-bold"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    : "text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#121A16]"
                }`}
              >
                <Trophy className="w-3 h-3 shrink-0" />
                <span>Results</span>
              </button>
            </div>

            {/* Quick Report & Expand Trigger */}
            <div className="flex items-center gap-1 shrink-0">
              {onOpenReport && (
                <button
                  type="button"
                  onClick={() => {
                    audioAlerts.playTapClick();
                    onOpenReport();
                  }}
                  className={`p-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                    isApple
                      ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3] hover:bg-[#0071E3]/20"
                      : "bg-[#D4AF37]/15 border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/25"
                  }`}
                  title="Generate Syndicate Report"
                >
                  <FileText className="w-3 h-3" />
                  <span className="hidden sm:inline text-[10px] font-bold">Report</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  audioAlerts.playTapClick();
                  setIsExpanded((prev) => !prev);
                }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isExpanded
                    ? isApple
                      ? "bg-[#0071E3] text-white border-[#0071E3]"
                      : "bg-[#10B981] text-[#070B09] border-[#10B981]"
                    : isApple
                    ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
                    : "bg-[#121A16] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
                title={isExpanded ? "Collapse Dock" : "Expand Venue & Sound Controls"}
              >
                <ChevronUp
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Bottom Sub-Row: Horizontal Race Number Jump Strip */}
          <div
            ref={raceScrollRef}
            className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none scroll-smooth"
          >
            <span
              className={`text-[9.5px] font-mono shrink-0 pl-1 ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}
            >
              {activeMeeting?.venue || "NSW"}:
            </span>
            {sortedRaces.map((race) => {
              const isSelected = race.raceNumber === selectedRaceNumber;
              const isFinished = isRaceOfficialOrCompleted(race, activeMeeting?.date);

              return (
                <button
                  key={race.raceNumber}
                  data-race-no={race.raceNumber}
                  type="button"
                  onClick={() => {
                    audioAlerts.playTapClick();
                    onSelectRaceNumber(race.raceNumber);
                    if (onJumpToRace) {
                      onJumpToRace(race.raceNumber);
                    }
                  }}
                  className={`h-7 px-2.5 rounded-lg font-mono text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? isApple
                        ? "bg-[#0071E3] text-white shadow-xs scale-105"
                        : "bg-[#D4AF37] text-[#070B09] shadow-xs scale-105 font-extrabold"
                      : isFinished
                      ? isApple
                        ? "bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30 hover:bg-[#34C759]/25"
                        : "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/30"
                      : isApple
                      ? "bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      : "bg-[#121A16] border border-[#1F2D26] text-[#D5DDD8] hover:bg-[#192620]"
                  }`}
                  title={`Race ${race.raceNumber}${isFinished ? " (Official Results)" : ""}`}
                >
                  <span>R{race.raceNumber}</span>
                  {isFinished && <span className="text-[9px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
