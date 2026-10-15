import React from "react";
import { motion } from "motion/react";
import { TrendingDown, TrendingUp, ArrowDown, ArrowUp, Minus } from "lucide-react";

export interface OddsTrendInfo {
  trend: "shortening" | "drifting" | "steady";
  diff: number | null;
  basePrice: number | null;
  isRecentUpdate: boolean;
  tooltip: string;
}

/**
 * Computes deterministic or live odds trends (shortening / drifting / steady)
 * by prioritizing recent updates, then fluc stream, and finally opening odds.
 */
export function computeOddsTrend(params: {
  currentOdds?: number;
  previousOdds?: number;
  openingOdds?: number;
  marketSupport?: "Firming" | "Drifting" | "Steady";
  flucs?: string[];
}): OddsTrendInfo {
  const current = Number(params.currentOdds) || 0;
  const previous = Number(params.previousOdds) || 0;
  const opening = Number(params.openingOdds) || 0;
  const flucs = params.flucs || [];

  // Check 1: Explicit previousOdds from live price update
  if (previous > 0 && current > 0 && Math.abs(current - previous) >= 0.01) {
    const diff = Number((current - previous).toFixed(2));
    if (diff < 0) {
      return {
        trend: "shortening",
        diff: Math.abs(diff),
        basePrice: previous,
        isRecentUpdate: true,
        tooltip: `Odds Shortening: backed in from $${previous.toFixed(2)} to $${current.toFixed(2)} (-$${Math.abs(diff).toFixed(2)}) since last update`,
      };
    } else {
      return {
        trend: "drifting",
        diff: Math.abs(diff),
        basePrice: previous,
        isRecentUpdate: true,
        tooltip: `Odds Drifting: eased out from $${previous.toFixed(2)} to $${current.toFixed(2)} (+$${Math.abs(diff).toFixed(2)}) since last update`,
      };
    }
  }

  // Check 2: Flucs history array (latest price vs previous price)
  if (flucs.length >= 2 && current > 0) {
    const lastFluc = Number(flucs[flucs.length - 1]);
    const prevFluc = Number(flucs[flucs.length - 2]);
    if (lastFluc > 0 && prevFluc > 0 && Math.abs(lastFluc - prevFluc) >= 0.01) {
      const diff = Number((lastFluc - prevFluc).toFixed(2));
      if (diff < 0) {
        return {
          trend: "shortening",
          diff: Math.abs(diff),
          basePrice: prevFluc,
          isRecentUpdate: true,
          tooltip: `Odds Shortening: tightened from $${prevFluc.toFixed(2)} to $${lastFluc.toFixed(2)} (-$${Math.abs(diff).toFixed(2)})`,
        };
      } else {
        return {
          trend: "drifting",
          diff: Math.abs(diff),
          basePrice: prevFluc,
          isRecentUpdate: true,
          tooltip: `Odds Drifting: eased out from $${prevFluc.toFixed(2)} to $${lastFluc.toFixed(2)} (+$${Math.abs(diff).toFixed(2)})`,
        };
      }
    }
  }

  // Check 3: Current vs Opening odds
  if (opening > 0 && current > 0 && Math.abs(current - opening) >= 0.05) {
    const diff = Number((current - opening).toFixed(2));
    if (diff < 0) {
      return {
        trend: "shortening",
        diff: Math.abs(diff),
        basePrice: opening,
        isRecentUpdate: false,
        tooltip: `Market Shortening: firming into $${current.toFixed(2)} from $${opening.toFixed(2)} open (-$${Math.abs(diff).toFixed(2)})`,
      };
    } else {
      return {
        trend: "drifting",
        diff: Math.abs(diff),
        basePrice: opening,
        isRecentUpdate: false,
        tooltip: `Market Drifting: eased out to $${current.toFixed(2)} from $${opening.toFixed(2)} open (+$${Math.abs(diff).toFixed(2)})`,
      };
    }
  }

  // Check 4: Qualitative marketSupport
  if (params.marketSupport === "Firming") {
    return {
      trend: "shortening",
      diff: null,
      basePrice: opening || null,
      isRecentUpdate: false,
      tooltip: "Market Shortening: odds tightening with strong punter backing",
    };
  }
  if (params.marketSupport === "Drifting") {
    return {
      trend: "drifting",
      diff: null,
      basePrice: opening || null,
      isRecentUpdate: false,
      tooltip: "Market Drifting: odds easing out with lighter support",
    };
  }

  return {
    trend: "steady",
    diff: null,
    basePrice: current || opening || null,
    isRecentUpdate: false,
    tooltip: current > 0 ? `Odds Steady at $${current.toFixed(2)}` : "Odds Steady",
  };
}

export interface OddsTrendIndicatorProps {
  currentOdds?: number;
  previousOdds?: number;
  openingOdds?: number;
  marketSupport?: "Firming" | "Drifting" | "Steady";
  flucs?: string[];
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  showDiff?: boolean;
  className?: string;
}

