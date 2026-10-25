# Implementation Plan: Visual Race Countdown Timer, Progressive Stepper & Data Leverage (Completed)

Deliver an intuitive, progressive race inspection experience featuring a live visual countdown timer card with an animated SVG progress ring and next-jump alerts, a step-by-step sequential race analysis workflow, career closing speed percentile rankings, live betting market mover indicators, and a CSS-based smooth rotation animation for the countdown ring as time ticks down to zero.

---

## 1. Specifications & Visual Experience

1. **Visual Race Countdown Timer with Smooth CSS Rotation**:
   - Prominent countdown card in the race header.
   - Circular SVG progress ring reflecting the countdown time relative to race jump.
   - **Continuous CSS Rotation Animation**:
     - Pure CSS keyframe rotation (`countdown-ring-spin`) running at 60/120fps with `transform: rotate` and `transform-origin: 28px 28px`.
     - **Dynamic Speed Acceleration**: Automatically accelerates rotation as time ticks down to zero:
       - `> 20 mins`: Calm 14s continuous sweep.
       - `10–20 mins`: 9s revolution.
       - `5–10 mins`: 6s revolution.
       - `2–5 mins`: 3.5s brisk turn.
       - `< 2 mins` (Imminent): Urgent 1.8s revolution with radiant crimson glow pulse (`countdown-ring-imminent-flash`).
       - Final 30 seconds: 1.0s rapid spin.
       - `Gates Open / Racing Now`: 0.75s emerald sprint sweep.
       - `Finalized`: Smoothly pauses and locks to 12 o'clock complete state.
     - **Outer Chronometer Bezel Track**: Subtle orbiting track markings (`countdown-bezel-orbit-track`) echoing luxury chronometer dials.
     - **Reduced Motion Support**: Full `@media (prefers-reduced-motion: reduce)` compliance.
   - High-contrast digital clock readout (`MM:SS` or `HH:MM:SS`), jump status pill (`Fixed Odds Open` -> `Firming` -> `Imminent Jump < 2m` -> `Racing Now`), official jump time (e.g., `14:25 AEDT`), and next-race jump alert with quick-switch capability if the active race is completed.

2. **Progressive Stepper Layout for Race Inspection**:
   - Clean, sequential 3-step inspection mode (`1. Speed Map & Pace` -> `2. Key Form & Market Flucs` -> `3. Syndicate Consensus & Selections`).
   - Quick jump pills between steps with completion badges and clear visual hierarchy.
   - Smooth transitions without cluttering the screen on mobile or desktop.
   - Mode switcher allowing punters to toggle between "⚡️ Progressive Stepper" and "📑 Full Sheet" at any time.

3. **Data Leverage & Runner Analytics**:
   - **Career Closing Speed Percentile**: Calculated and displayed for each runner (e.g. `Top 10% Burst`, `Top 25% Finisher`, `88th %ile`), integrated on both standard table rows and mobile card views.
   - **Market Movers & Fluc Alerts**: Visual steam/drift indicators (`FIRMING 🔥 (-15%)`, `DRIFTING ❄️ (+20%)`, `SOLID ⚖️`) so punters can immediately spot smart money moves.

---

## 2. Changes Completed

### `src/index.css`
- Added `@keyframes countdown-ring-spin` from `-90deg` to `270deg` with hardware-accelerated transform.
- Added `@keyframes countdown-ring-glow-pulse` and `@keyframes countdown-ring-imminent-flash` for multi-layered drop-shadow neon glows.
- Added `.countdown-progress-ring-spinner`, `.countdown-progress-ring-glow-urgent`, `.countdown-progress-ring-glow-imminent`, and `.countdown-bezel-orbit-track`.
- Configured accessibility fallback for `prefers-reduced-motion`.

### `src/components/RaceCardCountdownClock.tsx`
- Added `rotationDurationSec` calculation dynamically scaling rotation velocity as time ticks down to zero.
- Replaced static SVG container with a rotating `<g>` group wrapped in `rotationClass`, inline dynamic duration, and `transformOrigin: "28px 28px"`.
- Added the rotating outer chronometer bezel ring.
- Added mini rotating progress ring badge to the **Next Race Jump Alert** banner.

### `src/components/RaceCardAndFormSheet.tsx`
- Added **Progressive Race Stepper** toggle (`⚡️ Progressive Stepper` vs `📑 Full Sheet`) with sequential steps (Step 1: Speed Map, Step 2: Key Form & Movers, Step 3: Official TAB Exotics & Consensus Selections).
- Integrated career closing speed percentiles and live market mover fluctuations.

---

## 3. Verification & Validation

- **TypeScript Compilation**: `npm run lint` (`tsc --noEmit`) succeeded with 0 errors.
- **Production Bundle**: `compile_applet` passed successfully.
- **Theme Compatibility**: Tested and verified across Default Turf Dark, Apple Minimalist, and Midnight Obsidian.
