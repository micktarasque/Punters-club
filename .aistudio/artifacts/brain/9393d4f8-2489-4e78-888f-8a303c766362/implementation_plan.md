# Executive UX & GUI Polish: Unified Top Bar, Streamlined Tab Flow & Apple-Grade Refinement

## Summary
Transform TurfSheet's user experience into an executive-grade, polished racing & syndicate workspace. This overhaul replaces fragmented secondary header bars and redundant tab blocks with a **unified executive top bar**, establishes a structured 4-stage hierarchy (**Overview → Selections → Exotics → Results**), and implements **Apple-grade typography, subtle 1px hairline borders, and micro-elevation**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed User Preferences from Interactive Discovery:**
> 1. **Unified Executive Top Bar**: A single consolidated navigation header combining the TurfSheet identity, syndicate member switcher, streamlined 4-tab selector, and quick utilities (Date, Theme, Cloud Sync, Refresh) with zero visual clutter.
> 2. **Ordered 4-Stage Hierarchy**:
>    - **Stage 1: Overview** (VIC & NSW Feature Race Days, Favourites, Market Analytics / Detailed Form Guide Toggle)
>    - **Stage 2: Selections** (Syndicate Betting Ledger, Single-Race Focused View with Swipe & Ribbon)
>    - **Stage 3: Exotics** (Combined Trifecta & Quaddie Studio, Harville Probability Models, Boxed Combos)
>    - **Stage 4: Results** (Official Outcomes, Punter Leaderboard, Dividend Tracker, ROI Analysis)
> 3. **Apple-Grade Visual Refinement**: Hairline borders (`border-[#E5E5EA]`), subtle micro-elevation (`shadow-xs` & `shadow-sm`), unboxed text metadata with `·` separators (Zero-Pill discipline), and refined typographic balance.

---

## 1. Overview & Core Concept

- **What It Delivers**: A cohesive, clutter-free racing syndicate dashboard where punters can seamlessly navigate from high-level race day overviews to focused runner selections, syndicate exotics tracking, and final scoring results.
- **Target Audience**: Syndicate punters, racing enthusiasts, and analytical bettors who require rapid race-to-race navigation, clear data hierarchy, and distraction-free decision making.
- **Key Value**: Eliminates duplicate tab switchers and awkward vertical scrolling. Replaces overwhelming data density with structured, intentional workspaces that feel fast, tactile, and professional on both desktop and iPad/mobile viewports.

---

## 2. User Experience & Visual Design

### A. Layout Structure & Navigation Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│  🏇 TurfSheet Punters Club  │ [Overview] [Selections] [Exotics] [Results] │ 👤 Steve F │ 📅 Today │ ⚙️ │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                               ▼                               ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 1. Overview      │    │ 2. Selections    │    │ 3. Exotics & 4.  │
│ Feature Cards    │    │ Focused Race     │    │ Results          │
│ Analytics / Form │    │ Swipe & Ribbon   │    │ Leaderboard &    │
│ Toggle View      │    │ Tactile Pickers  │    │ Dividends        │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

1. **Unified Executive Top Bar (`<header>` in `src/App.tsx`)**:
   - **Left**: Refined wordmark with racing icon and subtle Sydney/Melbourne status indicator.
   - **Center**: Streamlined 4-tab segmented pill (`Overview`, `Selections`, `Exotics`, `Results`) with active state micro-elevation and keyboard accessibility.
   - **Right**: Punter profile switcher (Steve F / Mark S), Date calendar trigger, Points/$ toggle, and quick refresh button.
   - **De-cluttering**: Removes redundant secondary hero card duplicate tab grids (`#tab-workspace-anchor`) that competed with the top navigation.

2. **Section Hierarchy & Page Progression**:
   - **Tab 1: Overview**:
     - Sydney & Melbourne feature race cards.
     - Toggle between **Market Analytics** (Odds Distribution & Radar) and **Detailed Form Guide** (Speed Maps & Field).
     - Quick "Jump to Selections (NR)" action on each card.
   - **Tab 2: Selections**:
     - Focused single-race experience with horizontal swipe gestures and keyboard arrow support.
     - Persistent Sticky Race Jump Ribbon (R1–R12) with completion dots (🟢 3/3, 🟡 partial, 🃏 joker).
     - Tactile runner preference cards with micro-elevation and crisp click/vibration feedback.
   - **Tab 3: Exotics**:
     - Combined Trifecta Studio & Quaddie Tracker.
     - Harville-Plackett-Luce market likelihood distributions and cost optimization.
   - **Tab 4: Results**:
     - Official race results, podium finishes, syndicate leaderboard, and ROI scoring.

