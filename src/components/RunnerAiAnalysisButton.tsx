import React, { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";
import type { RaceEvent, RaceMeeting, RaceRunner } from "../types/racing";

interface RunnerAiAnalysisButtonProps {
  runner: RaceRunner;
  race?: Partial<RaceEvent>;
  meeting?: Partial<RaceMeeting>;
  size?: "xs" | "sm" | "md";
  showCardBelow?: boolean;
  className?: string;
}

// Client-side cache to prevent duplicate fetches across component re-renders
const analysisCache = new Map<string, string>();

export const RunnerAiAnalysisButton: React.FC<RunnerAiAnalysisButtonProps> = ({
  runner,
  race,
  meeting,
  size = "sm",
  showCardBelow = true,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(() => {
    const key = `${runner.horseName}-${runner.tabNumber}-${race?.raceNumber || 1}`;
    return analysisCache.get(key) || null;
  });
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${runner.horseName}-${runner.tabNumber}-${race?.raceNumber || 1}`;

  const fetchAnalysis = async (forceRefresh = false) => {
    if (!forceRefresh && analysisCache.has(cacheKey)) {
      setAnalysisText(analysisCache.get(cacheKey)!);
      setIsOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/runner-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runner: {
            tabNumber: runner.tabNumber,
            horseName: runner.horseName,
            barrier: runner.barrier,
            weight: runner.weight,
            jockey: runner.jockey,
            trainer: runner.trainer,
            form: runner.form,
            careerRecord: runner.careerRecord,
            speedRating: runner.speedRating,
            sectional600m: runner.sectional600m,
            speedMapPosition: runner.speedMapPosition,
            fixedWin: runner.fixedWin,
            fixedPlace: runner.fixedPlace,
            nswTabWin: runner.nswTabWin,
            comment: runner.formComment || (runner as any).comment || "",
          },
          raceContext: {
            raceName: race?.raceName,
            distance: race?.distance,
            trackCondition: meeting?.trackCondition,
            venue: meeting?.venue,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.analysis) {
        analysisCache.set(cacheKey, data.analysis);
        setAnalysisText(data.analysis);
        setIsOpen(true);
      } else {
        throw new Error("No analysis returned");
      }
    } catch (err: any) {
      console.warn("AI analysis request error:", err);
      // Fallback local summary
      const fallback = `${runner.horseName} (#${runner.tabNumber}) carries ${runner.weight}kg from barrier ${runner.barrier} with ${runner.jockey || "jockey"} engaged for a competitive showing.`;
      analysisCache.set(cacheKey, fallback);
      setAnalysisText(fallback);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      if (analysisText) {
        setIsOpen(true);
      } else {
        fetchAnalysis();
      }
    }
  };

  const btnSizeClasses =
    size === "xs"
      ? "px-2 py-0.5 text-[10px]"
      : size === "sm"
      ? "px-2.5 py-1 text-xs"
      : "px-3 py-1.5 text-xs";

  return (
    <div className={`inline-block relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        title="View AI-powered form performance summary"
        className={`inline-flex items-center gap-1.5 rounded-lg font-mono font-semibold transition-all cursor-pointer border select-none ${btnSizeClasses} ${
          isOpen
            ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.25)]"
            : "bg-[#0E1713] border-[#22352B] text-[#A6B5AD] hover:text-[#D4AF37] hover:border-[#D4AF37]/50 hover:bg-[#13201A]"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-[#D4AF37]" />
        ) : (
          <Sparkles className="w-3 h-3 text-[#D4AF37]" />
        )}
        <span>{isLoading ? "Analyzing..." : "Show Analysis"}</span>
        {analysisText && !isLoading && (
          isOpen ? (
            <ChevronUp className="w-2.5 h-2.5 opacity-70" />
          ) : (
            <ChevronDown className="w-2.5 h-2.5 opacity-70" />
          )
        )}
      </button>

      {/* Analysis Card Overlay / Dropdown */}
      {showCardBelow && isOpen && analysisText && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 left-0 mt-1.5 w-72 sm:w-84 max-w-[90vw] p-3 rounded-xl bg-[#09110D]/95 backdrop-blur-md border border-[#D4AF37]/40 shadow-[0_8px_24px_rgba(0,0,0,0.6)] text-left animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#1C2C23]">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#D4AF37]">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>AI Form Analysis</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchAnalysis(true)}
                disabled={isLoading}
                title="Regenerate analysis"
                className="p-1 rounded text-[#8A9990] hover:text-[#D4AF37] hover:bg-[#14221A] transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-[#8A9990] hover:text-white hover:bg-[#14221A] transition cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <p className="text-xs text-[#E1E8E4] leading-relaxed font-sans">
            {analysisText}
          </p>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#8A9990] pt-1.5 border-t border-[#1C2C23]">
            <span>#{runner.tabNumber} {runner.horseName}</span>
            <span className="text-[#10B981]">Gemini 3.8 Flash</span>
          </div>
        </div>
      )}
    </div>
  );
};
