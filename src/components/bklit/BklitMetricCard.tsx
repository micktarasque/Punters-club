import React from "react";

export interface BklitMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: {
    label: string;
    variant?: "positive" | "negative" | "warning" | "neutral" | "gold";
  };
  icon?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const BklitMetricCard: React.FC<BklitMetricCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon,
  className = "",
  highlight = false,
}) => {
  const getBadgeStyle = (variant = "neutral") => {
    switch (variant) {
      case "positive":
        return "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30";
      case "negative":
        return "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30";
      case "gold":
        return "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40";
      case "warning":
        return "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30";
      default:
        return "bg-[#1F2D26] text-[#8A9990] border-[#2D3F35]";
    }
  };

  return (
    <div
      className={`bklit-metric-card relative p-3.5 rounded-lg border transition-all ${
        highlight
          ? "bg-[#141E19] border-[#D4AF37]/60 shadow-[0_0_15px_rgba(212,175,55,0.08)]"
          : "bg-[#0B110E] border-[#1F2D26] hover:border-[#2D3F35]"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-wider text-[#8A9990] truncate">
          {title}
        </div>
        {icon && <div className="text-[#D4AF37] shrink-0">{icon}</div>}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#F3F4F0]">
          {value}
        </div>
        {badge && (
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${getBadgeStyle(
              badge.variant
            )}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-1 text-[11px] font-mono text-[#8A9990] truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
