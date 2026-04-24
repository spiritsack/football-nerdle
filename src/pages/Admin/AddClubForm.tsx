import { useEffect, useRef, useState } from "react";
import { addPlayerClub, searchClubs } from "../../api/adminApi";
import type { AdminClubRow } from "./types";

interface Props {
  playerId: string;
  onAdded: (row: AdminClubRow) => void;
}

interface ClubHit {
  id: string;
  name: string;
  badge: string;
}

export default function AddClubForm({ playerId, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClubHit[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ClubHit | null>(null);
  const [yearJoined, setYearJoined] = useState("");
  const [yearDeparted, setYearDeparted] = useState("");
  const [isPresent, setIsPresent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const hits = await searchClubs(value.trim());
      setResults(hits);
      setIsOpen(hits.length > 0);
    }, 250);
  }

  function pickClub(club: ClubHit) {
    setSelected(club);
    setQuery(club.name);
    setIsOpen(false);
  }

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setYearJoined("");
    setYearDeparted("");
    setIsPresent(false);
    setError(null);
  }

  async function handleAdd() {
    setError(null);
    if (!selected) {
      setError("Pick a club from the list.");
      return;
    }
    if (!/^\d{4}$/.test(yearJoined)) {
      setError("Year joined must be a 4-digit year.");
      return;
    }
    const departed = isPresent ? "" : yearDeparted;
    if (!isPresent && !/^\d{4}$/.test(departed)) {
      setError("Year departed must be a 4-digit year, or check Present.");
      return;
    }
    setSaving(true);
    const row = await addPlayerClub(playerId, selected.id, yearJoined, departed);
    setSaving(false);
    if (!row) {
      setError("Failed to add club. It may already exist for this player+year.");
      return;
    }
    onAdded(row);
    reset();
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
      <p className="text-xs text-gray-500">Add a club</p>
      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search club..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-green-500"
        />
        {isOpen && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg overflow-hidden shadow-lg max-h-64 overflow-y-auto">
            {results.map((club) => (
              <li key={club.id}>
                <button
                  type="button"
                  onClick={() => pickClub(club)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-gray-700 transition-colors"
                >
                  {club.badge && (
                    <img
                      src={club.badge}
                      alt=""
                      className="w-6 h-6 object-contain bg-gray-700 rounded"
                    />
                  )}
                  <span className="text-white">{club.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={yearJoined}
          onChange={(e) => setYearJoined(e.target.value.replace(/\D/g, ""))}
          placeholder="Joined"
          className="w-20 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-green-500"
        />
        <span className="text-gray-500 text-sm">–</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={isPresent ? "" : yearDeparted}
          disabled={isPresent}
          onChange={(e) => setYearDeparted(e.target.value.replace(/\D/g, ""))}
          placeholder="Departed"
          className="w-20 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
        />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isPresent}
            onChange={(e) => setIsPresent(e.target.checked)}
            className="accent-green-500 w-3.5 h-3.5"
          />
          <span className="text-xs text-gray-300">Present</span>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !selected || !yearJoined}
          className="ml-auto px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Adding..." : "Add"}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
