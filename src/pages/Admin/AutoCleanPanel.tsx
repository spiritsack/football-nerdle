import { useEffect, useMemo, useRef, useState } from "react";
import { applyClubCleanup, getPlayerNameAndTransfermarktId, searchClubs } from "../../api/adminApi";
import { fetchPlayerWikipediaPage } from "../../api/wikipedia";
import type { WikipediaPage } from "../../api/wikipedia";
import { finalOrder, parseInfobox, planCleanup, unresolvedClubNames } from "./clubHistoryCleanup";
import type { CleanupPlan, ClubRef, ProposedRow, SuggestedChange } from "./clubHistoryCleanup";
import type { AdminClubRow } from "./types";

interface Props {
  playerId: string;
  clubs: AdminClubRow[];
  /** Called after changes are written, so the club list can reload */
  onApplied: () => Promise<void>;
  onClose: () => void;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** `rows` is the club history the plan was made from */
  | { status: "ready"; page: WikipediaPage; plan: CleanupPlan; rows: AdminClubRow[] };

async function loadPlan(playerId: string, clubs: AdminClubRow[]): Promise<State> {
  const player = await getPlayerNameAndTransfermarktId(playerId);
  if (!player) return { status: "error", message: "Couldn't load the player." };
  const page = await fetchPlayerWikipediaPage(player.transfermarktId, player.name);
  if (!page) return { status: "error", message: `No English Wikipedia page found for ${player.name}.` };

  const career = parseInfobox(page.wikitext);
  const candidates: ClubRef[] = [];
  if (career) {
    for (const name of unresolvedClubNames(career, clubs)) {
      const hits = await searchClubs(name);
      candidates.push(...hits.map((c) => ({ club_id: c.id, club_name: c.name, badge: c.badge })));
    }
  }
  const plan = planCleanup({ rows: clubs, career, candidates, currentYear: new Date().getFullYear() });
  if (page.foundBy === "name") {
    plan.review.unshift(`No Wikidata link for this player's TransferMarkt ID: "${page.title}" was found by name search. Check it's the right player before accepting.`);
  }
  return { status: "ready", page, plan, rows: clubs };
}

function years(row: { year_joined: string; year_departed: string }): string {
  return `${row.year_joined || "?"}–${row.year_departed || "present"}`;
}

function Flags({ row }: { row: Pick<ProposedRow, "is_loan" | "is_youth_team" | "is_hidden"> }) {
  return (
    <span className="flex gap-1 shrink-0">
      {row.is_loan && <span className="text-[10px] px-1.5 rounded bg-blue-900/60 text-blue-300">Loan</span>}
      {row.is_youth_team && <span className="text-[10px] px-1.5 rounded bg-yellow-900/60 text-yellow-300">Youth</span>}
      {row.is_hidden && <span className="text-[10px] px-1.5 rounded bg-gray-700 text-gray-400">Hidden</span>}
    </span>
  );
}

function HistoryRow({ row, tone }: { row: ProposedRow | AdminClubRow; tone: "plain" | "changed" | "new" }) {
  const toneClass = tone === "new"
    ? "border-green-500 bg-green-900/20"
    : tone === "changed" ? "border-amber-500 bg-amber-900/10" : "border-transparent";
  return (
    <li className={`flex items-center gap-2 pl-2 pr-1 py-1 border-l-2 rounded-r ${toneClass} ${row.is_hidden ? "opacity-50" : ""}`}>
      <span className={`text-sm truncate ${row.is_hidden ? "line-through text-gray-400" : "text-white"}`}>{row.club_name}</span>
      <span className="text-xs text-gray-500 shrink-0">{years(row)}</span>
      <span className="ml-auto" />
      <Flags row={row} />
    </li>
  );
}

function describeChange(change: SuggestedChange): string {
  if (change.kind === "reorder") return "Club order";
  if (change.kind === "insert") return `Add ${change.after!.club_name} ${years(change.after!)}`;
  return `${change.before!.club_name} ${years(change.before!)}`;
}

export default function AutoCleanPanel({ playerId, clubs, onApplied, onClose }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const clubsRef = useRef(clubs);
  useEffect(() => {
    clubsRef.current = clubs;
  }, [clubs]);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPlan(playerId, clubsRef.current)
      .then((next) => { if (!cancelled) setState(next); })
      .catch((err: unknown) => {
        console.error("Auto-clean failed:", err);
        if (!cancelled) setState({ status: "error", message: "Couldn't reach Wikipedia. Check your connection and try again." });
      });
    return () => { cancelled = true; };
  }, [playerId, attempt]);

  function load() {
    setState({ status: "loading" });
    setSkipped(new Set());
    setApplyError(null);
    setAttempt((n) => n + 1);
  }

  const plan = state.status === "ready" ? state.plan : null;
  const rows = useMemo(() => (state.status === "ready" ? state.rows : []), [state]);
  const accepted = useMemo(
    () => new Set((plan?.changes ?? []).map((c) => c.id).filter((id) => !skipped.has(id))),
    [plan, skipped],
  );

  // Live preview of the suggested history, honouring skipped rows
  const preview = useMemo(() => {
    if (!plan) return [];
    const updated = new Map(plan.changes.filter((c) => c.kind === "update" && accepted.has(c.id)).map((c) => [c.before!.id, c.after!]));
    return finalOrder(plan, rows, accepted).map((p) => {
      if (p.rowId === null) return { row: p, tone: "new" as const };
      const after = updated.get(p.rowId);
      return after
        ? { row: after, tone: "changed" as const }
        : { row: rows.find((c) => c.id === p.rowId)!, tone: "plain" as const };
    });
  }, [plan, rows, accepted]);

  function toggle(id: string, accept: boolean) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (accept) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply(ids: Set<string>) {
    if (!plan || ids.size === 0) return;
    setApplying(true);
    setApplyError(null);
    const { failed } = await applyClubCleanup(playerId, plan, rows, ids);
    await onApplied();
    setApplying(false);
    if (failed > 0) {
      setApplyError(`${failed} change${failed === 1 ? "" : "s"} failed to save. The club list shows what was saved; check again to retry the rest.`);
    } else {
      onClose();
    }
  }

  return (
    <section className="mb-3 rounded-lg border border-gray-600 bg-gray-900/60 p-3 space-y-3" aria-label="Auto-clean from Wikipedia">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Auto-clean from Wikipedia</h3>
        {state.status === "ready" && (
          <a
            href={state.page.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-green-400 hover:underline truncate"
          >
            {state.page.title} ↗
          </a>
        )}
        <button
          onClick={onClose}
          className="ml-auto text-xs text-gray-400 hover:text-white transition-colors"
        >
          Close
        </button>
      </div>

      {state.status === "loading" && (
        <p className="text-sm text-gray-400" role="status">Checking Wikipedia...</p>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-400" role="alert">{state.message}</p>
          <button
            onClick={load}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {plan && (
        <>
          {plan.currentClubNote && (
            <p className="text-sm text-amber-300 bg-amber-900/20 border border-amber-800/60 rounded px-2 py-1.5">
              {plan.currentClubNote}
            </p>
          )}

          {plan.changes.length === 0 ? (
            <p className="text-sm text-green-400" role="status">
              Nothing to change: the club history matches Wikipedia{plan.review.length > 0 ? " apart from the notes below" : ""}.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Current</p>
                  <ul className="space-y-0.5">
                    {rows.map((c) => <HistoryRow key={c.id} row={c} tone="plain" />)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Suggested</p>
                  <ul className="space-y-0.5">
                    {preview.map(({ row, tone }) => (
                      <HistoryRow key={"key" in row ? row.key : row.id} row={row} tone={tone} />
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Changes ({accepted.size} of {plan.changes.length} accepted)
                </p>
                <ul className="divide-y divide-gray-800">
                  {plan.changes.map((change) => {
                    const isAccepted = accepted.has(change.id);
                    return (
                      <li key={change.id} className="flex items-center gap-3 py-1.5">
                        <div className={`flex-1 min-w-0 ${isAccepted ? "" : "opacity-50"}`}>
                          <p className="text-sm text-white truncate">{describeChange(change)}</p>
                          <p className="text-xs text-gray-400">{change.reasons.join(" · ")}</p>
                        </div>
                        <div className="flex shrink-0 rounded-lg overflow-hidden border border-gray-600" role="group" aria-label={describeChange(change)}>
                          <button
                            onClick={() => toggle(change.id, true)}
                            aria-pressed={isAccepted}
                            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                              isAccepted ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => toggle(change.id, false)}
                            aria-pressed={!isAccepted}
                            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                              !isAccepted ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            Skip
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {plan.review.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Check by hand</p>
              <ul className="space-y-1 list-disc pl-5">
                {plan.review.map((note) => (
                  <li key={note} className="text-xs text-amber-200">{note}</li>
                ))}
              </ul>
            </div>
          )}

          {applyError && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-400" role="alert">{applyError}</p>
              <button
                onClick={load}
                className="shrink-0 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Check again
              </button>
            </div>
          )}

          {plan.changes.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => apply(new Set(plan.changes.map((c) => c.id)))}
                disabled={applying || applyError !== null}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {applying ? "Applying..." : "Accept all"}
              </button>
              <button
                onClick={() => apply(accepted)}
                disabled={applying || applyError !== null || accepted.size === 0}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply {accepted.size} accepted
              </button>
              <button
                onClick={onClose}
                disabled={applying}
                className="ml-auto text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
