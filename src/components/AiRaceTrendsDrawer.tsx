import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  Target,
  Flame,
  Award,
  AlertTriangle,
  Zap,
  ChevronRight,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { RaceMeeting, RaceEvent, PunterProfile } from "../types/racing";
import { RunnerStrategyAnalysis } from "../utils/bettingStrategyEngine";
import { AussieTracksideBanterWidget } from "./reports/AussieTracksideBanterWidget";

export interface AiRaceTrendsData {
  synopsis: string;
  paceScenario: {
    paceRating: string;
    speedMapDescription: string;
    favoredRunStyle: string;
  };
  keyContenders: Array<{
    tabNumber: number;
    horseName: string;
    role: "Consensus Anchor" | "Prime Value Overlay" | "Tactical Threat" | "Vulnerable Drifter" | string;
    odds: string;
    analysis: string;
  }>;
  exoticsStrategy: {
    trifectaBanker: string;
    valueInclusions: string[];
    quaddieAngle: string;
  };
  aussieBanter?: {
    tracksideRoast?: string;
    punterCall?: string;
    goldenWhipTip?: string;
    beerFundImpact?: string;
  };
  takeaways: string[];
  fullNarrative?: string;
}

export interface AiRaceTrendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: RaceMeeting;
  raceNumber: number;
  isApple?: boolean;
  analysisData?: RunnerStrategyAnalysis[];
  punters?: PunterProfile[];
  onAssignPreference?: (prefRank: 1 | 2 | 3, tabNumber: number) => void;
  currentSelections?: {
    firstPref?: number | null;
    secondPref?: number | null;
    thirdPref?: number | null;
  };
}

