import { useCallback, useEffect, useState } from "react";
import { getClubsWithoutBadge, saveClubLogo } from "../../api/adminApi";
import type { MissingBadgeClub } from "../../api/adminApi";
import { findClubLogo } from "../../api/clubLogoLookup";
import type { LogoLookup } from "../../api/clubLogoLookup";
import LogoCandidate from "./LogoCandidate";
import { LOGO_LOOKUP_CONCURRENCY, MISSING_LOGOS_PAGE_SIZE } from "./constants";

type Lookup = { status: "loading" } | { status: "error" } | LogoLookup;
type Save = { status: "saving" } | { status: "saved"; badge: string; note?: string } | { status: "failed"; message: string };

interface Row {
  club: MissingBadgeClub;
  lookup: Lookup;
  accepted: boolean;
  save?: Save;
}

/** Run `task` over `items`, at most `limit` at a time */
async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) await task(items[next++]);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function usageLabel(count: number): string {
  return `${count.toLocaleString()} spell${count === 1 ? "" : "s"}`;
}

function canSave(row: Row): row is Row & { lookup: LogoLookup & { imageUrl: string } } {
  return "imageUrl" in row.lookup && !!row.lookup.imageUrl && row.save?.status !== "saved";
}

/** "Fill all missing": every club without a badge with its proposed logo, most-used first, a page at a time */
export default function MissingLogosPanel({ onClose }: { onClose: () => void }) {
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const updateRow = useCallback((clubId: string, change: (row: Row) => Row) => {
    setRows((prev) => prev?.map((r) => (r.club.id === clubId ? change(r) : r)) ?? prev);
  }, []);

  const lookUp = useCallback(async (club: MissingBadgeClub, isCancelled: () => boolean) => {
    try {
      const logo = await findClubLogo(club);
      if (!isCancelled()) updateRow(club.id, (r) => ({ ...r, lookup: logo, accepted: logo.status === "found" }));
    } catch (err) {
      console.error(`Find logo failed for ${club.id}:`, err);
      if (!isCancelled()) updateRow(club.id, (r) => ({ ...r, lookup: { status: "error" }, accepted: false }));
    }
  }, [updateRow]);

  useEffect(() => {
    let cancelled = false;
    getClubsWithoutBadge(offset, MISSING_LOGOS_PAGE_SIZE)
      .then(({ clubs, total }) => {
        if (cancelled) return;
        setTotal(total);
        setRows(clubs.map((club) => ({ club, lookup: { status: "loading" }, accepted: false })));
        return eachLimited(clubs, LOGO_LOOKUP_CONCURRENCY, (club) => lookUp(club, () => cancelled));
      })
      .catch((err: unknown) => {
        console.error("Loading clubs without a logo failed:", err);
        if (!cancelled) setLoadError("Couldn't load the clubs without a logo.");
      });
    return () => { cancelled = true; };
  }, [offset, lookUp]);

  function retryLookup(club: MissingBadgeClub) {
    updateRow(club.id, (r) => ({ ...r, lookup: { status: "loading" } }));
    lookUp(club, () => false);
  }

  async function save(targets: Row[]) {
    setSaving(true);
    setSummary(null);
    const filled = new Set<string>();
    let saved = 0;
    let failed = 0;
    for (const row of targets) {
      // A same-named duplicate earlier in this batch may already have filled it
      if (filled.has(row.club.id) || !canSave(row)) continue;
      updateRow(row.club.id, (r) => ({ ...r, save: { status: "saving" } }));
      try {
        const { badge, alsoFilled } = await saveClubLogo(row.club, row.lookup.imageUrl);
        saved++;
        filled.add(row.club.id);
        updateRow(row.club.id, (r) => ({
          ...r,
          save: { status: "saved", badge, note: alsoFilled.length ? `also ${alsoFilled.join(", ")}` : undefined },
        }));
        for (const id of alsoFilled) {
          filled.add(id);
          updateRow(id, (r) => ({ ...r, save: { status: "saved", badge, note: `same crest as ${row.club.id}` } }));
        }
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        updateRow(row.club.id, (r) => ({ ...r, save: { status: "failed", message } }));
      }
    }
    setSaving(false);
    setSummary(failed > 0
      ? `Saved ${saved} of ${saved + failed} logos. ${failed} failed — Accept them again to retry, or upload by hand.`
      : `Saved ${saved} logo${saved === 1 ? "" : "s"}.`);
  }

  function nextPage() {
    // Saved clubs drop out of the "no badge" list, so the next page starts sooner
    const savedHere = rows?.filter((r) => r.save?.status === "saved").length ?? 0;
    setRows(null);
    setSummary(null);
    setOffset((o) => o + MISSING_LOGOS_PAGE_SIZE - savedHere);
  }

  const found = rows?.filter((r) => r.lookup.status === "found") ?? [];
  const review = rows?.filter((r) => r.lookup.status === "review" || r.lookup.status === "error") ?? [];
  const loading = rows?.filter((r) => r.lookup.status === "loading") ?? [];
  const stillLoading = rows === null || loading.length > 0;
  const toSaveAll = found.filter(canSave);
  const toSaveAccepted = (rows ?? []).filter((r) => r.accepted && canSave(r));

  function renderRow(row: Row) {
    const { club, lookup, save } = row;
    return (
      <li key={club.id} className="flex items-center gap-3 py-2">
        <div className="w-40 shrink-0 min-w-0">
          <p className="text-sm text-white truncate" title={club.name}>{club.name}</p>
          <p className="text-[11px] text-gray-500 truncate" title="Spells in players' club histories">{club.id} · {usageLabel(club.usage_count)}</p>
        </div>
        <div className={`flex-1 min-w-0 ${row.accepted || lookup.status !== "found" ? "" : "opacity-50"}`}>
          {lookup.status === "loading" && <p className="text-xs text-gray-400">Looking on Wikipedia...</p>}
          {lookup.status === "error" && <p className="text-xs text-red-400">Couldn't reach Wikipedia.</p>}
          {(lookup.status === "found" || lookup.status === "review") && <LogoCandidate logo={lookup} />}
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs">
          {save?.status === "saving" && <span className="text-gray-400">Saving...</span>}
          {save?.status === "saved" && (
            <span className="flex items-center gap-1.5 text-green-400" title={save.note}>
              <img src={save.badge} alt="" className="w-6 h-6 object-contain" />
              Saved{save.note ? ` (${save.note})` : ""}
            </span>
          )}
          {save?.status === "failed" && <span className="text-red-400" role="alert">{save.message}</span>}
          {lookup.status === "error" && (
            <button onClick={() => retryLookup(club)} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">
              Retry
            </button>
          )}
          {canSave(row) && save?.status !== "saving" && (
            <div className="flex rounded-lg overflow-hidden border border-gray-600" role="group" aria-label={club.name}>
              <button
                onClick={() => updateRow(club.id, (r) => ({ ...r, accepted: true }))}
                aria-pressed={row.accepted}
                disabled={saving}
                className={`px-2.5 py-1 font-medium transition-colors ${row.accepted ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                title={lookup.status === "review" ? "Use this image anyway — you've checked it by hand" : undefined}
              >
                Accept
              </button>
              <button
                onClick={() => updateRow(club.id, (r) => ({ ...r, accepted: false }))}
                aria-pressed={!row.accepted}
                disabled={saving}
                className={`px-2.5 py-1 font-medium transition-colors ${!row.accepted ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                Skip
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <section className="rounded-lg border border-gray-600 bg-gray-900/60 p-3 space-y-3" aria-label="Fill all missing logos">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Fill all missing logos</h3>
        {total !== null && rows && (
          <span className="text-xs text-gray-400">
            {total.toLocaleString()} clubs without a logo, most-used first · showing {Math.min(offset + 1, total)}–{Math.min(offset + rows.length, total)}
          </span>
        )}
        <button onClick={onClose} disabled={saving} className="ml-auto text-xs text-gray-400 hover:text-white transition-colors">
          Close
        </button>
      </div>

      {loadError && <p className="text-sm text-red-400" role="alert">{loadError}</p>}
      {!rows && !loadError && <p className="text-sm text-gray-400" role="status">Loading clubs...</p>}
      {rows && rows.length === 0 && <p className="text-sm text-green-400" role="status">Every club has a logo.</p>}

      {rows && rows.length > 0 && (
        <>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Found ({found.length})</p>
            {found.length === 0 ? (
              <p className="text-xs text-gray-500">{stillLoading ? "None yet." : "No logos found on this page."}</p>
            ) : (
              <ul className="divide-y divide-gray-800">{found.map(renderRow)}</ul>
            )}
          </div>

          {review.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-400 mb-1">Check by hand ({review.length})</p>
              <ul className="divide-y divide-gray-800">{review.map(renderRow)}</ul>
            </div>
          )}

          {loading.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1" role="status">
                Looking up {loading.length} of {rows.length} on Wikipedia...
              </p>
              <ul className="divide-y divide-gray-800">{loading.map(renderRow)}</ul>
            </div>
          )}

          {summary && (
            <p className={`text-sm ${summary.includes("failed") ? "text-red-400" : "text-green-400"}`} role="status">{summary}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => save(toSaveAll)}
              disabled={saving || toSaveAll.length === 0}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : `Accept all found (${toSaveAll.length})`}
            </button>
            <button
              onClick={() => save(toSaveAccepted)}
              disabled={saving || toSaveAccepted.length === 0}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save {toSaveAccepted.length} accepted
            </button>
            <button
              onClick={nextPage}
              disabled={saving || stillLoading || total === null || offset + rows.length >= total}
              className="ml-auto px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next {MISSING_LOGOS_PAGE_SIZE} →
            </button>
          </div>
        </>
      )}
    </section>
  );
}
