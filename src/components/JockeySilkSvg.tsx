import React from "react";

interface JockeySilkSvgProps {
  primary?: string;
  secondary?: string;
  seed?: number;
}

const DEFAULT_PALETTES: Array<[string, string]> = [
  ["#10B981", "#F3F4F0"],
  ["#D4AF37", "#1E293B"],
  ["#3B82F6", "#FFFFFF"],
  ["#EF4444", "#FBBF24"],
  ["#8B5CF6", "#F3F4F0"],
  ["#EC4899", "#111827"],
  ["#06B6D4", "#FFFFFF"],
  ["#F59E0B", "#0B110E"],
];

export const JockeySilkSvg: React.FC<JockeySilkSvgProps> = ({
  primary,
  secondary,
  seed = 1,
}) => {
  const fallback = DEFAULT_PALETTES[Math.abs(seed) % DEFAULT_PALETTES.length];
  const c1 = primary || fallback[0];
  const c2 = secondary || fallback[1];
  const patternType = Math.abs(seed) % 4;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Sleeves & Torso Base */}
      <path
        d="M7 4L2 8L4.5 11.5L7 9.5V20H17V9.5L19.5 11.5L22 8L17 4H14.5C14 5.2 13.1 6 12 6C10.9 6 10 5.2 9.5 4H7Z"
        fill={c1}
        stroke="#26382F"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Pattern overlay based on seed */}
      {patternType === 0 && (
        /* Diagonal Sash */
        <path d="M7.5 5L16.5 19.5H13.5L7 9V5H7.5Z" fill={c2} />
      )}
      {patternType === 1 && (
        /* Vertical Stripe */
        <rect x="10.5" y="6" width="3" height="13.5" fill={c2} />
      )}
      {patternType === 2 && (
        /* Horizontal Hoop */
        <rect x="7.5" y="11" width="9" height="3.5" fill={c2} />
      )}
      {patternType === 3 && (
        /* Halves / Quarters accent */
        <rect x="12" y="6" width="4.5" height="13.5" fill={c2} />
      )}
    </svg>
  );
};
