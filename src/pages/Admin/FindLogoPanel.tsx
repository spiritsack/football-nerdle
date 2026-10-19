import { useEffect, useState } from "react";
import { findClubLogo } from "../../api/clubLogoLookup";
import type { LogoLookup } from "../../api/clubLogoLookup";
import { saveClubLogo } from "../../api/adminApi";
import LogoCandidate from "./LogoCandidate";

interface Props {
  club: { id: string; name: string };
  /** `alsoFilled`: same-named duplicate clubs that got the same crest */
  onSaved: (badge: string, alsoFilled: string[]) => void;
  onClose: () => void;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; logo: LogoLookup; saving: boolean; saveError: string | null };

/** "Find logo" for one club: look it up on Wikipedia, preview it, Accept or Skip */
export default function FindLogoPanel({ club, onSaved, onClose }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { id, name } = club;

  useEffect(() => {
    let cancelled = false;
    findClubLogo({ id, name })
      .then((logo) => { if (!cancelled) setState({ status: "ready", logo, saving: false, saveError: null }); })
      .catch((err: unknown) => {
        console.error("Find logo failed:", err);
        if (!cancelled) setState({ status: "error", message: "Couldn't reach Wikipedia. Check your connection and try again." });
      });
    return () => { cancelled = true; };
  }, [id, name, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function accept(logo: LogoLookup) {
    if (!logo.imageUrl) return;
    setState({ status: "ready", logo, saving: true, saveError: null });
    try {
      const { badge, alsoFilled } = await saveClubLogo(club, logo.imageUrl);
      onSaved(badge, alsoFilled);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "ready", logo, saving: false, saveError: `${message}. Try again, or upload the crest by hand.` });
    }
  }

  return (
    <section className="ml-14 mb-1 rounded-lg border border-gray-600 bg-gray-900/60 p-2.5 space-y-2" aria-label={`Find logo for ${club.name}`}>
      {state.status === "loading" && (
        <p className="text-xs text-gray-400" role="status">Looking for {club.name}'s logo on Wikipedia...</p>
      )}

      {state.status === "error" && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-red-400" role="alert">{state.message}</p>
          <button onClick={retry} className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors">
            Retry
          </button>
          <button onClick={onClose} className="ml-auto text-xs text-gray-400 hover:text-white transition-colors">Close</button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {state.logo.status === "review" && (
            <p className="text-[11px] uppercase tracking-wide text-amber-400">Check by hand</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <LogoCandidate logo={state.logo} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {state.logo.imageUrl && (
                <button
                  onClick={() => accept(state.logo)}
                  disabled={state.saving}
                  className="px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                  title={state.logo.status === "review" ? "Use this image anyway — you've checked it by hand" : "Download this logo and save it as the club's crest"}
                >
                  {state.saving ? "Saving..." : state.logo.status === "review" ? "Use anyway" : "Accept"}
                </button>
              )}
              <button
                onClick={onClose}
                disabled={state.saving}
                className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {state.logo.imageUrl ? "Skip" : "Close"}
              </button>
            </div>
          </div>
          {state.saveError && <p className="text-xs text-red-400" role="alert">{state.saveError}</p>}
        </>
      )}
    </section>
  );
}
