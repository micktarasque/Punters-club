# Implementation Plan: Selections Tab Focused Race Navigation & Tactile UX Upgrade

Upgrade the **Selections Tab** (`BettingLedgerSheet.tsx` & syndicate betting workflows) from an onerous vertically stacked layout to an ergonomic, high-performance **Focused Single-Race Experience** with horizontal swipe gestures, sticky quick-jump ribbon, tactile card elevation animations, and subtle crisp audio & device haptic feedback.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions Based on User Preferences:**
> 1. **Focused Single-Race View with Swipe Gestures**: By default, the Selections tab highlights and focuses on one active race at a time with large previous/next triggers and mobile touch-swipe (`touchmove`/`touchend` gesture handler), while providing a view toggle to switch to all-races view if desired.
> 2. **Sticky Race Jump Ribbon**: A persistent, compact ribbon at the top of the Selections card displaying all races (R1–R12), with completion checkmarks (indicating whether 1st, 2nd, and 3rd have been picked) and status indicators.
> 3. **Subtle Crisp Audio & Haptics**: A low-latency synthesized mechanical click sound (via Web Audio API `audioAlerts.ts`) paired with native `navigator.vibrate([15])` haptic pulses when picking runners or toggling the Joker race.
> 4. **Tactile Card Elevation & Border Pulse**: Smooth elevation (`transform: translateY(-2px)`, `shadow-md`), ring pulse, and distinct gold/emerald borders on selected runner cards.

---

## Proposed Changes

### 1. Sound & Haptic Engine (`src/utils/audioAlerts.ts`)
- Add `playSelectionClick(rank: 1 | 2 | 3 = 1)`:
  - Generates a short, crisp, dampened 15ms pop/click at calibrated resonant frequencies (1400Hz for 1st, 1200Hz for 2nd, 1000Hz for 3rd) using `AudioContext` with zero latency and respect for mute preferences.
- Add `triggerHapticFeedback(pattern: number | number[] = 15)`:
  - Invokes `navigator.vibrate?.(pattern)` with graceful fallback for browsers without haptic support.

### 2. Selections Tab Component Enhancements (`src/components/BettingLedgerSheet.tsx`)
- **Focused Race State & View Mode**:
  - Add `activeFocusedRaceNumber: number` state (synced with `selectedRaceNumber` and persistent meeting memory).
  - Add `viewLayoutMode: "focused" | "stacked"` toggle so users have flexibility.
- **Horizontal Swipe & Touch Gesture Engine**:
  - Implement touch handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) with a 50px delta threshold and horizontal velocity check to prevent accidental trigger during vertical scrolling.
  - Implement left/right arrow key navigation (`ArrowLeft` = Previous Race, `ArrowRight` = Next Race) for desktop and iPad keyboard users.
- **Sticky Race Jump Ribbon & Progress Bar**:
  - Horizontal scrollable ribbon featuring R1–R12 buttons.
  - Displays mini status dots: 🟢 3/3 picks completed, 🟡 Partial picks, 🃏 Joker active badge, 🏁 Race finished.
  - One-tap jumping with instant view focus.
- **Tactile Runner Selection Cards**:
  - Add active state styles with micro-elevation, subtle border ring pulse, and clear preference badges (`1st`, `2nd`, `3rd`).
  - Wire selection clicks to `playSelectionClick` and `triggerHapticFeedback`.
- **Race Completion Action Footer**:
  - Bottom action bar in focused mode: "Next Race (R{n+1}) →", "Previous (← R{n-1})", and "Auto Pick Current Race 🎲".

### 3. Styling & Animations (`src/index.css`)
- Add `@keyframes tactile-select-pulse` for smooth border glow on newly picked runners.
- Add CSS transition utility classes for swipe slide animation (`transition-transform duration-200 ease-out`).

---

## Verification Plan

### Automated Build & Lint
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `npm run build` (`vite build`) to confirm successful compilation and asset bundling.

### Manual UX & Functional Verification
1. **Swipe & Navigation**:
   - Test touch drag / swipe on mobile viewports (<768px) and desktop arrow keys to navigate between R1 and R12.
   - Verify jumping via the sticky race ribbon updates the displayed race instantly.
2. **Audio & Haptics**:
   - Tap 1st, 2nd, and 3rd preference buttons; confirm subtle crisp click sound plays and haptic vibration fires.
   - Verify audio respects the global sound/mute toggle in the header.
3. **Selection Persistence**:
   - Verify selections made in focused view persist correctly to punter profiles and save to cloud/local storage.
4. **Theme Adaptation**:
   - Verify appearance and contrast in both **Apple Clean** and **Turf Dark** themes.
