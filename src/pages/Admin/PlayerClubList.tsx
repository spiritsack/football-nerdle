import { useState, useEffect, useCallback } from "react";
import {
  getPlayerClubsAdmin,
  getPlayerLegacyStatus,
  updatePlayerClubHidden,
  updatePlayerClubYouthTeam,
  updatePlayerClubLoan,
  updatePlayerLegacy,
  updateClubSortOrders,
  updateClubName,
} from "../../api/adminApi";
import type { AdminClubRow } from "./types";
import CrestDropZone from "./CrestDropZone";

interface Props {
  playerId: string;
}

export default function PlayerClubList({ playerId }: Props) {
  const [clubs, setClubs] = useState<AdminClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [legacyOverride, setLegacyOverride] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPlayerClubsAdmin(playerId),
      getPlayerLegacyStatus(playerId),
    ]).then(([data, legacy]) => {
      if (!cancelled) {
        setClubs(data);
        setLegacyOverride(legacy);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [playerId]);

  async function cycleLegacy() {
    // Cycle: null (auto) → true (force legacy) → false (force not legacy) → null
    const next = legacyOverride === null ? true : legacyOverride === true ? false : null;
    const ok = await updatePlayerLegacy(playerId, next);
    if (ok) setLegacyOverride(next);
  }

  async function toggleHidden(club: AdminClubRow) {
    const newHidden = !club.is_hidden;
    const ok = await updatePlayerClubHidden(club.id, newHidden);
    if (ok) {
      setClubs((prev) =>
        prev.map((c) => (c.id === club.id ? { ...c, is_hidden: newHidden } : c)),
      );
    }
  }

  async function toggleYouthTeam(club: AdminClubRow) {
    const newValue = !club.is_youth_team;
    const ok = await updatePlayerClubYouthTeam(club.id, newValue);
    if (ok) {
      setClubs((prev) =>
        prev.map((c) => (c.id === club.id ? { ...c, is_youth_team: newValue } : c)),
      );
    }
  }

  async function toggleLoan(club: AdminClubRow) {
    const newValue = !club.is_loan;
    const ok = await updatePlayerClubLoan(club.id, newValue);
    if (ok) {
      setClubs((prev) =>
        prev.map((c) => (c.id === club.id ? { ...c, is_loan: newValue } : c)),
      );
    }
  }

  function handleCrestUpdated(clubId: string, newBadgeUrl: string) {
    setClubs((prev) =>
      prev.map((c) => (c.club_id === clubId ? { ...c, badge: newBadgeUrl } : c)),
    );
  }

  const moveClub = useCallback(async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= clubs.length) return;

    const newClubs = [...clubs];
    [newClubs[index], newClubs[targetIndex]] = [newClubs[targetIndex], newClubs[index]];

    // Assign sort_order 0, 1, 2, ... to all clubs
    const updates = newClubs.map((c, i) => ({ id: c.id, sort_order: i }));
    const updatedClubs = newClubs.map((c, i) => ({ ...c, sort_order: i }));

    setClubs(updatedClubs);
    await updateClubSortOrders(updates);
  }, [clubs]);

  function startEditName(club: AdminClubRow) {
    setEditingNameId(club.id);
    setEditNameValue(club.club_name);
  }

  async function saveEditName(club: AdminClubRow) {
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === club.club_name) {
      setEditingNameId(null);
      return;
    }
    const ok = await updateClubName(club.club_id, trimmed);
    if (ok) {
      setClubs((prev) =>
        prev.map((c) => (c.club_id === club.club_id ? { ...c, club_name: trimmed } : c)),
      );
    }
    setEditingNameId(null);
  }

  function handleNameKeyDown(e: React.KeyboardEvent, club: AdminClubRow) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditName(club);
    } else if (e.key === "Escape") {
      setEditingNameId(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-2">Loading clubs...</p>;
  }

  if (clubs.length === 0) {
    return <p className="text-gray-500 text-sm py-2">No club history found.</p>;
  }

  const lastYear = String(new Date().getFullYear() - 1);
  const autoLegacy = clubs.length > 0
    && clubs.every((c) => c.year_departed)
    && clubs.every((c) => c.year_departed < lastYear);
  const effectiveLegacy = legacyOverride != null ? legacyOverride : autoLegacy;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">
          Drag badge to upload crest. Click name to edit. Arrows to reorder.
        </p>
        <button
          onClick={cycleLegacy}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            effectiveLegacy
              ? "bg-amber-900/50 border-amber-700/60 text-amber-300"
              : "bg-gray-700 border-gray-600 text-gray-400"
          }`}
          title={`Legacy status: ${legacyOverride === null ? "auto" : legacyOverride ? "forced on" : "forced off"} (click to cycle)`}
        >
          {legacyOverride === null ? "Legacy: Auto" : legacyOverride ? "Legacy: On" : "Legacy: Off"}
          {legacyOverride === null && (effectiveLegacy ? " (yes)" : " (no)")}
        </button>
      </div>
      {clubs.map((club, index) => (
        <div
          key={club.id}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-opacity ${
            club.is_hidden || club.is_youth_team ? "opacity-40" : ""
          }`}
        >
          {/* Reorder buttons */}
          <div className="flex flex-col shrink-0">
            <button
              onClick={() => moveClub(index, -1)}
              disabled={index === 0}
              className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-default p-0.5 transition-colors"
              title="Move up"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => moveClub(index, 1)}
              disabled={index === clubs.length - 1}
              className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-default p-0.5 transition-colors"
              title="Move down"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Badge with drop zone */}
          <CrestDropZone
            clubId={club.club_id}
            currentBadge={club.badge}
            clubName={club.club_name}
            onUpdated={(url) => handleCrestUpdated(club.club_id, url)}
          />

          {/* Club info */}
          <div className="flex-1 min-w-0">
            {editingNameId === club.id ? (
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={() => saveEditName(club)}
                onKeyDown={(e) => handleNameKeyDown(e, club)}
                className="text-sm font-medium bg-gray-700 text-white px-2 py-0.5 rounded border border-gray-500 focus:outline-none focus:border-green-500 w-full"
                autoFocus
              />
            ) : (
              <button
                onClick={() => startEditName(club)}
                className={`text-sm font-medium text-left cursor-text hover:underline ${
                  club.is_hidden ? "line-through text-gray-500" : "text-white"
                }`}
                title="Click to edit name"
              >
                {club.club_name}
              </button>
            )}
            <div className="text-xs text-gray-500">
              {club.year_joined || "?"} – {club.year_departed || "present"}
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1 cursor-pointer" title="Youth team (hidden in game)">
              <input
                type="checkbox"
                checked={club.is_youth_team}
                onChange={() => toggleYouthTeam(club)}
                className="accent-yellow-500 w-3.5 h-3.5"
              />
              <span className={`text-xs ${club.is_youth_team ? "text-yellow-400" : "text-gray-500"}`}>Youth</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer" title="Loan spell">
              <input
                type="checkbox"
                checked={club.is_loan}
                onChange={() => toggleLoan(club)}
                className="accent-blue-500 w-3.5 h-3.5"
              />
              <span className={`text-xs ${club.is_loan ? "text-blue-400" : "text-gray-500"}`}>Loan</span>
            </label>
          </div>

          {/* Hide/show toggle */}
          <button
            onClick={() => toggleHidden(club)}
            title={club.is_hidden ? "Show this club" : "Hide this club"}
            className={`p-1.5 rounded transition-colors ${
              club.is_hidden
                ? "text-gray-500 hover:text-white hover:bg-gray-700"
                : "text-gray-400 hover:text-red-400 hover:bg-gray-700"
            }`}
          >
            {club.is_hidden ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
