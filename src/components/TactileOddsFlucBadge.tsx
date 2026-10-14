import React from "react";
import { motion } from "motion/react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface TactileOddsFlucBadgeProps {
  openingOdds?: number;
  currentOdds?: number;
  marketSupport?: "Firming" | "Drifting" | "Steady";
  size?: "sm" | "md";
  heatGlow?: boolean;
  className?: string;
}

/**
 * Tactile Odds Fluc Badge with Framer Motion spring physics.
 * Animates steamer (firming) and drifter market movements with tactile hover and tap feedback.
 */
export const TactileOddsFlucBadge: React.FC<TactileOddsFlucBadgeProps> = ({
  openingOdds,
  currentOdds,
  marketSupport,
  size = "sm",
  heatGlow = true,
  className = "",
}) => {
  const isFirming = marketSupport === "Firming" || (openingOdds && currentOdds && currentOdds < openingOdds);
  const isDrifting = marketSupport === "Drifting" || (openingOdds && currentOdds && currentOdds > openingOdds);

  if (!isFirming && !isDrifting) {
    if (!openingOdds || !currentOdds) return null;
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[11px] text-[#8A9990] ${className}`}>
        ${currentOdds.toFixed(2)}
      </span>
    );
  }

  const diff = openingOdds && currentOdds ? Math.abs(currentOdds - openingOdds).toFixed(2) : null;

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
      title={
        isFirming
          ? `🔥 Firming Steamer: Backed from $${openingOdds?.toFixed(2)} into $${currentOdds?.toFixed(2)}${diff ? ` (-$${diff})` : ""}`
          : `❄️ Market Drifter: Eased from $${openingOdds?.toFixed(2)} out to $${currentOdds?.toFixed(2)}${diff ? ` (+$${diff})` : ""}`
      }
    >
      {isFirming ? (
        <>
          <TrendingDown className="w-3 h-3 text-[#10B981]" />
          <span>🔥 ${openingOdds?.toFixed(2)}→${currentOdds?.toFixed(2)}</span>
        </>
      ) : (
        <>
          <TrendingUp className="w-3 h-3 text-[#D4AF37]" />
          <span>❄️ ${openingOdds?.toFixed(2)}→${currentOdds?.toFixed(2)}</span>
        </>
      )}
    </motion.span>
  );
};
