import type { GuessDistribution } from "../types";

export interface GuessDistributionProps {
  distribution: GuessDistribution;
  /** Attempts bucket to highlight (today's daily win), if any. */
  highlight?: number;
}
