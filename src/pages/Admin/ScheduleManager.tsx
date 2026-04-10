import { useState, useEffect, useCallback, useMemo } from "react";
import { SEED_PLAYERS } from "../../data/seedPlayers";
import { getAllScheduledDays } from "../../api/dailySchedule";
import { upsertSchedule, deleteSchedule, getScheduleRange, getPlayerThumbnails } from "../../api/adminApi";
import { SCHEDULE_DAYS_AHEAD } from "./constants";
import type { Player } from "../../types";
import PlayerClubList from "./PlayerClubList";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateRange(days: number): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

interface DayState {
  date: string;
  assignedPlayer: Player | null;
  suggestion: Player | null;
}

export default function ScheduleManager() {
  const [days, setDays] = useState<DayState[]>([]);
  const [usedPlayerIds, setUsedPlayerIds] = useState<Set<string>>(new Set());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => getTodayString(), []);

  const getRandomUnused = useCallback(
    (excludeIds: Set<string>): Player | null => {
      const available = SEED_PLAYERS.filter((p) => !excludeIds.has(p.id));
      if (available.length === 0) return null;
      return available[Math.floor(Math.random() * available.length)];
    },
    [],
  );

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    const dates = getDateRange(SCHEDULE_DAYS_AHEAD);
    const [allUsed, rangeData] = await Promise.all([
      getAllScheduledDays(),
      getScheduleRange(dates[0], dates[dates.length - 1]),
    ]);

    const allUsedIds = new Set(allUsed.map((r) => r.player_id));
    setUsedPlayerIds(allUsedIds);

    const scheduleMap = new Map(rangeData.map((r) => [r.date, r.player_id]));

    // Track IDs used by suggestions so we don't suggest the same player twice
    const suggestionUsed = new Set(allUsedIds);

    // Fetch fresh thumbnails from the database (seed data may have stale URLs)
    const thumbnails = await getPlayerThumbnails(SEED_PLAYERS.map((p) => p.id));
    const withFreshThumbs = (p: Player): Player =>
      thumbnails.has(p.id) ? { ...p, thumbnail: thumbnails.get(p.id)! } : p;

    const dayStates: DayState[] = dates.map((date) => {
      const assignedId = scheduleMap.get(date);
      const assignedPlayer = assignedId
        ? (SEED_PLAYERS.find((p) => p.id === assignedId) ?? null)
        : null;

      let suggestion: Player | null = null;
      if (!assignedPlayer) {
        suggestion = (() => {
          const avail = SEED_PLAYERS.filter((p) => !suggestionUsed.has(p.id));
          if (avail.length === 0) return null;
          const pick = avail[Math.floor(Math.random() * avail.length)];
          suggestionUsed.add(pick.id);
          return pick;
        })();
      }

      return {
        date,
        assignedPlayer: assignedPlayer ? withFreshThumbs(assignedPlayer) : null,
        suggestion: suggestion ? withFreshThumbs(suggestion) : null,
      };
    });

    setDays(dayStates);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load initial schedule data — setState inside loadSchedule is expected
    loadSchedule(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadSchedule]);

  const handleApprove = useCallback(async (_date: string, player: Player) => {
    // Find the earliest unassigned future date
    const firstOpen = days.find((d) => d.date >= today && !d.assignedPlayer);
    if (!firstOpen) return;

    const ok = await upsertSchedule(firstOpen.date, player.id);
    if (!ok) return;

    setDays((prev) => {
      // Collect suggestions excluding the approved player
      const remainingSuggestions = prev
        .filter((d) => d.date >= today && !d.assignedPlayer && d.suggestion && d.suggestion.id !== player.id)
        .map((d) => d.suggestion!);

      let suggestionIdx = 0;
      return prev.map((d) => {
        if (d.date < today || d.assignedPlayer) return d;
        // First open slot gets the approved player
        if (d.date === firstOpen.date) {
          return { ...d, assignedPlayer: player, suggestion: null };
        }
        // Remaining slots get shifted suggestions
        const next = remainingSuggestions[suggestionIdx] ?? null;
        suggestionIdx++;
        return { ...d, suggestion: next };
      });
    });
    setUsedPlayerIds((prev) => new Set([...prev, player.id]));
    setExpandedDate(null);
  }, [days, today]);

  const handleReject = useCallback(
    (date: string) => {
      setDays((prev) => {
        const skippedDay = prev.find((d) => d.date === date);
        const skippedId = skippedDay?.suggestion?.id;

        // Collect suggestions after the skipped date (shift up)
        const suggestionsAfter = prev
          .filter((d) => d.date > date && !d.assignedPlayer && d.suggestion)
          .map((d) => d.suggestion!);

        // Pick a new suggestion for the last open slot
        const allSuggested = new Set(
          suggestionsAfter.map((s) => s.id),
        );
        const exclude = new Set([...usedPlayerIds, ...allSuggested]);
        if (skippedId) exclude.add(skippedId);
        // Also exclude suggestions before the skipped date
        prev.filter((d) => d.date < date && d.suggestion).forEach((d) => {
          exclude.add(d.suggestion!.id);
        });
        const newTail = getRandomUnused(exclude);
        const shifted = [...suggestionsAfter, newTail];

        let shiftIdx = 0;
        return prev.map((d) => {
          if (d.assignedPlayer || d.date < date) return d;
          if (d.date >= date && !d.assignedPlayer) {
            const next = shifted[shiftIdx] ?? null;
            shiftIdx++;
            return { ...d, suggestion: next };
          }
          return d;
        });
      });
    },
    [usedPlayerIds, getRandomUnused],
  );

  const handleClear = useCallback(async (date: string) => {
    const ok = await deleteSchedule(date);
    if (ok) {
      setDays((prev) =>
        prev.map((d) => {
          if (d.date !== date) return d;
          // Generate a new suggestion for the cleared date
          return { ...d, assignedPlayer: null, suggestion: null };
        }),
      );
      // Reload to get fresh suggestions
      await loadSchedule();
    }
  }, [loadSchedule]);

  const toggleExpand = useCallback((date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  }, []);

  if (loading) {
    return <p className="text-gray-400 text-center py-8">Loading schedule...</p>;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold mb-4">
        Daily Schedule
        <span className="text-gray-400 text-sm font-normal ml-2">
          {SEED_PLAYERS.length - usedPlayerIds.size} players remaining
        </span>
      </h2>

      {days.map((day) => {
        const isPast = day.date < today;
        const isToday = day.date === today;
        const player = day.assignedPlayer ?? day.suggestion;
        const isSuggestion = !day.assignedPlayer && !!day.suggestion;
        const isExpanded = expandedDate === day.date;

        return (
          <div
            key={day.date}
            className={`rounded-lg border ${
              isToday
                ? "border-green-600 bg-gray-800"
                : isPast
                  ? "border-gray-700 bg-gray-800/50 opacity-60"
                  : "border-gray-700 bg-gray-800"
            }`}
          >
            {/* Day row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Date */}
              <div className="w-32 shrink-0">
                <div className="text-sm font-medium text-white">
                  {formatDate(day.date)}
                  {isToday && <span className="text-green-400 ml-1">(today)</span>}
                </div>
                <div className="text-xs text-gray-500">{day.date}</div>
              </div>

              {/* Player info */}
              {player ? (
                <button
                  onClick={() => toggleExpand(day.date)}
                  className="flex items-center gap-3 flex-1 text-left hover:bg-gray-700/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                >
                  {player.thumbnail && (
                    <img
                      src={player.thumbnail}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover bg-gray-700"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${isSuggestion ? "text-yellow-300" : "text-white"}`}>
                      {player.name}
                    </span>
                    <a
                      href={`https://duckduckgo.com/?q=${encodeURIComponent(player.name + " wiki")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-500 hover:text-blue-400 ml-1.5 inline-block transition-colors"
                      title="Look up on Wikipedia"
                    >
                      <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    {isSuggestion && (
                      <span className="text-yellow-500/70 text-xs ml-2">suggestion</span>
                    )}
                    <div className="text-xs text-gray-400">{player.nationality}</div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <span className="flex-1 text-gray-500 text-sm italic">No players available</span>
              )}

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                {isSuggestion && !isPast && (
                  <>
                    <button
                      onClick={() => handleApprove(day.date, day.suggestion!)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(day.date)}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Skip
                    </button>
                  </>
                )}
                {day.assignedPlayer && !isPast && !isToday && (
                  <button
                    onClick={() => handleClear(day.date)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Expanded: club history */}
            {isExpanded && player && (
              <div className="border-t border-gray-700 px-4 py-3">
                <PlayerClubList playerId={player.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
