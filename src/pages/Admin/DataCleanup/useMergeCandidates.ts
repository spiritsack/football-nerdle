import { useState, useEffect, useCallback } from "react";
import {
  findDuplicatePlayerCandidates,
  findDuplicateClubCandidates,
  dismissDuplicate,
  mergePlayers,
  mergeClubs,
  findFragmentedStints,
  mergeStints as mergeStintsApi,
  findOrphanPlayers,
  findOrphanClubs,
  deleteOrphanPlayer,
  deleteOrphanClub,
} from "../../../api/dataCleanupApi";
import type { PlayerCandidate, ClubCandidate } from "./helpers";
import type { StintFragment, OrphanPlayer, OrphanClub } from "./types";

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

export function useFragmentedStints() {
  const [fragments, setFragments] = useState<StintFragment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await findFragmentedStints();
    setFragments(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const mergeStints = async (playerId: string, clubId: string) => {
    setError(null);
    const result = await mergeStintsApi(playerId, clubId);
    if (!result) {
      setError("Stint merge failed — check console for details");
      return null;
    }
    setFragments((prev) => prev.filter(
      (f) => !(f.player_id === playerId && f.club_id === clubId),
    ));
    return result;
  };

  return { fragments, loading, error, refresh, mergeStints };
}

export function useOrphanPlayers() {
  const [orphans, setOrphans] = useState<OrphanPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await findOrphanPlayers();
    setOrphans(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (id: string) => {
    setError(null);
    const ok = await deleteOrphanPlayer(id);
    if (!ok) {
      setError("Delete failed — check console for details");
      return false;
    }
    setOrphans((prev) => prev.filter((p) => p.id !== id));
    return true;
  };

  return { orphans, loading, error, refresh, remove };
}

export function useOrphanClubs() {
  const [orphans, setOrphans] = useState<OrphanClub[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await findOrphanClubs();
    setOrphans(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (id: string) => {
    setError(null);
    const ok = await deleteOrphanClub(id);
    if (!ok) {
      setError("Delete failed — check console for details");
      return false;
    }
    setOrphans((prev) => prev.filter((c) => c.id !== id));
    return true;
  };

  return { orphans, loading, error, refresh, remove };
}
