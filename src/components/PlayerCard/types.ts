import type { Player, PlayerWithTeams, FormerTeam } from "../../types";
import type { RevealedHints } from "../../pages/GuessThePlayer/types";

export interface MergedClub {
  teamId: string;
  teamName: string;
  yearJoined: string;
  yearDeparted: string;
  badge: string;
  isLoan?: boolean;
  stints: FormerTeam[];
}

export interface PlayerCardProps {
  player: PlayerWithTeams;
  clubs: MergedClub[];
  hints: RevealedHints;
  revealed: boolean;
  hardMode: boolean;
  result?: "won" | "lost";
  onGuess?: (player: Player) => void;
  onSkip?: () => void;
  attempts?: number;
  maxAttempts?: number;
}
