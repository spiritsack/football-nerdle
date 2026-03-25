import { useState, useRef, useEffect } from "react";
import { searchPlayers } from "../../api/sportsdb";
import type { Player } from "../../types";
import type { PlayerSearchProps } from "./types";

export default function PlayerSearch({ onSelect, disabled, usedPlayerIds }: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const players = await searchPlayers(value.trim());
        const filtered = usedPlayerIds
          ? players.filter((p) => !usedPlayerIds.has(p.id))
          : players;
        setResults(filtered);
        if (filtered.length > 0 && inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          setDropUp(spaceBelow < 320);
        }
        setIsOpen(filtered.length > 0);
      } catch {
        setResults([]);
        setIsOpen(false);
      }
      setLoading(false);
    }, 300);
  }

  function handleSelect(player: Player) {
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
        placeholder="Search for a player..."
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 disabled:opacity-50"
        role="combobox"
        aria-expanded={isOpen}
        aria-activedescendant={highlightIndex >= 0 ? `player-option-${highlightIndex}` : undefined}
      />
      {loading && (
        <div className="absolute right-3 top-3.5 text-gray-400 text-sm">...</div>
      )}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className={`absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg overflow-hidden shadow-lg max-h-80 overflow-y-auto ${
            dropUp ? "bottom-full mb-1" : "mt-1"
          }`}
        >
          {results.map((player, index) => (
            <li
              key={player.id}
              id={`player-option-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
            >
              <button
                onClick={() => handleSelect(player)}
                onMouseEnter={() => setHighlightIndex(index)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                  index === highlightIndex ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
              >
                {player.thumbnail && (
                  <img
                    src={player.thumbnail}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover bg-gray-700"
                  />
                )}
                <div>
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-gray-400 text-sm">{player.nationality}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
