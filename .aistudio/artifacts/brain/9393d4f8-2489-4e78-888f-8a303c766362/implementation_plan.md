# Syndicate Selections & Workflow Navigation Optimization Plan

Enhances the race tipping workflow with member initials badges on runner rows, an interactive sticky race jump dock with global keyboard shortcuts, and intelligent auto-advancement upon completing race preferences.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed through Phase 1 clarification questions and will govern the implementation:

- **Confirmed Decision 1 (Other Members' Selections)**: Display compact, color-coded initials badges (e.g. `[SF 1]`, `[MS 2]`) directly on runner rows in both table and stepper views so members can instantly spot overlaps, consensus picks, and contrarian positions without switching views.
- **Confirmed Decision 2 (Navigation Shortcuts)**: Implement a sticky floating race jump dock with dedicated race jump capsules (R1–R12), completion status indicators, and keyboard shortcuts (`[` / `]` or `←` / `→` for races, `1` / `2` / `3` for preference assignment, `J` for Joker race nomination).
- **Confirmed Decision 3 (Input Workflow)**: Seamlessly auto-advance the active race cursor to the next race (`R(n) -> R(n+1)`) once all 3 preferences (1st, 2nd, and 3rd) are selected, accompanied by a subtle progress chime and an instant "Undo / Stay" toast affordance.
- **User Control Toggle**: Provide an accessible "Auto-Advance" toggle switch directly on the floating dock and preferences bar, allowing punters to disable auto-advancement if they prefer manual inspection.

---

## 1. Overview & Core Concept

### What It Does
This upgrade transforms the Saturday racing tipping experience from a manual, click-heavy process into a high-speed, frictionless workflow. Punters can rapidly navigate across an entire 10-race card using mouse clicks or keyboard hotkeys, see what their syndicate companions (e.g., Sean, Mark, Dave) have tipped right on each runner's row, and fly through card entries with intelligent auto-advancement.

### Target Audience & Persona
- **Syndicate Punters**: Avid racing syndicate members placing selections across 2–4 metropolitan cards simultaneously prior to jump.
- **Power Users**: Users who prefer keyboard navigation (`[`/`]` to cycle races, `1`/`2`/`3` to assign rankings, `J` to tag Joker race).
- **Casual Members**: Users who rely on visual feedback to verify card completion (e.g. "8/10 races tipped") before the first race locks.

### Key Value
- **$3\times$ Faster Selections**: Eliminates redundant scrolling and back-and-forth race switching.
- **Social Awareness**: Instantly shows consensus without crowding the screen or relying on separate tabs.
- **Zero Omissions**: Visual indicators highlight unselected or partially completed races before jump time.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Card Entry & Auto-Advance Flow**:
   - Punter opens the **Selections** tab on a Sydney or Melbourne card (e.g., Randwick).
   - The punter clicks or keys `1st`, `2nd`, and `3rd` on their preferred runners.
   - When the third preference is clicked, the race completes: a micro-badge pulses green, a subtle checkmark appears on the floating race dock, and the interface smoothly slides forward to the next unfinished race.
   - A quiet toast appears at the top: *"Race 3 Complete · Advancing to Race 4"* with a `[Stay on R3]` action button.

2. **Syndicate Member Initials Badges on Runner Rows**:
   - Each runner row displays an unobtrusive "Syndicate Picks" cluster adjacent to the runner's barrier and name.
   - Example: On runner *#3 Think About It*, small rounded initials badges display:
     - `SF: 1st` (Amber tint for Sean's top pick)
     - `MS: 2nd` (Blue tint for Mark's second pick)
   - Hovering or tapping a badge opens a micro-popover displaying full member details and time of selection.
   - If no other punter has selected the horse, the cluster remains quiet/empty, preserving clean whitespace.

3. **Sticky Floating Race Jump Dock & Keyboard Shortcuts**:
   - Anchored at the bottom center of the viewport, styled with Apple Clean / Turf Dark frosted glass (`backdrop-blur-md`).
   - Contains:
     - Race pills `R1` through `R10` with real-time indicators:
       - Filled green check: All 3 picks submitted.
       - Amber dot: 1 or 2 picks submitted (incomplete).
       - Empty ring: 0 picks submitted.
       - Gold star icon: User's nominated Joker double-points race.
     - Fast race controls: `< Prev ( [ )` and `Next ( ] ) >`.
     - Hotkey helper toggle showing keyboard guide overlay (`?`).
     - "Auto-Advance" on/off switch.

### Visual Identity & Theme
- **Theme Support**: Flawless fidelity across both **Apple Clean** (crisp slate-50/100, hairline borders, SF Pro typographic weight) and **Turf Dark** (deep emerald slate `#0D1912`, glowing lime accents, high-contrast odds).
- **Anti-Slop Discipline**: Zero generic purple gradients or pill sandwiches. Initials badges use subtle border-radius tokens with high-contrast text (`text-[10px] font-mono font-bold`) and tabular numerals (`font-mono tabular-nums`).
- **Touch & Click Geometry**: Floating dock buttons maintain $\ge 40$px hitboxes on desktop and $\ge 44$px on mobile viewports.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Member Selection Display** | Inline initials badges (`SF 1st`, `MS 2nd`) on runner rows | Immediate scannability without breaking runner comparison flow | Floating hover tooltip (too hidden) or dedicated separate column (wastes horizontal space on mobile) |
| **Race Dock Placement** | Floating sticky bottom center dock (`z-40`) | Thumb-reachable on mobile, omnipresent on desktop without pushing content down | Top header tabs (requires scrolling back up on long 16-runner fields) |
| **Auto-Advance Timing** | Triggers immediately when all 3 picks are distinct and set, with a 350ms settle delay and 3s undo toast | Eliminates jarring instant flips while giving fast typers continuous flow | Confirmation dialog modal (breaks speed and cadence) |
| **Keyboard Scope** | Global listeners disabled when typing in inputs/search bars, enabled anywhere on Selections tab | Prevents accidental race jumps when searching horses or typing notes | Requiring focus on a specific container first (cumbersome) |

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                                App.tsx                                 │
│  - Global State: meetings, activeMeeting, punters, activePunterId      │
│  - Keyboard Shortcut Coordinator (Global listener: [, ], 1-3, J, A)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BettingLedgerSheet.tsx                          │
│  - Active race cursor & auto-advance engine                            │
│  - Multi-Punter selection lookup map: [meetingId][raceNo][runnerTab]   │
│                                                                        │
│  ┌───────────────────────────────┐  ┌────────────────────────────────┐ │
│  │     Runner Row Component      │  │     Race Preference Trio       │ │
│  │  - Runner details & flucs     │  │  - 1st, 2nd, 3rd action chips  │ │
│  │  - MemberInitialsBadgesGroup  │  │  - On completion: trigger      │ │
│  │    (SF:1, MS:2, TC:3 tokens)  │  │    autoAdvanceToNextRace()     │ │
│  └───────────────────────────────┘  └────────────────────────────────┘ │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        StickySyndicateDock.tsx                         │
│  - Race buttons (R1–R10) with status rings (Complete, Partial, Empty)  │
│  - Joker indicator & quick toggle ([J])                                │
│  - Auto-advance toggle switch & status toast coordinator              │
│  - Keyboard shortcuts cheat-sheet drawer                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & State Mapping

1. **`BettingLedgerSheet.tsx`**:
   - Compute `syndicateSelectionsByRunner` for the current race: key each `runner.tabNumber` to an array of `{ punterName, punterInitials, preferenceRank, color }`.
   - In both Table view and Stepper view, render the `MemberInitialsBadgesGroup` alongside runner silks and horse names.
   - Implement `handlePreferenceSelectionWithAutoAdvance`:
     - Set preference in active punter's record.
     - Evaluate if the race now has complete 1st, 2nd, and 3rd picks.
     - If complete and `autoAdvanceEnabled` is true, trigger smooth step to `raceNumber + 1` (stopping at the card's final race) and display the Undo toast.

2. **`StickySyndicateDock.tsx`**:
   - Render R1..Rn capsules with completion glyphs.
   - Display key badges: `[←/→]` or `[ [ / ] ]` for Race Jump, `[J]` for Joker.
   - Include auto-advance toggle state switch: `Auto-advance: On / Off`.
   - Provide an expandable keyboard shortcut cheatsheet.

3. **Keyboard Shortcuts Engine**:
   - `[` / `ArrowLeft`: Navigate to previous race.
   - `]` / `ArrowRight`: Navigate to next race.
   - `j` / `J`: Toggle Joker status for current race.
   - `a` / `A`: Trigger auto-pick strategy for current race.
   - `Escape`: Clear current race selection.
   - `?`: Toggle shortcut guide.

---

## 5. Verification & Test Plan

1. **Initials Badges**:
   - Verify multiple punters (e.g. Sean, Mark, Dave) selecting the same horse shows stacked or inline badges (`SF 1`, `MS 2`).
   - Verify active punter's own selection is clearly highlighted as the primary interactive button, while companions are rendered as quiet informational badges.
2. **Auto-Advance**:
   - Fill 1st and 2nd preference: verify race remains on current card.
   - Fill 3rd preference: verify smooth transition to next race and presence of Undo toast.
   - Toggle Auto-advance OFF: verify 3rd pick sets without changing race.
   - Last race on card (e.g. R10): verify auto-advance cleanly recognizes end-of-card without overflow.
3. **Keyboard Shortcuts**:
   - Press `[` and `]` across R1–R10: verify active race updates immediately and synchronizes dock and main view.
   - Press `J`: verify Joker tag activates/deactivates on current race with audio feedback.
   - Verify typing in search/filter inputs suppresses keyboard shortcut triggering.
4. **Build & Accessibility**:
   - Run `lint_applet` and `compile_applet` to ensure zero compilation or TypeScript errors.
   - Test responsive layout at 375px (mobile) and 1440px (desktop) ensuring no layout clipping or sticky dock height exceeding 15% viewport.
