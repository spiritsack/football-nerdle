import type { Player } from "../../types";

export interface PlayerChainProps {
  chain: Pick<Player, "id" | "name" | "nationality">[];
  /** Compact chips without nationality (game-over summary). */
  compact?: boolean;
}
