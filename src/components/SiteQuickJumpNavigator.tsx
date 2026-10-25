import React, { useState } from "react";
import {
  Compass,
  Table2,
  Trophy,
  BarChart3,
  Target,
  FileText,
  MapPin,
  ArrowRight,
  Flame,
  ChevronDown,
  Layers,
  Sparkles,
} from "lucide-react";
import { RaceMeeting, PunterProfile } from "../types/racing";

export interface SiteQuickJumpNavigatorProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (meetingId: string) => void;
  selectedRaceNumber: number;
  onSelectRaceNumber: (raceNo: number) => void;
  activeTab: "overview" | "selections" | "exotics" | "results" | "cup";
  onSwitchTab: (tab: "overview" | "selections" | "exotics" | "results" | "cup") => void;
  onJumpToRace: (
    tab: "overview" | "selections" | "exotics" | "results" | "cup",
    raceNumber: number,
    meetingId?: string
  ) => void;
  onOpenReport?: () => void;
  punters?: PunterProfile[];
  isApple?: boolean;
  isObsidian?: boolean;
  className?: string;
}

export const SiteQuickJumpNavigator: React.FC<SiteQuickJumpNavigatorProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  selectedRaceNumber,
  onSelectRaceNumber,
  activeTab,
  onSwitchTab,
  onJumpToRace,
  onOpenReport,
  isApple = false,
  isObsidian = false,
  className = "",
}) => {
  const [selectedTargetRace, setSelectedTargetRace] = useState<number>(selectedRaceNumber);
  const [selectedTargetMeeting, setSelectedTargetMeeting] = useState<string>(selectedMeetingId);

  const activeMeeting =
    meetings.find((m) => m.id === selectedTargetMeeting) ||
    meetings.find((m) => m.id === selectedMeetingId) ||
    meetings[0];

  const sortedRaces = (activeMeeting?.races || [])
    .slice()
    .sort((a, b) => a.raceNumber - b.raceNumber);

  const handleJumpToSelectionsDirect = (mId: string, rNo: number) => {
    onJumpToRace("selections", rNo, mId);
  };

  const handleJumpToSection = (sectionId: string, tab: "overview" | "selections" | "exotics" | "results") => {
    onSwitchTab(tab);
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Theming classes
  const containerBg = isApple
    ? "bg-white/95 border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
    : isObsidian
    ? "bg-[#0E1522]/95 border-[#1E293B] shadow-lg text-[#F1F5F9]"
    : "bg-[#0F1713]/95 border-[#1F2D26] shadow-lg text-[#F3F4F0]";

  const chipBg = isApple
    ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
    : isObsidian
    ? "bg-[#162133] border-[#1E293B] text-[#94A3B8] hover:text-white hover:bg-[#1E2D45]"
    : "bg-[#141F1A] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#1B2A23]";

  const activeChipBg = isApple
    ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
    : isObsidian
    ? "bg-[#38BDF8] text-[#09101D] border-[#38BDF8] font-bold shadow-xs"
    : "bg-[#10B981] text-[#070B09] border-[#10B981] font-bold shadow-xs";

  const secondaryText = isApple
    ? "text-[#86868B]"
    : isObsidian
    ? "text-[#94A3B8]"
    : "text-[#8A9990]";

  return (
    <div
      aria-label="Quick Navigation and Race Jump Dock"
      className={`rounded-2xl border p-3 sm:p-4 backdrop-blur-md transition-all text-xs ${containerBg} ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Quick Jump to Selections (Venue & Race #) */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 mr-1">
            <span className={`p-1.5 rounded-lg shrink-0 ${
              isApple ? "bg-[#0071E3]/10 text-[#0071E3]" : isObsidian ? "bg-[#38BDF8]/15 text-[#38BDF8]" : "bg-[#10B981]/15 text-[#10B981]"
            }`}>
              <Compass className="w-3.5 h-3.5" />
            </span>
            <span className="font-bold tracking-tight text-xs uppercase font-mono">
              Jump To Selections:
            </span>
          </div>

          {/* Venue Switcher Select */}
          <div className="relative shrink-0">
            <select
              value={selectedTargetMeeting}
              onChange={(e) => {
                const newMId = e.target.value;
                setSelectedTargetMeeting(newMId);
                onSelectMeeting(newMId);
              }}
              className={`rounded-xl pl-2.5 pr-7 py-1 text-xs font-semibold border transition-all cursor-pointer appearance-none ${chipBg}`}
              aria-label="Select Venue to Jump To"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#1C1C1E] text-white">
                  {m.venue} ({m.state || "AU"} · {m.races.length}R)
                </option>
              ))}
            </select>
            <ChevronDown className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${secondaryText}`} />
          </div>

          {/* Race Number Selector Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
            {sortedRaces.map((r) => {
              const isCurrent =
                selectedTargetRace === r.raceNumber &&
                selectedTargetMeeting === selectedMeetingId;
              return (
                <button
                  key={r.raceNumber}
                  type="button"
                  onClick={() => {
                    setSelectedTargetRace(r.raceNumber);
                    handleJumpToSelectionsDirect(selectedTargetMeeting, r.raceNumber);
                  }}
                  className={`h-6 px-2 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    isCurrent ? activeChipBg : chipBg
                  }`}
                  title={`Jump directly to Race ${r.raceNumber} (${r.distance}m) selections`}
                >
                  <span>R{r.raceNumber}</span>
                </button>
              );
            })}
          </div>

          {/* Direct Execute Jump Button */}
          <button
            type="button"
            onClick={() =>
              handleJumpToSelectionsDirect(selectedTargetMeeting, selectedTargetRace)
            }
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs shrink-0 ${
              isApple
                ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                : isObsidian
                ? "bg-[#38BDF8] text-[#09101D] hover:bg-[#7DD3FC]"
                : "bg-[#D4AF37] text-[#070B09] hover:bg-[#E5C158]"
            }`}
            title={`Jump straight to ${activeMeeting?.venue || ""} Race ${selectedTargetRace} selections`}
          >
            <span>Jump to Race {selectedTargetRace}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Right: Key Site & Results Jump Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-inherit/20">
          <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold mr-1 hidden sm:inline ${secondaryText}`}>
            Jump To Section:
          </span>

          {/* Jump to Leaderboard & Standings */}
          <button
            type="button"
            onClick={() => handleJumpToSection("section-punter-leaderboard", "results")}
            className={`px-2.5 py-1 rounded-xl font-medium border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${chipBg}`}
            title="Jump to Registered Punters Leaderboard & Live Standings on Results"
          >
            <Trophy className="w-3 h-3 text-[#D4AF37]" />
            <span>Leaderboard</span>
          </button>

          {/* Jump to Results Performance Graph */}
          <button
            type="button"
            onClick={() => handleJumpToSection("section-syndicate-performance", "results")}
            className={`px-2.5 py-1 rounded-xl font-medium border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${chipBg}`}
            title="Jump to Syndicate 30-Day Performance Recharts Visualizations on Results"
          >
            <BarChart3 className="w-3 h-3 text-[#10B981]" />
            <span>Performance Graph</span>
          </button>

          {/* Jump to Exotics Studio */}
          <button
            type="button"
            onClick={() => onSwitchTab("exotics")}
            className={`px-2.5 py-1 rounded-xl font-medium border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${chipBg}`}
            title="Jump to Syndicate Trifectas & Quaddies Studio"
          >
            <Target className="w-3 h-3 text-[#0071E3]" />
            <span>Exotics</span>
          </button>

          {/* Jump to Form Guide & Speed Map */}
          <button
            type="button"
            onClick={() => handleJumpToSection("section-full-racecard", "overview")}
            className={`px-2.5 py-1 rounded-xl font-medium border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${chipBg}`}
            title="Jump to Speed Map & Form Guide"
          >
            <Flame className="w-3 h-3 text-[#FF9500]" />
            <span>Speed Map</span>
          </button>

          {/* Jump to Race Report */}
          {onOpenReport && (
            <button
              type="button"
              onClick={onOpenReport}
              className={`px-2.5 py-1 rounded-xl font-medium border transition-colors cursor-pointer flex items-center gap-1 text-[11px] ${chipBg}`}
              title="Open Official Race Report"
            >
              <FileText className="w-3 h-3 text-[#AF52DE]" />
              <span className="hidden sm:inline">Report</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
