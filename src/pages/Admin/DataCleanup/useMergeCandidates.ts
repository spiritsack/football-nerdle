import { useState, useEffect, useCallback } from "react";
import {
  findDuplicatePlayerCandidates,
  findDuplicateClubCandidates,
  dismissDuplicate,
  mergePlayers,
  mergeClubs,
} from "../../../api/dataCleanupApi";
import type { PlayerCandidate, ClubCandidate } from "./helpers";

export function usePlayerCandidates(minScore = 0.55) {
  const [candidates, setCandidates] = useState<PlayerCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await findDuplicatePlayerCandidates(minScore);
    setCandidates(data);
    setLoading(false);
  }, [minScore]);

  useEffect(() => { refresh(); }, [refresh]);

  const dismiss = async (idA: string, idB: string, reason = "") => {
    const ok = await dismissDuplicate("player", idA, idB, reason);
    if (ok) setCandidates((prev) => prev.filter((c) => !(c.id_a === idA && c.id_b === idB)));
    return ok;
  };

  const merge = async (winnerId: string, loserId: string) => {
    setError(null);
    const result = await mergePlayers(winnerId, loserId);
    if (!result) {
      setError("Merge failed — check console for details");
      return null;
    }
    setCandidates((prev) => prev.filter(
      (c) => c.id_a !== loserId && c.id_b !== loserId,
    ));
    return result;
  };

  return { candidates, loading, error, refresh, dismiss, merge };
}

export function useClubCandidates(minScore = 0.55) {
  const [candidates, setCandidates] = useState<ClubCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await findDuplicateClubCandidates(minScore);
    setCandidates(data);
    setLoading(false);
  }, [minScore]);

  useEffect(() => { refresh(); }, [refresh]);

  const dismiss = async (idA: string, idB: string, reason = "") => {
    const ok = await dismissDuplicate("club", idA, idB, reason);
    if (ok) setCandidates((prev) => prev.filter((c) => !(c.id_a === idA && c.id_b === idB)));
    return ok;
  };

  const merge = async (winnerId: string, loserId: string) => {
    setError(null);
    const result = await mergeClubs(winnerId, loserId);
    if (!result) {
      setError("Merge failed — check console for details");
      return null;
    }
    setCandidates((prev) => prev.filter(
      (c) => c.id_a !== loserId && c.id_b !== loserId,
    ));
    return result;
  };

  return { candidates, loading, error, refresh, dismiss, merge };
}
