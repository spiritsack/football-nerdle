import { useEffect, useRef, useState } from "react";
import { addPlayerClub, searchClubs } from "../../api/adminApi";
import type { AdminClubRow } from "./types";
import CreateClubForm from "./CreateClubForm";
import { focusAfterCreatePanel } from "./createClub";

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
  const [isLoan, setIsLoan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ kind: "created" | "crestFailed"; name: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const joinedRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes once the create-club panel has unmounted */
  const pendingFocusRef = useRef<ReturnType<typeof focusAfterCreatePanel> | null>(null);

  useEffect(() => {
    if (creating || !pendingFocusRef.current) return;
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target === "joined") joinedRef.current?.focus();
    // The button only renders for a query of 2+ characters; else go back to the search
    else (createButtonRef.current ?? searchRef.current)?.focus();
  }, [creating]);

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
    setNotice(null);
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
    setIsLoan(false);
    setError(null);
    setNotice(null);
  }

  function openCreate() {
    setIsOpen(false);
    setCreating(true);
  }

  function handleCreated(club: ClubHit, crestFailed: boolean) {
    pickClub(club);
    pendingFocusRef.current = focusAfterCreatePanel("created");
    setCreating(false);
    setNotice({ kind: crestFailed ? "crestFailed" : "created", name: club.name });
  }

  function handleUseClub(club: ClubHit) {
    pickClub(club);
    pendingFocusRef.current = focusAfterCreatePanel("used");
    setCreating(false);
  }

  function handleCancelCreate() {
    pendingFocusRef.current = focusAfterCreatePanel("cancelled");
    setCreating(false);
  }

  const canCreate = query.trim().length >= 2 && !selected && !creating;
  const dropdownOpen = isOpen && results.length > 0;

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
    const row = await addPlayerClub(playerId, selected.id, yearJoined, departed, isLoan);
    setSaving(false);
    if (!row) {
      setError("Failed to add club. A stint at this club with the same joined year and loan status may already exist.");
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
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search club..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-green-500"
        />
        {dropdownOpen && (
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
            {canCreate && (
              <li>
                <button
                  type="button"
                  onClick={openCreate}
                  className="w-full px-3 py-2 text-left text-xs text-green-400 hover:text-green-300 hover:bg-gray-700 border-t border-gray-700 transition-colors"
                >
                  + Create new club
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {canCreate && !dropdownOpen && (
        <button
          ref={createButtonRef}
          type="button"
          onClick={openCreate}
          className="block text-xs text-green-400 hover:text-green-300 transition-colors"
        >
          + Create new club
        </button>
      )}

      {notice?.kind === "created" && (
        <p className="text-xs text-green-400" role="status">Created "{notice.name}". Add the spell below.</p>
      )}
      {notice?.kind === "crestFailed" && (
        <p className="text-xs text-amber-400" role="status">
          Club created, but the crest upload failed — drag a crest onto its badge.
        </p>
      )}

      {creating && (
        <CreateClubForm
          initialName={query}
          onCreated={handleCreated}
          onUseClub={handleUseClub}
          onCancel={handleCancelCreate}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={joinedRef}
          type="text"
          inputMode="numeric"
          maxLength={4}
          aria-label="Year joined"
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
        <label className="flex items-center gap-1.5 cursor-pointer" title="Loan spell">
          <input
            type="checkbox"
            checked={isLoan}
            onChange={(e) => setIsLoan(e.target.checked)}
            className="accent-blue-500 w-3.5 h-3.5"
          />
          <span className={`text-xs ${isLoan ? "text-blue-400" : "text-gray-300"}`}>Loan</span>
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