export const AiRaceTrendsDrawer: React.FC<AiRaceTrendsDrawerProps> = ({
  isOpen,
  onClose,
  meeting,
  raceNumber,
  isApple = true,
  analysisData = [],
  punters = [],
  onAssignPreference,
  currentSelections,
}) => {
  const [trendsData, setTrendsData] = useState<AiRaceTrendsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceModel, setSourceModel] = useState<string>("gemini-3.8-flash");
  const [copied, setCopied] = useState<boolean>(false);

  const currentRace: RaceEvent | undefined =
    meeting.races.find((r) => r.raceNumber === raceNumber) || meeting.races[0];

  const fetchRaceTrends = useCallback(
    async (force = false) => {
      if (!currentRace) return;
      setIsLoading(true);
      setError(null);

      try {
        const payload = {
          meetingVenue: meeting.venue,
          meetingState: meeting.state,
          meetingDate: meeting.date,
          trackRating: meeting.trackRating,
          weather: meeting.weather,
          raceNumber: currentRace.raceNumber,
          raceName: currentRace.raceName,
          distance: currentRace.distance,
          runners: (analysisData.length > 0 ? analysisData : currentRace.runners).map(
            (r: any) => ({
              tabNumber: r.tabNumber,
              horseName: r.horseName,
              barrier: r.barrier,
              weight: r.weight,
              jockey: r.jockey,
              trainer: r.trainer,
              bookmakerOdds: r.bookmakerOdds || r.fixedWinOdds || 0,
              fairOdds: r.fairOdds,
              modelWinProbability: r.modelWinProbability,
              valueEdgePct: r.edgePct ?? r.valueEdgePct,
              speedRating: r.speedRating || r.compositeRating,
              fluctuations: r.fluctuations,
            })
          ),
        };

        const res = await fetch("/api/ai/race-trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to generate race trends");
        }

        setTrendsData(json.data);
        setSourceModel(json.source || "gemini-3.8-flash");
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred while generating trends.");
      } finally {
        setIsLoading(false);
      }
    },
    [meeting, currentRace, analysisData]
  );

  // Trigger fetch when drawer opens or raceNumber changes
  useEffect(() => {
    if (isOpen) {
      fetchRaceTrends();
    }
  }, [isOpen, raceNumber, meeting.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopySummary = () => {
    if (!trendsData || !currentRace) return;
    const banterSection = trendsData.aussieBanter?.tracksideRoast
      ? `\n🍻 Trackside Roast:\n"${trendsData.aussieBanter.tracksideRoast}"\n`
      : "";

    const text = `🏇 TurfSheet AI Race Trends — ${meeting.venue} R${currentRace.raceNumber} (${currentRace.raceName})
Pace: ${trendsData.paceScenario.paceRating} · ${trendsData.paceScenario.favoredRunStyle}
${banterSection}
Synopsis:
${trendsData.synopsis}

Key Contenders:
${trendsData.keyContenders
  .map((c) => `• #${c.tabNumber} ${c.horseName} (${c.role} @ ${c.odds}): ${c.analysis}`)
  .join("\n")}

Exotics Angle:
• Banker: ${trendsData.exoticsStrategy.trifectaBanker}
• Quaddie: ${trendsData.exoticsStrategy.quaddieAngle}

Key Takeaways:
${trendsData.takeaways.map((t) => `• ${t}`).join("\n")}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12">
        <div
          className={`w-screen max-w-xl flex flex-col shadow-2xl transition-transform duration-300 ease-in-out border-l ${
            isApple
              ? "bg-[#FAFAFC] text-[#1D1D1F] border-[#E5E5EA]"
              : "bg-[#090F0C] text-[#F3F4F0] border-[#1F2D26]"
          }`}
        >
          {/* Header */}
          <div
            className={`p-4 sm:p-5 border-b shrink-0 flex items-center justify-between gap-3 ${
              isApple
                ? "bg-white/90 border-[#E5E5EA] backdrop-blur-md"
                : "bg-[#0D1612]/95 border-[#1F2D26] backdrop-blur-md"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isApple
                    ? "bg-[#0071E3]/10 text-[#0071E3]"
                    : "bg-[#10B981]/20 text-[#10B981]"
                }`}
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
                    }`}
                  >
                    AI Race Trends &amp; Intelligence
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      sourceModel.includes("gemini")
                        ? isApple
                          ? "bg-[#0071E3]/10 text-[#0071E3]"
                          : "bg-[#10B981]/20 text-[#10B981]"
                        : "bg-current/10 text-current"
                    }`}
                  >
                    {sourceModel}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {meeting.venue} · Race {currentRace?.raceNumber}
                </h3>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {trendsData && !isLoading && (
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                    isApple
                      ? "bg-white border-[#E5E5EA] hover:bg-[#F2F2F7] text-[#1D1D1F]"
                      : "bg-[#121A16] border-[#1F2D26] hover:bg-[#1A2420] text-[#F3F4F0]"
                  }`}
                  title="Copy Analysis to Clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[#34C759]" />
                      <span className="hidden sm:inline text-xs text-[#34C759] font-semibold">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 opacity-70" />
                      <span className="hidden sm:inline text-xs">Copy</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchRaceTrends(true)}
                disabled={isLoading}
                className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  isApple
                    ? "bg-white border-[#E5E5EA] hover:bg-[#F2F2F7] text-[#1D1D1F]"
                    : "bg-[#121A16] border-[#1F2D26] hover:bg-[#1A2420] text-[#F3F4F0]"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                title="Refresh AI Analysis"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  isApple
                    ? "bg-white border-[#E5E5EA] hover:bg-[#F2F2F7] text-[#1D1D1F]"
                    : "bg-[#121A16] border-[#1F2D26] hover:bg-[#1A2420] text-[#F3F4F0]"
                }`}
                aria-label="Close side panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Metadata Row */}
          <div
            className={`px-5 py-2.5 border-b text-xs flex flex-wrap items-center gap-2 ${
              isApple
                ? "bg-white/60 border-[#E5E5EA] text-[#86868B]"
                : "bg-[#090F0C] border-[#1F2D26] text-[#8A9990]"
            }`}
          >
            <span className="font-semibold text-current">{currentRace?.raceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{currentRace?.distance}m</span>
            <span aria-hidden="true">·</span>
            <span>Going: {meeting.trackRating}</span>
            <span aria-hidden="true">·</span>
            <span>Weather: {meeting.weather}</span>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Loading Skeleton */}
            {isLoading && (
              <div className="space-y-5 animate-pulse">
                <div
                  className={`p-4 rounded-2xl border flex items-center gap-3 ${
                    isApple
                      ? "bg-white border-[#E5E5EA]"
                      : "bg-[#101814] border-[#1F2D26]"
                  }`}
                >
                  <RefreshCw className="w-5 h-5 animate-spin text-[#0071E3]" />
                  <div>
                    <div className="text-xs font-semibold">
                      Generating Syndicate Market Breakdown...
                    </div>
                    <div className="text-[11px] text-[#86868B] mt-0.5">
                      Synthesizing speed maps, market depth, and model overlay edges with Gemini.
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div
                    className={`h-24 rounded-2xl ${
                      isApple ? "bg-[#E5E5EA]" : "bg-[#16201B]"
                    }`}
                  />
                  <div
                    className={`h-36 rounded-2xl ${
                      isApple ? "bg-[#E5E5EA]" : "bg-[#16201B]"
                    }`}
                  />
                  <div
                    className={`h-40 rounded-2xl ${
                      isApple ? "bg-[#E5E5EA]" : "bg-[#16201B]"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="p-4 rounded-2xl bg-[#FFF1F0] border border-[#FF3B30]/30 text-[#1D1D1F] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FF3B30]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Unable to complete AI analysis</span>
                </div>
                <p className="text-xs text-[#86868B]">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchRaceTrends(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FF3B30] text-white text-xs font-semibold hover:bg-[#E02D23] transition cursor-pointer"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {/* Content Display */}
            {trendsData && !isLoading && (
              <div className="space-y-6">
                {/* 1. Pace & Speed Map Scenario Banner */}
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isApple
                      ? "bg-white border-[#E5E5EA] shadow-xs"
                      : "bg-[#0F1713] border-[#1F2D26] shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap
                        className={`w-4 h-4 ${
                          isApple ? "text-[#0071E3]" : "text-[#10B981]"
                        }`}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono">
                        Pace &amp; Speed Map Dynamics
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                        trendsData.paceScenario.paceRating.toLowerCase().includes("fast") ||
                        trendsData.paceScenario.paceRating.toLowerCase().includes("hot")
                          ? "bg-[#FF9500]/15 text-[#FF9500]"
                          : trendsData.paceScenario.paceRating.toLowerCase().includes("genuine")
                          ? "bg-[#34C759]/15 text-[#34C759]"
                          : "bg-[#0071E3]/15 text-[#0071E3]"
                      }`}
                    >
                      {trendsData.paceScenario.paceRating} Pace
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">
                    {trendsData.paceScenario.speedMapDescription}
                  </p>

                  <div
                    className={`pt-2 border-t text-[11px] flex items-center justify-between ${
                      isApple ? "border-[#F2F2F7] text-[#86868B]" : "border-[#1F2D26] text-[#8A9990]"
                    }`}
                  >
                    <span>Favored Pattern:</span>
                    <span className="font-semibold text-current">
                      {trendsData.paceScenario.favoredRunStyle}
                    </span>
                  </div>
                </div>

                {/* 2. Executive Synopsis */}
                <div
                  className={`p-4 rounded-2xl border space-y-2 ${
                    isApple
                      ? "bg-[#F5F8FF] border-[#0071E3]/25 text-[#1D1D1F]"
                      : "bg-[#0D1C16] border-[#10B981]/30 text-[#F3F4F0]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame
                      className={`w-4 h-4 ${
                        isApple ? "text-[#0071E3]" : "text-[#10B981]"
                      }`}
                    />
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                      Executive Market Synopsis
                    </h4>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed font-medium">
                    {trendsData.synopsis}
                  </p>
                </div>

                {/* 2b. Trackside Banter & Beer Fund Widget */}
                <AussieTracksideBanterWidget
                  punters={punters}
                  meeting={meeting}
                  isApple={isApple}
                  customBanter={trendsData.aussieBanter}
                />

                {/* 3. Key Contenders Intelligence */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono">
                      <Target className="w-4 h-4 text-[#FF9500]" />
                      <span>Key Contenders Breakdown</span>
                    </div>
                    <span className="text-[11px] text-[#86868B]">
                      {trendsData.keyContenders.length} Highlighted
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {trendsData.keyContenders.map((contender, idx) => {
                      const is1st = currentSelections?.firstPref === contender.tabNumber;
                      const is2nd = currentSelections?.secondPref === contender.tabNumber;
                      const is3rd = currentSelections?.thirdPref === contender.tabNumber;

                      const roleBadgeColor =
                        contender.role === "Consensus Anchor"
                          ? isApple
                            ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/25"
                            : "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"
                          : contender.role === "Prime Value Overlay"
                          ? "bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30"
                          : contender.role === "Tactical Threat"
                          ? "bg-[#FF9500]/15 text-[#FF9500] border-[#FF9500]/30"
                          : "bg-current/10 text-current border-current/20";

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isApple
                              ? "bg-white border-[#E5E5EA] shadow-xs"
                              : "bg-[#0F1713] border-[#1F2D26] shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-current/10 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                  {contender.tabNumber}
                                </span>
                                <span className="font-bold text-sm">
                                  {contender.horseName}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${roleBadgeColor}`}
                                >
                                  {contender.role}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-xs text-[#0071E3] dark:text-[#38BDF8]">
                              {contender.odds}
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed mt-2 text-[#48484A] dark:text-[#B0BDB5]">
                            {contender.analysis}
                          </p>

                          {/* Quick Preference Assignment Buttons */}
                          {onAssignPreference && (
                            <div className="mt-3 pt-2 border-t border-current/10 flex items-center justify-between text-[11px]">
                              <span className="text-[#86868B]">Set Selection:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onAssignPreference(1, contender.tabNumber)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    is1st
                                      ? "bg-[#0071E3] text-white"
                                      : "bg-current/10 hover:bg-current/20 text-current"
                                  }`}
                                  title="Set 1st Pick"
                                >
                                  1st {is1st && "✓"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAssignPreference(2, contender.tabNumber)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    is2nd
                                      ? "bg-[#34C759] text-white"
                                      : "bg-current/10 hover:bg-current/20 text-current"
                                  }`}
                                  title="Set 2nd Pick"
                                >
                                  2nd {is2nd && "✓"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onAssignPreference(3, contender.tabNumber)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    is3rd
                                      ? "bg-[#FF9500] text-white"
                                      : "bg-current/10 hover:bg-current/20 text-current"
                                  }`}
                                  title="Set 3rd Pick"
                                >
                                  3rd {is3rd && "✓"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Syndicate Exotics & Strategy Blueprint */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isApple
                      ? "bg-white border-[#E5E5EA] shadow-xs"
                      : "bg-[#0F1713] border-[#1F2D26] shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers
                      className={`w-4 h-4 ${
                        isApple ? "text-[#AF52DE]" : "text-[#D4AF37]"
                      }`}
                    />
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                      Syndicate Exotics Blueprint
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-current">Trifecta Banker: </span>
                      <span className="text-[#48484A] dark:text-[#B0BDB5]">
                        {trendsData.exoticsStrategy.trifectaBanker}
                      </span>
                    </div>

                    {trendsData.exoticsStrategy.valueInclusions?.length > 0 && (
                      <div>
                        <span className="font-semibold text-current">
                          Exotic Multi-Inclusions:{" "}
                        </span>
                        <span className="text-[#48484A] dark:text-[#B0BDB5]">
                          {trendsData.exoticsStrategy.valueInclusions.join(" · ")}
                        </span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-current/10">
                      <span className="font-semibold text-current">Quaddie Strategy: </span>
                      <span className="text-[#48484A] dark:text-[#B0BDB5]">
                        {trendsData.exoticsStrategy.quaddieAngle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Key Takeaways Checklist */}
                <div
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    isApple
                      ? "bg-white border-[#E5E5EA] shadow-xs"
                      : "bg-[#0F1713] border-[#1F2D26] shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        isApple ? "text-[#34C759]" : "text-[#10B981]"
                      }`}
                    />
                    <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                      Executive Key Takeaways
                    </h4>
                  </div>

                  <ul className="space-y-1.5">
                    {trendsData.takeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-[#34C759] shrink-0 mt-0.5" />
                        <span className="leading-relaxed opacity-90">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div
            className={`p-4 border-t shrink-0 flex items-center justify-between text-xs ${
              isApple
                ? "bg-white/90 border-[#E5E5EA] text-[#86868B]"
                : "bg-[#0D1612]/95 border-[#1F2D26] text-[#8A9990]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]"></span>
              <span>Model Synced</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-current/10 hover:bg-current/15 text-current font-semibold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
