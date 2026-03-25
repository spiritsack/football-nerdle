import type { Player } from "../../types";

export interface PlayerSearchProps {
  onSelect: (player: Player) => void;
  disabled?: boolean;
  usedPlayerIds?: Set<string>;
}
