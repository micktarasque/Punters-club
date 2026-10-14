import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface RollingDividendCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

/**
 * React Bits & Framer Motion inspired Tactile Rolling Dividend Counter.
 * Animates numbers rolling up/down with spring physics and high-DPI tabular-nums formatting.
 */
export const RollingDividendCounter: React.FC<RollingDividendCounterProps> = ({
  value,
  prefix = "$",
  suffix = "",
  decimals = 2,
  className = "",
  duration = 0.65,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (value === prevValueRef.current) return;
    const isUp = value > prevValueRef.current;
    setDirection(isUp ? "up" : "down");
    prevValueRef.current = value;

    const startVal = displayValue;
    const endVal = value;
    const startTime = performance.now();
    const durationMs = duration * 1000;

    let animId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Spring-like cubic out easing
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  const formatted = displayValue.toFixed(decimals);

  return (
    <motion.span
      className={`inline-flex items-center font-mono tabular-nums select-none ${className}`}
      key={`${value}`}
      initial={{ opacity: 0.8, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
    >
      {prefix && <span>{prefix}</span>}
      <span>{formatted}</span>
      {suffix && <span>{suffix}</span>}
    </motion.span>
  );
};
