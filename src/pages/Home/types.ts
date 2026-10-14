export type GameModeKey = "guess" | "battle";

export interface HowToPlayContent {
  title: string;
  rules: string[];
}

export interface DailySummaryParts {
  won: boolean;
  /** "Solved in N/5" or "Missed today". */
  headline: string;
  /** Streak count to show after the headline, or null when hidden. */
  streak: number | null;
}

export interface HomeDailyState {
  /** Today's daily has an entry (drives "Daily (Done)"). */
  dailyDone: boolean;
  /** Summary line contents, or null when nothing should be shown. */
  summary: DailySummaryParts | null;
}
