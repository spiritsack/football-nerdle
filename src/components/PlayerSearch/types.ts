import type { Player } from "../../types";

export interface PlayerSearchProps {
  onSelect: (player: Player) => void;
  disabled?: boolean;
  usedPlayerIds?: Set<string>;
  disabledPlayerIds?: Map<string, string>;  // id → reason label (shown but not selectable)
  placeholder?: string;
}
