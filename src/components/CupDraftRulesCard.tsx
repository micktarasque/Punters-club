import React, { useState } from "react";
import {
  Trophy,
  Shuffle,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertCircle,
  Users,
  Scale,
  Award,
  ArrowRight,
  Flame,
  BookmarkCheck,
} from "lucide-react";
import { CupTournamentState } from "../types/cupMode";
import { getDraftOrderForRace } from "../utils/cupMode";

interface CupDraftRulesCardProps {
  tournament?: CupTournamentState;
  participants?: string[];
  activeRaceNumber?: number;
  isApple?: boolean;
  isObsidian?: boolean;
  defaultExpanded?: boolean;
  compactMode?: boolean;
  onOpenRulesModal?: () => void;
}

export const CupDraftRulesCard: React.FC<CupDraftRulesCardProps> = ({
  tournament,
  participants = tournament?.participants || ["Steve F", "Mark S", "Dave W"],
  activeRaceNumber = tournament?.activeRaceNumber || 1,
  isApple = false,
  isObsidian = false,
  defaultExpanded = true,
  compactMode = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("turfsheet_cup_rules_expanded_v1");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return defaultExpanded;
  });

  const [activeTab, setActiveTab] = useState<"overview" | "snake" | "fallback" | "exotics" | "scoring">(
    "overview"
  );
  const [previewRaceNo, setPreviewRaceNo] = useState<number>(activeRaceNumber || 1);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("turfsheet_cup_rules_expanded_v1", String(next));
      } catch {}
      return next;
    });
  };

  const oddOrder = getDraftOrderForRace(1, participants, tournament?.draftType || "snake");
  const evenOrder = getDraftOrderForRace(2, participants, tournament?.draftType || "snake");
  const isOdd = previewRaceNo % 2 === 1;
  const currentPreviewOrder = getDraftOrderForRace(previewRaceNo, participants, tournament?.draftType || "snake");

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
        isApple
          ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
          : isObsidian
          ? "bg-[#111827] border-[#1E293B] text-[#F1F5F9]"
          : "bg-[#0E1512] border-[#2A3F33] text-[#F3F4F0]"
      }`}
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-current/10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B38F24] text-[#070B09] flex items-center justify-center font-bold text-lg shadow-md shrink-0">
            🏆
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Syndicate Cup Mode</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-bold">
                Official Draft Rules
              </span>
              <span className="text-[10px] font-mono opacity-60 hidden sm:inline">
                Snake Priority · Mutual Exclusivity · Auto-Fallback
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold mt-0.5 tracking-tight flex items-center gap-2">
              <span>Live Draft Rules &amp; Selection Mechanics</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Quick Pillar Highlights on Tablet / Desktop */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono opacity-80 mr-2">
            <span className="px-2 py-0.5 rounded bg-current/5 border border-current/10">
              🐍 Snake Rotation
            </span>
            <span className="px-2 py-0.5 rounded bg-current/5 border border-current/10">
              🔒 1 Runner / Punter
            </span>
            <span className="px-2 py-0.5 rounded bg-current/5 border border-current/10">
              ⚡ 8-Rank Fallbacks
            </span>
          </div>

          <button
            type="button"
            onClick={toggleExpanded}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              isApple
                ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                : isObsidian
                ? "bg-[#1E293B] border-[#334155] text-[#F1F5F9] hover:border-[#38BDF8]"
                : "bg-[#132019] border-[#22352B] text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37]"
            }`}
          >
            <span>{isExpanded ? "Collapse Rules" : "View Draft Rules"}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsed Compact Strip */}
      {!isExpanded && (
        <div className="px-4 py-2.5 text-xs font-mono opacity-75 flex flex-wrap items-center justify-between gap-2 bg-current/[0.02]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#D4AF37]">Rule Summary:</span>
            <span>1. Snake draft rotates pick priority (R1: 1→2→3, R2: 3→2→1)</span>
            <span>·</span>
            <span>2. Strictly 1 unique horse per member</span>
            <span>·</span>
            <span>3. Top pick taken? Auto-falls back to next preference</span>
            <span>·</span>
            <span>4. Builds group Trifectas &amp; Quaddies</span>
          </div>
          <button
            type="button"
            onClick={toggleExpanded}
            className="text-[11px] font-semibold text-[#0071E3] dark:text-[#10B981] hover:underline cursor-pointer"
          >
            Expand Details →
          </button>
        </div>
      )}

      {/* Expanded Content View */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-5">
          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-current/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === "overview"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] shadow-xs"
                  : "bg-current/5 text-current opacity-70 hover:opacity-100"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>1. Overview &amp; Principles</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("snake")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === "snake"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] shadow-xs"
                  : "bg-current/5 text-current opacity-70 hover:opacity-100"
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>2. Snake Draft Rotation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("fallback")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === "fallback"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] shadow-xs"
                  : "bg-current/5 text-current opacity-70 hover:opacity-100"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>3. Uniqueness &amp; Fallbacks</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("exotics")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === "exotics"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] shadow-xs"
                  : "bg-current/5 text-current opacity-70 hover:opacity-100"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>4. Syndicate Exotics Impact</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scoring")}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer font-bold ${
                activeTab === "scoring"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : "bg-[#D4AF37] text-[#070B09] shadow-xs"
                  : "bg-current/5 text-current opacity-70 hover:opacity-100"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>5. Scoring &amp; 🃏 Joker 2×</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  isApple ? "bg-[#FAF9FA] border-[#E5E5EA]" : "bg-current/5 border-current/10"
                }`}
              >
                <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-xs font-mono uppercase tracking-wider">
                  <Shuffle className="w-4 h-4" />
                  <span>Rule 1: Snake Order</span>
                </div>
                <h4 className="font-bold text-sm">Equitable Pick Rotations</h4>
                <p className="text-xs opacity-80 leading-relaxed">
                  Turn order reverses every race. If you draft last in Race 1, you automatically get <strong>1st pick in Race 2</strong>.
                  This eliminates any single-player bias across the entire race meeting.
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#10B981]">
                  ✓ Odd races: 1 → 2 → 3<br />
                  ✓ Even races: 3 → 2 → 1
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  isApple ? "bg-[#FAF9FA] border-[#E5E5EA]" : "bg-current/5 border-current/10"
                }`}
              >
                <div className="flex items-center gap-2 text-[#10B981] font-bold text-xs font-mono uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Rule 2: Mutual Exclusivity</span>
                </div>
                <h4 className="font-bold text-sm">Strictly 1 Runner Per User</h4>
                <p className="text-xs opacity-80 leading-relaxed">
                  No horse can ever be drafted twice in the same race. Every participant holds a unique runner, ensuring total
                  diversification and excitement as the field jumps.
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#10B981]">
                  ✓ Zero duplicate runners<br />
                  ✓ 100% distinct syndicate coverage
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  isApple ? "bg-[#FAF9FA] border-[#E5E5EA]" : "bg-current/5 border-current/10"
                }`}
              >
                <div className="flex items-center gap-2 text-[#0071E3] font-bold text-xs font-mono uppercase tracking-wider">
                  <Zap className="w-4 h-4" />
                  <span>Rule 3: 8-Rank Auto-Fallback</span>
                </div>
                <h4 className="font-bold text-sm">Automated Priority Backup</h4>
                <p className="text-xs opacity-80 leading-relaxed">
                  Users pre-rank up to 8 horses. If an earlier drafter snaps up your #1 pick, the engine immediately steps to your #2,
                  #3, or next available choice without needing manual re-entry.
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#0071E3]">
                  ✓ Automated draft resolution<br />
                  ✓ Your highest free preference is yours
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SNAKE ROTATION */}
          {activeTab === "snake" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-current/5 border border-current/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-[#D4AF37]" />
                      <span>Live Turn Order Simulator for Syndicate Members</span>
                    </h4>
                    <p className="text-xs opacity-75 mt-0.5">
                      Toggle race numbers to inspect exactly who drafts 1st, 2nd, and 3rd for any race on the card.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="opacity-70">Race:</span>
                    {[1, 2, 3, 4, 5].map((rNo) => (
                      <button
                        key={rNo}
                        type="button"
                        onClick={() => setPreviewRaceNo(rNo)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
                          previewRaceNo === rNo
                            ? "bg-[#D4AF37] text-[#070B09] border-[#D4AF37]"
                            : "bg-current/5 border-current/10 hover:bg-current/10"
                        }`}
                      >
                        R{rNo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Turn Strip */}
                <div className="p-3.5 rounded-xl bg-black/20 border border-current/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#D4AF37]">
                      Race {previewRaceNo} ({isOdd ? "Odd Race → Forward Order" : "Even Race → Reverse / Snake Order"}):
                    </span>
                    <span className="opacity-70">
                      {participants.length} Syndicate Drafters
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {currentPreviewOrder.map((name, idx) => (
                      <div
                        key={name}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 font-mono ${
                          idx === 0
                            ? "bg-[#10B981]/15 border-[#10B981]/50 text-current"
                            : idx === 1
                            ? "bg-[#0071E3]/15 border-[#0071E3]/50 text-current"
                            : "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-current"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              idx === 0
                                ? "bg-[#10B981] text-[#070B09]"
                                : idx === 1
                                ? "bg-[#0071E3] text-white"
                                : "bg-[#D4AF37] text-[#070B09]"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-sans font-semibold text-xs">{name}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold opacity-80">
                          {idx === 0 ? "1st Pick" : idx === 1 ? "2nd Pick" : "3rd Pick"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs opacity-80 leading-relaxed font-mono">
                  💡 <strong>Notice:</strong> In Race 1, <strong>{oddOrder[0]}</strong> picks 1st while <strong>{oddOrder[oddOrder.length - 1]}</strong> picks last.
                  In Race 2, the order snakes backwards so <strong>{evenOrder[0]}</strong> picks 1st, giving every member equal access to top market favourites.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UNIQUENESS & FALLBACKS */}
          {activeTab === "fallback" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-current/5 border border-current/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#D4AF37]" />
                  <h4 className="font-bold text-sm">Worked Live Fallback Scenario</h4>
                </div>
                <p className="text-xs opacity-85 leading-relaxed">
                  Here is how the automated priority draft handles two or more participants wanting the exact same runner:
                </p>

                {/* Step-by-Step Box */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3.5 rounded-xl border border-current/10 bg-black/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[#10B981] font-bold">
                      <span>Step 1: Steve F drafts 1st</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10B981]/20">Pick 1</span>
                    </div>
                    <p className="text-[11px] opacity-80">
                      Steve ranks <strong>#3 (1st)</strong>, #5 (2nd), #8 (3rd).
                    </p>
                    <div className="p-2 rounded-lg bg-[#10B981]/15 text-[#10B981] font-bold text-[11px] flex items-center justify-between">
                      <span>Allocated: #3</span>
                      <span>✓ 1st Pref</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-1.5">
                    <div className="flex items-center justify-between text-amber-500 font-bold">
                      <span>Step 2: Mark S drafts 2nd</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20">Fallback!</span>
                    </div>
                    <p className="text-[11px] opacity-80">
                      Mark also ranked <strong>#3 (1st)</strong>, #7 (2nd), #2 (3rd).
                    </p>
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center justify-between">
                      <span>Allocated: #7</span>
                      <span>⚡ 2nd Pref Fallback</span>
                    </div>
                    <div className="text-[10px] opacity-75">
                      #3 was taken by Steve F, so Mark automatically receives his next choice (#7).
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-current/10 bg-black/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[#0071E3] font-bold">
                      <span>Step 3: Dave W drafts 3rd</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0071E3]/20">Pick 3</span>
                    </div>
                    <p className="text-[11px] opacity-80">
                      Dave ranks <strong>#1 (1st)</strong>, #3 (2nd), #7 (3rd).
                    </p>
                    <div className="p-2 rounded-lg bg-[#0071E3]/15 text-[#0071E3] font-bold text-[11px] flex items-center justify-between">
                      <span>Allocated: #1</span>
                      <span>✓ 1st Pref</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center gap-2 text-xs font-mono text-[#10B981]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Syndicate Result:</strong> Mutually exclusive runners <strong>#1, #3, and #7</strong> are drafted. Mark is clearly shown why he received #7 (fallback).
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYNDICATE EXOTICS IMPACT */}
          {activeTab === "exotics" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-current/5 border border-current/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D4AF37]" />
                  <h4 className="font-bold text-sm">Building the Group's Exotic Pools (Trifectas &amp; Quaddies)</h4>
                </div>
                <p className="text-xs opacity-85 leading-relaxed">
                  In Syndicate Cup Mode, the group's exotic bets are constructed directly from the members' <strong>allocated draft runners</strong>:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 space-y-2">
                    <div className="font-bold text-[#D4AF37] flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <span>Combined Boxed Trifecta</span>
                    </div>
                    <p className="text-[11px] opacity-85 leading-relaxed font-sans">
                      Because each member's allocated runner is unique, combining their picks produces a distinct, high-yield Boxed Trifecta ticket.
                    </p>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-current/10 space-y-1 text-[11px]">
                      <div>• 3 Members = <strong>3 Boxed Horses</strong> (6 combos · $6 full unit · $20 bet = <strong>333% Flexi</strong>)</div>
                      <div>• 4 Members = <strong>4 Boxed Horses</strong> (24 combos · $24 full unit · $20 bet = <strong>83.3% Flexi</strong>)</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 space-y-2">
                    <div className="font-bold text-[#10B981] flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>Combined 4-Leg Quaddie</span>
                    </div>
                    <p className="text-[11px] opacity-85 leading-relaxed font-sans">
                      For each of the last 4 races on the card (Quaddie legs 1, 2, 3, 4), the syndicate's base ticket incorporates each member's allocated runner.
                    </p>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-current/10 space-y-1 text-[11px]">
                      <div>• Leg selections: Member A pick + Member B pick + Member C pick</div>
                      <div>• Plus optional <strong>Quaddie-Only Extras</strong> for high-odds safety insurance!</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SCORING & JOKER */}
          {activeTab === "scoring" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-current/5 border border-current/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#D4AF37]" />
                  <h4 className="font-bold text-sm">Tournament Scoring &amp; Joker Round Rules</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded-xl border border-current/10 bg-black/20 space-y-2">
                    <div className="font-bold text-[#10B981] flex items-center justify-between">
                      <span>Standard Point System (Per Race)</span>
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                    <ul className="space-y-1 text-[11px] opacity-90">
                      <li className="flex justify-between py-1 border-b border-current/10">
                        <span>🥇 1st Place (Winner):</span>
                        <strong className="text-[#10B981]">10 Points</strong>
                      </li>
                      <li className="flex justify-between py-1 border-b border-current/10">
                        <span>🥈 2nd Place:</span>
                        <strong className="text-[#10B981]">5 Points</strong>
                      </li>
                      <li className="flex justify-between py-1 border-b border-current/10">
                        <span>🥉 3rd Place:</span>
                        <strong className="text-[#10B981]">3 Points</strong>
                      </li>
                      <li className="flex justify-between py-1">
                        <span>4th Place:</span>
                        <strong className="opacity-80">1 Point</strong>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 space-y-2">
                    <div className="font-bold text-[#D4AF37] flex items-center justify-between">
                      <span>🃏 Nominated Joker Round (2× Points)</span>
                      <Flame className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed font-sans">
                      Each participant can nominate <strong>one Joker Race</strong> per race meeting (defaults to the Feature Cup race).
                    </p>
                    <div className="p-2.5 rounded-lg bg-black/30 border border-current/10 text-[11px] space-y-1">
                      <div>• If your allocated horse wins in your Joker Round: <strong>20 Points (2×)</strong></div>
                      <div>• Or <strong>2× TAB Win/Place Dividend</strong> in Dollar Return scoring mode!</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
