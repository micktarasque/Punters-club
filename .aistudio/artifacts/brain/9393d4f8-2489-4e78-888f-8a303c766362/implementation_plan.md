# Implementation Plan: Collapsible Completed Races in Selections Screen

## Overview
In the **Selections** screen (`BettingLedgerSheet.tsx`), race cards currently stay fully expanded with all runners displayed, even after the user has made their picks. This plan introduces a manual collapse option once all 3 tips (1st, 2nd, and 3rd preferences) have been entered. When collapsed, the card transitions into a sleek, simplified view displaying the race number, race name, jump time, and the user's 3 selections with odds and quick edit controls.

---

## User Preferences Incorporated
- **Eligibility**: A race is eligible to collapse once **all 3 selections (1st, 2nd, and 3rd)** have been chosen.
- **Trigger**: **Manual toggle button** on each eligible race card (`"Collapse"` / `"Expand"`), plus convenient meeting-level `"Collapse All Completed"` and `"Expand All"` buttons.
- **Collapsed Content**:
  - Race number (e.g. `R1`)
  - Race name (e.g. `TAB Highway Handicap`)
  - Jump time & track condition (e.g. `12:45pm · 1200m`)
  - Selections: 1st (Gold), 2nd (Sky Blue), 3rd (Emerald) with horse numbers, names, and odds
  - Joker indicator (🃏 2×) if designated as Joker race
  - "Edit Selections / Expand" toggle button

---

## Proposed Changes

### `src/components/BettingLedgerSheet.tsx`

1. **State Management**:
   - Add state: `collapsedRaces: Record<string, boolean>` keyed by `${meetingCard.id}_R${race.raceNumber}`.
   - Add helper functions:
     - `toggleRaceCollapse(meetingId: string, raceNumber: number)`
     - `collapseAllCompletedRaces(meetingCard: RaceMeeting)`
     - `expandAllRaces(meetingCard: RaceMeeting)`

2. **Race Card Header**:
   - When a race has 3 picks entered (`pickCount === 3`):
     - Display a `"Collapse"` button with a chevron (`ChevronUp` / `ChevronDown`) in the quick controls header.
     - When clicked, folds the race into the simplified row view.

3. **Simplified Collapsed View**:
   - Render a dedicated, compact row when collapsed:
     - **Left**: Race badge (`R{raceNumber}`), race name, distance, and jump time / final badge.
     - **Center**: The 3 selections formatted as distinct preference pills:
       - **1st**: Gold border/pill with horse number, name, and win odds.
       - **2nd**: Sky blue border/pill with horse number, name, and win odds.
       - **3rd**: Emerald border/pill with horse number, name, and win odds.
     - **Right**:
       - Joker badge (`🃏 2× Active`) if active.
       - Result points or $ return if the race has resulted.
       - Quick action buttons: `"Edit / Expand"` (expands runners table) and `"Clear Picks"`.
   - Clicking on the collapsed card row smoothly expands it back to the full table for easy editing.

4. **Meeting Card Header Controls**:
   - In the race card header bar (beside view mode buttons), add a batch toggle:
     - `"Collapse Completed ({completedCount})"` when completed races are expanded.
     - `"Expand All"` when any completed races are collapsed.

---

## Verification Plan

1. **Build & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to confirm 0 TypeScript, JSX, or lint errors.

2. **Functional Testing**:
   - Navigate to **Selections** tab (`My Selections & Ledger`).
   - Select 3 runners for Race 1.
   - Verify the `"Collapse Card"` toggle button appears.
   - Click `"Collapse Card"` and verify the card folds into the simplified view showing race number, race name, jump time, and 1st/2nd/3rd selections.
   - Click `"Edit / Expand"` and verify the full runner table re-opens instantly.
   - Verify that incomplete races (0, 1, or 2 picks) remain expanded so the punter can continue selecting without interruption.
   - Verify batch `"Collapse Completed"` and `"Expand All"` buttons work smoothly across the meeting.