/**
 * Visual Trend Indicator (Up/Down Arrow) for Race Runner Cards.
 * Shows if the horse's odds have been shortening (down arrow ↓ in emerald)
 * or drifting (up arrow ↑ in gold) since the last update.
 */
export const OddsTrendIndicator: React.FC<OddsTrendIndicatorProps> = ({
  currentOdds,
  previousOdds,
  openingOdds,
  marketSupport,
  flucs,
  size = "sm",
  showLabel = true,
  showDiff = false,
  className = "",
}) => {
  const trendInfo = computeOddsTrend({
    currentOdds,
    previousOdds,
    openingOdds,
    marketSupport,
    flucs,
  });

  if (trendInfo.trend === "shortening") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold rounded-md select-none transition-colors ${
          size === "xs"
            ? "px-1 py-0.2 text-[9px]"
            : size === "sm"
            ? "px-1.5 py-0.5 text-[10px]"
            : "px-2 py-0.5 text-xs"
        } bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40 ${className}`}
        title={trendInfo.tooltip}
      >
        <ArrowDown
          className={`${
            size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"
          } stroke-[3] shrink-0 text-[#10B981]`}
        />
        {showLabel && <span>Shortening</span>}
        {showDiff && trendInfo.diff && (
          <span className="opacity-90">(-${trendInfo.diff.toFixed(2)})</span>
        )}
      </span>
    );
  }

  if (trendInfo.trend === "drifting") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold rounded-md select-none transition-colors ${
          size === "xs"
            ? "px-1 py-0.2 text-[9px]"
            : size === "sm"
            ? "px-1.5 py-0.5 text-[10px]"
            : "px-2 py-0.5 text-xs"
        } bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 ${className}`}
        title={trendInfo.tooltip}
      >
        <ArrowUp
          className={`${
            size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"
          } stroke-[3] shrink-0 text-[#D4AF37]`}
        />
        {showLabel && <span>Drifting</span>}
        {showDiff && trendInfo.diff && (
          <span className="opacity-90">(+${trendInfo.diff.toFixed(2)})</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium rounded-md select-none ${
        size === "xs"
          ? "px-1 py-0.2 text-[9px]"
          : size === "sm"
          ? "px-1.5 py-0.5 text-[10px]"
          : "px-2 py-0.5 text-xs"
      } bg-[#121B16] text-[#8A9990] border border-[#1F2D26] ${className}`}
      title={trendInfo.tooltip}
    >
      <Minus className={`${size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} shrink-0`} />
      {showLabel && <span>Steady</span>}
    </span>
  );
};

export interface TactileOddsFlucBadgeProps {
  openingOdds?: number;
  currentOdds?: number;
  previousOdds?: number;
  flucs?: string[];
  marketSupport?: "Firming" | "Drifting" | "Steady";
  size?: "sm" | "md";
  heatGlow?: boolean;
  className?: string;
}

/**
 * Tactile Odds Fluc Badge with Framer Motion spring physics.
 * Displays visual trend arrows (down arrow ↓ for shortening/firming, up arrow ↑ for drifting/lengthening).
 */
export const TactileOddsFlucBadge: React.FC<TactileOddsFlucBadgeProps> = ({
  openingOdds,
  currentOdds,
  previousOdds,
  flucs,
  marketSupport,
  size = "sm",
  heatGlow = true,
  className = "",
}) => {
  const trendInfo = computeOddsTrend({
    currentOdds,
    previousOdds,
    openingOdds,
    marketSupport,
    flucs,
  });

  if (trendInfo.trend === "steady") {
    if (!openingOdds || !currentOdds) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[11px] text-[#8A9990] ${className}`}
        title={`Odds Steady at $${currentOdds.toFixed(2)}`}
      >
        <Minus className="w-2.5 h-2.5" />
        <span>${currentOdds.toFixed(2)}</span>
      </span>
    );
  }

  const isFirming = trendInfo.trend === "shortening";
  const displayBase = trendInfo.basePrice || openingOdds;
  const diffStr = trendInfo.diff ? Math.abs(trendInfo.diff).toFixed(2) : null;

  return (
    <motion.span
      className={`inline-flex items-center gap-1 rounded font-mono font-semibold select-none cursor-help ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${
        isFirming
          ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40"
          : "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40"
      } ${className}`}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      title={trendInfo.tooltip}
    >
      {isFirming ? (
        <>
          <ArrowDown className="w-3 h-3 text-[#10B981] stroke-[2.5]" />
          <span>
            {displayBase && currentOdds ? `$${displayBase.toFixed(2)}→$${currentOdds.toFixed(2)}` : "Shortening"}
            {diffStr ? ` (-$${diffStr})` : ""}
          </span>
        </>
      ) : (
        <>
          <ArrowUp className="w-3 h-3 text-[#D4AF37] stroke-[2.5]" />
          <span>
            {displayBase && currentOdds ? `$${displayBase.toFixed(2)}→$${currentOdds.toFixed(2)}` : "Drifting"}
            {diffStr ? ` (+$${diffStr})` : ""}
          </span>
        </>
      )}
    </motion.span>
  );
};
