import { useState, useRef, useEffect } from "react";
import { searchPlayers } from "../../api/playerCache";
import type { Player } from "../../types";
import type { PlayerSearchProps } from "./types";
import { createDebouncedSearch, type DebouncedSearch } from "./helpers";
import { MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "./constants";

export default function PlayerSearch({ onSelect, disabled, usedPlayerIds, disabledPlayerIds, placeholder, hideThumbnails }: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const searchRef = useRef<DebouncedSearch | null>(null);
  const mountedRef = useRef(false);
  const usedPlayerIdsRef = useRef(usedPlayerIds);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    usedPlayerIdsRef.current = usedPlayerIds;
  }, [usedPlayerIds]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Invalidate pending/in-flight searches; handlers ignore calls after unmount.
      mountedRef.current = false;
      searchRef.current?.cancel();
    };
  }, []);

  function getSearch(): DebouncedSearch {
    if (!searchRef.current) {
      searchRef.current = createDebouncedSearch(searchPlayers, SEARCH_DEBOUNCE_MS, {
        onLoading(value) {
          if (mountedRef.current) setLoading(value);
        },
        onResults(players) {
          if (!mountedRef.current) return;
          const used = usedPlayerIdsRef.current;
          const filtered = used ? players.filter((p) => !used.has(p.id)) : players;
          setResults(filtered);
          if (filtered.length > 0 && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setDropUp(spaceBelow < 320);
          }
          setIsOpen(true);
        },
        onError() {
          if (!mountedRef.current) return;
          setResults([]);
          setIsOpen(false);
        },
      });
    }
    return searchRef.current;
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  function handleChange(value: string) {
    setQuery(value);
    setHighlightIndex(-1);

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsOpen(false);
    }

    getSearch().update(value);
  }

  function isPlayerDisabled(player: Player): boolean {
    return disabledPlayerIds?.has(player.id) ?? false;
  }

  function handleSelect(player: Player) {
    if (isPlayerDisabled(player)) return;
    searchRef.current?.cancel();
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightIndex(-1);
    onSelect(player);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < results.length) {
        handleSelect(results[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-auto">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? "Search for a player..."}
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 disabled:opacity-50"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="player-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={highlightIndex >= 0 ? `player-option-${highlightIndex}` : undefined}
      />
      {loading && (
        <div className="absolute right-3 top-3.5 text-gray-400 text-sm">...</div>
      )}
      {isOpen && !loading && results.length === 0 && (
        <div className={`absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg p-4 text-gray-400 text-sm ${dropUp ? "bottom-full mb-1" : "mt-1"}`}>
          No players found
        </div>
      )}
      {isOpen && results.length > 0 && (
        <ul
          id="player-search-listbox"
          ref={listRef}
          role="listbox"
          className={`absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg overflow-hidden shadow-lg max-h-80 overflow-y-auto ${
            dropUp ? "bottom-full mb-1" : "mt-1"
          }`}
        >
          {results.map((player, index) => {
            const disabledReason = disabledPlayerIds?.get(player.id);
            return (
            <li
              key={player.id}
              id={`player-option-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              aria-disabled={!!disabledReason}
            >
              <button
                onClick={() => handleSelect(player)}
                onMouseEnter={() => setHighlightIndex(index)}
                disabled={!!disabledReason}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                  disabledReason
                    ? "opacity-50 cursor-not-allowed"
                    : index === highlightIndex ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
              >
                {!hideThumbnails && player.thumbnail && (
                  <img
                    src={player.thumbnail}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover bg-gray-700"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-gray-400 text-sm">{player.nationality}</div>
                </div>
                {disabledReason && (
                  <span className="text-gray-500 text-xs shrink-0">{disabledReason}</span>
                )}
              </button>
            </li>
          );
          })}
        </ul>
      )}
    </div>
  );
}
