import React, { useState } from "react";
import {
  Beer,
  Award,
  Flame,
  Copy,
  Check,
  Zap,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Trophy,
} from "lucide-react";
import {
  AussieBanterBundle,
  SyndicateAward,
  calculateBeerFund,
  calculateSyndicateAwards,
} from "../../utils/australianPunterBanter";
import { PunterProfile, RaceMeeting } from "../../types/racing";

interface AussieTracksideBanterWidgetProps {
  punters: PunterProfile[];
  meeting?: RaceMeeting;
  netProfit?: number;
  isApple?: boolean;
  customBanter?: {
    tracksideRoast?: string;
    punterCall?: string;
    goldenWhipTip?: string;
    beerFundImpact?: string;
  };
}

export const AussieTracksideBanterWidget: React.FC<
  AussieTracksideBanterWidgetProps
> = ({
  punters,
  meeting,
  netProfit = 42.5,
  isApple = true,
  customBanter,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const beerFund = calculateBeerFund(netProfit);
  const awards = calculateSyndicateAwards(punters, meeting, netProfit);

  const punter1 = punters[0]?.name || "Stevie F";
  const punter2 = punters[1]?.name || "Mark S";

  const defaultRoast =
    customBanter?.tracksideRoast ||
    `${punter1} was seen strutting toward the members bar claiming his tip is safer than government bonds, while ${punter2} is quietly loading the roughie for glory!`;

  const handleCopyChatBanter = () => {
    const text = `🍻 TURFSHEET PUNTERS CLUB TRACKSIDE DISPATCH 🏇
Venue: ${meeting?.venue || "Sydney & Melbourne"} · Net Beer Fund: ${beerFund.pintsFunded} Pints

🏆 THE GOLDEN WHIP: ${awards[0]?.recipientName || punter1} (${awards[0]?.statHighlight || "Sharp Selections"})
🪵 THE WOODEN STIRRUP: ${awards[1]?.recipientName || punter2} (Shouting the next round!)

🗣️ Trackside Banter:
"${defaultRoast}"

🍺 Syndicate Pot: ${beerFund.headline}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 transition-all ${
        isApple
          ? "bg-gradient-to-br from-[#FFF9F0] via-white to-[#F5F8FF] border-[#E5E5EA] shadow-xs"
          : "bg-gradient-to-br from-[#161D18] via-[#0E1512] to-[#121B16] border-[#2A3F33] shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-current/10">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isApple
                ? "bg-[#FF9500]/15 text-[#FF9500]"
                : "bg-[#D4AF37]/20 text-[#D4AF37]"
            }`}
          >
            <Beer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isApple ? "text-[#FF9500]" : "text-[#D4AF37]"
                }`}
              >
                Trackside Banter &amp; Beer Fund
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono bg-current/10 text-current">
                Live Syndicate Culture
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              The Punt Club Roast &amp; Toast
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyChatBanter}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer self-start sm:self-auto ${
            isApple
              ? "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F2F2F7] shadow-xs"
              : "bg-[#16231C] border-[#2A3F33] text-[#F3F4F0] hover:bg-[#1E3027] shadow-sm"
          }`}
          title="Copy Banter for WhatsApp or SMS Group"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#34C759]" />
              <span className="text-[#34C759]">Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>Copy for Group Chat</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Beer Fund Callout & Syndicate Roast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Beer Fund Progress Box */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isApple
              ? "bg-white border-[#E5E5EA] shadow-xs"
              : "bg-[#09100C] border-[#1F2D26]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#86868B]">
                Syndicate Refreshments
              </span>
              <span className="text-base font-bold">🍻</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-[#FF9500]">
                {beerFund.pintsFunded}
              </span>
              <span className="text-xs text-[#86868B] font-medium">
                Pints Banked
              </span>
            </div>
            <p className="text-xs mt-2 leading-relaxed opacity-85">
              {beerFund.headline}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-current/10 text-[10px] font-mono font-bold text-[#34C759]">
            {beerFund.statusText}
          </div>
        </div>

        {/* Trackside Roast Bubble */}
        <div
          className={`md:col-span-2 p-4 rounded-xl border flex flex-col justify-between ${
            isApple
              ? "bg-[#F7FAFC] border-[#E5E5EA]"
              : "bg-[#09100C] border-[#1F2D26]"
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#FF9500]">
              <Flame className="w-3.5 h-3.5" />
              <span>SYNDICATE TRACKSIDE ROAST</span>
            </div>
            <p className="text-xs sm:text-sm mt-2 italic leading-relaxed opacity-90 font-medium">
              "{defaultRoast}"
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-current/10 flex items-center justify-between text-[11px] text-[#86868B]">
            <span>Active Punter Squad:</span>
            <span className="font-semibold text-current">
              {punters.map((p) => p.name).join(" vs. ")}
            </span>
          </div>
        </div>
      </div>

      {/* Awards Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
        {awards.map((award, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
              isApple
                ? "bg-white border-[#E5E5EA] shadow-xs"
                : "bg-[#0B130F] border-[#1F2D26]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-lg">{award.emoji}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-current/10 text-current">
                  {award.badge}
                </span>
              </div>
              <h4 className="font-bold text-sm mt-1">{award.title}</h4>
              <div className="text-xs font-semibold text-[#0071E3] dark:text-[#38BDF8] mt-0.5">
                {award.recipientName}
              </div>
              <p className="text-[11px] mt-1 leading-snug opacity-75">
                {award.description}
              </p>
            </div>
            {award.beerFundImpact && (
              <div className="mt-2.5 pt-1.5 border-t border-current/10 text-[10px] font-mono text-[#34C759] font-bold">
                {award.beerFundImpact}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
