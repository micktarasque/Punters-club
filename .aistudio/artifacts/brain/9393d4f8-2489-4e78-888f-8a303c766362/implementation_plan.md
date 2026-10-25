# Implementation Plan: Syndicate 'Cup Mode' Tournament & Discrete Draft System (Completed)

Deliver **Cup Mode** — a multi-user draft tournament system where syndicate members take turns selecting a single, mutually exclusive horse per race across active race cards. All selections are discrete (no horse can be picked twice in the same race), using the existing NSW TAB scoring system ($1 Each-Way Par & Points), and combining all users' discrete selections into a collective syndicate Flexi Box Trifecta, selectable via a header button matching the theme selector.

---

## 1. Specifications & Delivered Features

1. **Header Selector Button (matching Theme Selector style)**:
   - Dedicated **🏆 Cup Mode** dropdown button in the main header beside the Theme and Punter selectors.
   - Shows live state: `🏆 Cup Active` with an active pulsing indicator or `Standard`.
   - Dropdown control menu includes:
     - 1-click **Enable / Disable Cup Mode** toggle.
     - Live tournament stats (participants count, draft style, discrete lock status).
     - 1-click **Open Cup Tournament Board** navigation button.
     - **Reset Draft Selections** button with confirmation prompt.

2. **Turn-Based Discrete Draft Selection Mechanics**:
   - **Single Horse per User**: In each race on the card, each user drafts exactly 1 horse.
   - **Discrete & Mutually Exclusive Selections**: Once a horse is drafted by User A in Race X, that runner is locked (`🔒 Taken by [User A]`) and cannot be drafted by any other participant in that race. If the current drafter made the pick, they can clear it via the `✕` button.
   - **Snake Draft Turn Order**:
     - Odd races (R1, R3, R5...): Original sequence (P1 → P2 → P3).
     - Even races (R2, R4, R6...): Reversed sequence (P3 → P2 → P1).
     - Automatically highlights the active drafter: `🎯 NOW DRAFTING: Race X · [User]'s Turn`.

3. **Syndicate Flexi Box Trifecta System**:
   - In each race, all distinct horses drafted across participants are automatically combined into the syndicate's **Flexi Box Trifecta**.
   - Computes $N(N-1)(N-2)$ total combinations, stake outlay ($10 default with quick adjustments for $6, $10, $20, $24), and exact Flexi %.
   - When 1st, 2nd, and 3rd runners in the official results are all among the drafted horses, the syndicate hits the official TAB Trifecta dividend proportionally.

4. **Identical Scoring Architecture**:
   - Evaluates picks against official NSW TAB race results with dual scoring:
     - **Points Mode**: 1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt.
     - **$1 Each-Way Par Mode**: $1 Win + $1 Place on official NSW TAB dividends minus $2.00 stake per pick.
   - Standings table displays: Rank (Crown for 1st, Medals for 2nd/3rd), Punter Name, Picks Made, Wins, Places, Strike Rate %, Total Points, Total $ Return, and Net Profit.

---

## 2. Changes Completed

### `src/types/cupMode.ts`
- Defined `CupTournamentState`, `CupUserRaceOutcome`, `CupUserLeaderboardEntry`, and `CupSyndicateTrifectaOutcome`.

### `src/utils/cupMode.ts`
- Implemented `getInitialCupState` and `STORAGE_KEY_CUP_MODE` persistence.
- Implemented `getDraftOrderForRace` supporting Snake and Fixed turn order.
- Implemented `getActiveDraftPunter` to detect whose turn it is in the active race.
- Implemented `isHorseTakenInRace`, `assignCupPick`, and `removeCupPick` enforcing mutual exclusivity.
- Implemented `calculateCupLeaderboard` and `calculateCupTrifectaOutcomes`.

### `src/components/CupModeTournamentView.tsx`
- Built full tournament dashboard featuring:
  - Header with venue info, draft order indicator, and quick race selector.
  - Active Drafter Banner highlighting current turn.
  - **Leaderboard & Standings Tab**: Live points, $ returns, strike rate, and participant management (add/remove punters).
  - **Draft Matrix Tab**: High-density grid of all races showing drafted runners, barrier, odds, and podium tags.
  - **Syndicate Flexi Box Trifecta Tab**: Trackside exotics monitor showing combinations, flexi %, and total payouts.

### `src/components/RaceCardAndFormSheet.tsx`
- Added Cup Mode Live Draft Header Banner at the top of the race card.
- Updated Desktop Table rows with `🔒 Taken: [User]` or `🏆 Draft for [User]` buttons.
- Updated Mobile Cards with corresponding touch-friendly draft and lock controls.
- Added Cup Mode Syndicate Flexi Box Trifecta card to Step 3 of the inspection flow.

### `src/App.tsx`
- Added Cup Mode Selector Button in the header right next to the Theme Selector.
- Connected `cupState` with automatic `localStorage` synchronization.
- Added dedicated `🏆 Cup Mode` tab to the navigation bar.
- Integrated `CupModeTournamentView` workspace panel.

---

## 3. Verification & Validation

- **TypeScript Compilation**: `npm run lint` (`tsc --noEmit`) succeeded with 0 errors.
- **Production Build**: `compile_applet` passed successfully.
- **Theme Compatibility**: Tested and verified across Default Turf Dark, Apple Minimalist, and Midnight Obsidian.