### B. Visual Identity, Typography & Micro-Elevation

- **Zero-Pill Discipline**:
  - Eliminates static candy capsules around dates, tracks, and distance tags.
  - Formats metadata as quiet, legible inline text with typographic bullet separators:  
    `Randwick · Race 7 · 1600m · Group 1 · Good 4`
- **Subtle Hairline Borders & Spatial Math**:
  - Card borders unified to subtle hairlines (`border-[#E5E5EA]` in light theme, `border-[#1F2D26]` in turf theme).
  - Nested radius math enforced: outer cards `rounded-2xl` (16px), inner tiles `rounded-xl` (12px), segmented controls `rounded-lg` (8px).
- **Micro-Elevation & Tactile States**:
  - Replaces heavy drop shadows with subtle ambient elevation (`shadow-[0_1px_2px_rgba(0,0,0,0.04)]` resting, `shadow-[0_4px_12px_rgba(0,0,0,0.06)]` on hover/active).
  - Interactive buttons feature snappy tactile scale `active:scale-[0.98]` and synchronized audio click / haptic vibration.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Single Source of Truth for Tab Navigation
- **Chosen Approach**: Elevate the header tab bar as the sole primary navigation mechanism and retire the redundant 4-card workspace grid that sat below the hero section.
- **Why**: Having both a sticky header tab bar and a 4-card grid below caused cognitive split-focus and pushed actual race data 300px lower down the screen.
- **Alternatives Considered**: Keeping both was cluttering screen real estate on mobile and tablet screens.

### Decision 2: Contextual Sub-Headers per Workspace
- **Chosen Approach**: Each tab view (`Overview`, `Selections`, `Exotics`, `Results`) starts with a clean, dedicated workspace header displaying meeting details, quick filter chips, and primary actions.
- **Why**: Keeps punters grounded in their current task without needing an oversized global hero banner on every screen.

### Decision 3: Preserving Turf Dark & Apple Clean Theme Postures
- **Chosen Approach**: Retain the theme toggle while standardizing both themes onto the same executive structural layout, elevation tokens, and typographic scale.
- **Why**: Punters club members who prefer the traditional trackside turf dark theme get high contrast, while members preferring Apple minimalist get crisp light neutrals.

---

## 4. Technical Architecture & Component Structure

```
src/
├── App.tsx                        # Unified Executive Top Bar, Route/Tab Dispatcher, Global State
├── components/
│   ├── MajorRaceDaysOverview.tsx  # Tab 1: Feature Cards, Analytics vs Form Toggle
│   ├── BettingLedgerSheet.tsx     # Tab 2: Focused Race Stepper, Swipe Gestures, Tactile Runners
│   ├── ExoticsBentoStudio.tsx     # Tab 3: Combined Trifecta & Quaddie Tracker, Harville Models
│   ├── AllUsersSelectionsResults  # Tab 4: Leaderboard, Dividends, ROI Analytics
│   ├── DateRangeCalendarBar.tsx   # Date Range Picker & Scraper Control
│   └── RaceMarketRadarBarChart.tsx# Technical Odds Distribution & Fluctuation Radar
└── utils/
    ├── audioAlerts.ts             # Web Audio API crisp mechanical clicks & haptic vibrations
    └── autoPick.ts                # Syndicate auto-pick recommendation engine
```

### State & Handler Mapping
- `activeTab: "overview" | "selections" | "exotics" | "results"` controls the main viewport.
- `selectedMeetingId` & `selectedRaceNumber` synchronize seamlessly across all 4 tabs.
- `overviewViewMode: "analytics" | "form"` controls the technical depth in Tab 1 without cluttering the screen.
- `audioAlerts.playTapClick()` and `triggerHapticFeedback()` provide physical confirmation across all view and preference changes.

---

## Verification Plan

### Automated Verification
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` to confirm Vite production bundle builds successfully without asset or syntax regressions.

### Manual UX & Visual Verification
1. **Top Bar Clarity**: Confirm brand wordmark, tab switcher, punter indicator, and date controls remain cleanly aligned on mobile, iPad Pro, and desktop screens.
2. **Tab Progression**: Switch through **Overview → Selections → Exotics → Results**, verifying smooth transitions and no layout jumping.
3. **Typography & Zero-Pill Rules**: Verify metadata labels render as clean unboxed text with `·` separators and no awkward pill sandwiching.
4. **Interactive Polish**: Check runner selection clicks, view toggles, and swipe gestures for crisp tactile elevation and audio/haptic responses.
