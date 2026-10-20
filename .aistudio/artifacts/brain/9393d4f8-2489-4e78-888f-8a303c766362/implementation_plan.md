# Implementation Plan: Site Review, UI Polish, Ergonomics & Functional Optimizations

Comprehensive optimization roadmap addressing visual design consistency, mobile ergonomics with a floating bottom action dock, native Web Audio chimes for race results, high-density tabular form displays, and syndicate data resilience.

---

## 1. User Alignment & Architectural Decisions

* **Scope**: All areas selected — UI polish, performance optimizations, ergonomics, and functional upgrades.
* **Ergonomics & Navigation**: Floating bottom quick-action bar with jump-to-race ribbon on mobile and tablet viewports, providing seamless thumb reachability across race cards.
* **Real-Time Race Alerts**: Native HTML5 Web Audio synthesizer (zero audio asset downloads, reliable in all browsers) generating pleasant victory chimes for winners, trifecta fanfare, visual badge pulse animations, and interactive toast notifications.
* **Visual Polish & Anti-Slop Compliance**:
  * Clean Apple Minimalist vs Turf Dark aesthetic switching with a top navigation quick-toggle.
  * Tabular figure formatting (`tabular-nums` / `font-mono`) across all financial, par, and dividend numbers.
  * Removal of clutter, alignment of data grids, and high-density runner inspection.

---

## 2. Proposed Changes & File Modifications

### A. Real-Time Audio Synthesis & Alert Dispatcher
#### `src/utils/audioAlerts.ts` (New File)
* Implement native Web Audio API synthesizer (`AudioContext` / `webkitAudioContext`).
* Sound profiles:
  * **Race Winner Chime**: Smooth two-tone ascending chime (587Hz D5 to 880Hz A5) using sine and triangle oscillators with gentle gain decay.
  * **Trifecta Hit Fanfare**: Harmonious chord arpeggio (C-E-G-C) celebrating exotic payouts.
  * **Subtle Click / Refresh Pulse**: Crisp low-latency tap feedback.
* Sound preference persistence in `localStorage` (`turfsheet_audio_muted_v1`) with quick mute/unmute control.

### B. Mobile & Tablet Ergonomics: Floating Bottom Action Dock
#### `src/components/FloatingBottomActionDock.tsx` (New File)
* Sleek bottom dock tailored for handheld devices (hidden on wide desktop if persistent header is visible):
  * **Active Meeting & Jump Selector**: Popover/drawer to quickly swap between Sydney, Melbourne, and regional cards.
  * **Race Ribbon Wheel**: Horizontal swipeable scroll of R1–R12 badges indicating status (Upcoming, Live, Official Winner Hit).
  * **Quick Navigation Buttons**: Jump to Overview/Form, Betting Selections, Exotics Studio, or Official Results with active pill highlights.
  * **Sound Alert & Theme Toggle**: Quick access to sound mute and theme switch without scrolling to the top.

### C. Top Bar Header & Theme Switcher Refinement
#### `src/App.tsx`
* Add an accessible, instant theme toggle button (Turf Dark ↔ Apple Minimalist) directly in the header next to the syndicate title and cloud ledger badge.
* Integrate `audioAlerts` into `triggerRaceResultPushNotification` and `handleScrapeNswTab` so newly completed races immediately trigger audio chime and badge pulse.
* Mount `FloatingBottomActionDock` at the viewport bottom on mobile and tablet.

### D. Table & Visual Density Enhancements
#### `src/components/RaceCardAndFormSheet.tsx` & `src/components/TanStackVirtualRunnersTable.tsx`
* Ensure high-density runner rows ($36\text{px}$–$44\text{px}$ row height), crisp tabular numbers, and instant preference assignment.
* Add animated pulse highlight when a runner's odds change or when an official result is posted.

#### `src/components/AllUsersSelectionsResults.tsx` & `src/components/RaceReportSheet.tsx`
* Clean up table cell alignments (text left-aligned, odds/dividends/points right-aligned with tabular figures).
* Polish card borders, badge pulses on 1st/2nd/3rd winners, and responsive scroll clearance.

### E. Styling & Theme Polish
#### `src/index.css`
* Add CSS keyframe animations for `@keyframes pulse-badge` and `@keyframes glow-winner`.
* Ensure floating dock has safe-area inset padding for iOS (`env(safe-area-inset-bottom)`).
* Refine dark mode contrast for outdoor sunlight readability on race days.

---

## 3. Verification & Validation Plan

* **Visual & Theme Verification**:
  * Toggle between Turf Dark and Apple Minimalist to verify cards, tables, D3 and Recharts SVG elements adapt seamlessly without color clashes.
  * Verify mobile viewport (375px–768px) displays the floating bottom dock with thumb-friendly touch targets ($\ge 44\text{px}$).
* **Functional & Audio Verification**:
  * Trigger a simulated or real race completion notification to verify audio chime plays (and respects mute toggle).
  * Check that race jump buttons in the floating dock scroll smoothly to the target race section.
* **Build & Integrity**:
  * Run `compile_applet` and `lint_applet` to ensure 0 build errors and 0 TypeScript issues.
