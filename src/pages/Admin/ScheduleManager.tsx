import { useState, useEffect, useCallback, useMemo } from "react";
import { SEED_PLAYERS } from "../../data/seedPlayers";
import { getAllScheduledDays } from "../../api/dailySchedule";
import { upsertSchedule, deleteSchedule, getScheduleRange } from "../../api/adminApi";
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

    const dayStates: DayState[] = dates.map((date) => {
      const assignedId = scheduleMap.get(date);
      const assignedPlayer = assignedId
        ? SEED_PLAYERS.find((p) => p.id === assignedId) ?? null
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

      return { date, assignedPlayer, suggestion };
    });

    setDays(dayStates);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load initial schedule data — setState inside loadSchedule is expected
    loadSchedule(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadSchedule]);

  const handleApprove = useCallback(async (date: string, player: Player) => {
    const ok = await upsertSchedule(date, player.id);
    if (ok) {
      setDays((prev) =>
        prev.map((d) =>
          d.date === date ? { ...d, assignedPlayer: player, suggestion: null } : d,
        ),
      );
      setUsedPlayerIds((prev) => new Set([...prev, player.id]));
    }
  }, []);

  const handleReject = useCallback(
    (date: string) => {
      setDays((prev) =>
        prev.map((d) => {
          if (d.date !== date || d.assignedPlayer) return d;
          // Pick a new suggestion, excluding already-used and current suggestions for other days
          const allSuggested = new Set(
            prev.filter((x) => x.suggestion && x.date !== date).map((x) => x.suggestion!.id),
          );
          const exclude = new Set([...usedPlayerIds, ...allSuggested]);
          if (d.suggestion) exclude.add(d.suggestion.id);
          const newSuggestion = getRandomUnused(exclude);
          return { ...d, suggestion: newSuggestion };
        }),
      );
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
                      className="w-8 h-8 rounded-full object-cover bg-gray-700"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${isSuggestion ? "text-yellow-300" : "text-white"}`}>
                      {player.name}
                    </span>
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
