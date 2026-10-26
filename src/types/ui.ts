/** Shared UI shell types. Kept outside App.tsx so components can import them without a cycle. */
export type ActiveTab = "overview" | "selections" | "exotics" | "results" | "cup";

export type AppThemeScheme = "default" | "apple" | "obsidian" | "dark" | "light" | "race";

export type CloudSyncState = "synced" | "saving" | "local";

export interface ProgressCount {
  done: number;
  total: number;
}
