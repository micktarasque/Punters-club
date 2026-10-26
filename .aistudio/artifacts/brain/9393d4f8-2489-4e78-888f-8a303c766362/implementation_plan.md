# Implementation Plan: Direct Cup Mode Selections & Sequential Melbourne-to-Sydney Card Flow

## Overview
When entering or activating Cup Mode, users will be taken directly to the **Cup Selections screen** (`CupSelectionsSheet`) rather than the tournament board or general racecard. The selection workflow starts on the **Melbourne** feature meeting. Once users complete their 8-horse rankings through the Melbourne card, they are prompted with a dedicated **"Next: Proceed to Sydney Card"** callout that smoothly transitions them straight into the Sydney card to complete selections before running the sequential draft.

---

## 1. Direct Entry to Cup Selections
- **Auto-Routing upon Cup Activation**:
  - Whenever Cup Mode is enabled from the header toggle or the "Cup Mode" navigation tab is selected, set `activeTab = "cup"` and ensure `cupSubView = "selections"`.
  - Automatically identify the Melbourne metro meeting (e.g. Flemington, Caulfield, Moonee Valley) on the active race date and set it as `selectedMeetingId` so the user lands straight on the Melbourne card.
  - If a Melbourne meeting is not present on the date, fall back to the primary metro meeting followed by Sydney.

---

## 2. Melbourne to Sydney Card Transition in `CupSelectionsSheet`
- **Meeting Header Navigation in Cup Selections**:
  - Add meeting tabs at the top of `CupSelectionsSheet` displaying the progression sequence:
    1. **Melbourne Card** (e.g., Flemington) — *Primary*
    2. **Sydney Card** (e.g., Randwick) — *Next*
  - Display badge indicators on each meeting pill showing card completion status (e.g., `8/8 Races Complete`).
- **Sequential Card Completion Prompt**:
  - When the user completes the final race of the Melbourne card (or when all Melbourne races are ranked for the active punter), display a prominent, animated call-to-action bar:
    - **"Next: Proceed to Sydney Card (Randwick / Rosehill) →"**
    - Clicking this button switches the active meeting to Sydney, scrolls to Race 1 of the Sydney card, plays a chime, and triggers haptic feedback.
- **Return to Melbourne Option**:
  - Punters can easily toggle back to review or adjust Melbourne picks at any time.

---

## 3. Sequential Priority Draft Execution
- **Card-by-Card Draft Resolution**:
  - The draft resolves Melbourne races first, followed by Sydney races.
  - Update `CupTournamentState` and draft helpers to store meeting-isolated draft selections and preference rankings (`userPreferencesByMeeting?: Record<string, Record<number, Record<string, number[]>>>`).
  - The draft console in `CupSelectionsSheet` and `CupModeTournamentView` clearly announces which card is currently being drafted, advancing to Sydney once Melbourne draft steps finish.

---

## 4. Verification & Testing
- Test Cup Mode toggle to ensure immediate routing to `CupSelectionsSheet` on Melbourne card.
- Verify 8-horse rankings on Melbourne card until completion, checking that the **"Next: Proceed to Sydney Card →"** prompt appears.
- Click prompt and verify transition to Sydney card Race 1.
- Run `npm run lint` and `npm run build` (`compile_applet`) to ensure clean compilation.
