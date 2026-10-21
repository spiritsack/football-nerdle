import type { ReactNode } from "react";
import { Crown, Info, Lock, Route, SkipForward, UserRound } from "lucide-react";
import PlayerSearch from "../PlayerSearch";
import { SECTION_LABEL } from "../../theme";
import type { MergedClub, PlayerCardProps } from "./types";
import { getFlagEmoji } from "./helpers";

function BadgeImg({ src, alt, size }: { src: string; alt: string; size: "sm" | "lg" }) {
  const imgClass = size === "lg" ? "w-10 h-10 object-contain" : "w-7 h-7 object-contain";
  const fallbackClass = size === "lg"
    ? "w-10 h-10 bg-slate-700 rounded flex items-center justify-center text-[0.55rem] text-slate-300 text-center p-0.5 leading-tight overflow-hidden"
    : "w-7 h-7 bg-slate-700 rounded flex items-center justify-center text-[0.45rem] text-slate-300 text-center p-0.5 leading-tight overflow-hidden";

  return (
    <>
      {src ? (
        <img
          src={src}
          alt=""
          className={imgClass}
          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
        />
      ) : null}
      <div className={`${fallbackClass} ${src ? "hidden" : ""}`}>{alt}</div>
    </>
  );
}

function ClubTile({ club, hidden }: { club: MergedClub; hidden: boolean }) {
  return (
    <li
      className={`glass-card relative rounded-xl p-3 sm:p-4 flex items-center gap-3 min-w-0 ${
        club.isLoan ? "border-dashed border-gold-500/60" : "border-slate-800"
      }`}
    >
      {club.isLoan && (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-extrabold uppercase bg-gold-500 text-slate-950 px-1.5 py-0.5 rounded">
          Loan
        </span>
      )}
      <span className={`shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center ${hidden ? "w-12 h-12" : "w-10 h-10"}`}>
        <BadgeImg src={club.badge} alt={club.teamName} size={hidden ? "lg" : "sm"} />
      </span>
      {hidden ? (
        <span className="min-w-0" aria-hidden="true">
          <span className="block font-bold text-sm text-slate-500">Hidden club</span>
          <span className="block text-xs text-slate-600 font-mono">????–????</span>
        </span>
      ) : (
        <span className={`min-w-0 ${club.isLoan ? "pr-8" : ""}`}>
          <span className="block font-bold text-sm text-white leading-snug">{club.teamName}</span>
          <span className="block text-xs text-slate-400 font-mono whitespace-nowrap">
            {club.yearJoined}{club.yearDeparted ? ` – ${club.yearDeparted}` : " – present"}
          </span>
        </span>
      )}
    </li>
  );
}

function HintCard({ step, label, value }: { step: number; label: string; value: ReactNode | null }) {
  return (
    <div className={`rounded-xl p-3 text-center transition-all ${value !== null ? "glass-card-active animate-[fadeIn_0.4s_ease-in]" : "glass-card border-slate-800"}`}>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
        {step}. {label}
      </p>
      <div className="min-h-12 flex flex-col items-center justify-center py-1">
        {value !== null ? (
          <span className="text-sm font-bold text-white break-words">{value}</span>
        ) : (
          <span className="flex flex-col items-center text-slate-500">
            <Lock className="w-3.5 h-3.5 mb-1" aria-hidden="true" />
            <span className="text-xs font-semibold">???</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default function PlayerCard({ player, clubs, hints, revealed, hardMode, result, onGuess, onSkip, attempts, maxAttempts, disabledPlayerIds }: PlayerCardProps) {
  const age = player.dateBorn ? new Date().getFullYear() - parseInt(player.dateBorn, 10) : null;

  // A player is considered "legacy" (potentially retired) if all their clubs have a departure year
  // and none departed in the current or previous year (still potentially active).
  // The is_legacy DB field overrides auto-detection when set.
  const lastYear = String(new Date().getFullYear() - 1);
  const autoLegacy = clubs.length > 0
    && clubs.every((c) => c.yearDeparted)
    && clubs.every((c) => c.yearDeparted < lastYear);
  const isLegacy = player.isLegacy != null ? player.isLegacy : autoLegacy;

  const flag = revealed ? getFlagEmoji(player.nationality ?? "") : null;
  const hideClubs = hardMode && !revealed;

  const surface = isLegacy ? "legacy-card" : "glass-panel";
  const borderColor = result === "won"
    ? "border-pitch-500/60"
    : result === "lost"
      ? "border-rose-500/50"
      : isLegacy ? "" : "border-slate-800";

  const photo = player.thumbnail ? (
    <img
      src={player.thumbnail}
      alt={revealed ? player.name : ""}
      className={`object-cover bg-slate-800 border-2 shrink-0 ${isLegacy ? "border-gold-500/50 sepia-[.3]" : "border-slate-600"} ${revealed ? "w-20 h-20 rounded-xl" : "w-14 h-14 rounded-full"}`}
    />
  ) : null;

  return (
    <div className="w-full space-y-5">
      {revealed && (
        <section className={`${surface} ${borderColor} rounded-2xl p-4 sm:p-5 flex items-center gap-4 transition-colors duration-500`}>
          {photo ?? (
            <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-500 shrink-0">
              <UserRound className="w-9 h-9" aria-hidden="true" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {flag && (
                <span
                  role="img"
                  aria-label={`${player.nationality} flag`}
                  data-testid="nationality-flag"
                  className="text-xl shrink-0"
                >
                  {flag}
                </span>
              )}
              <p className="text-xl font-bold leading-tight break-words min-w-0">{player.name}</p>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {player.nationality || "Unknown"} · Age {age ?? "Unknown"} · {player.position || "Unknown"}
            </p>
          </div>
        </section>
      )}

      <section
        className={`${surface} ${borderColor} ${isLegacy ? "" : "shadow-stadium"} relative rounded-2xl p-4 sm:p-6 transition-colors duration-500`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-2">
            <Route className={`w-5 h-5 ${isLegacy ? "text-gold-400" : "text-pitch-400"}`} aria-hidden="true" />
            <p className="text-lg font-bold text-white">Club History</p>
          </div>

          {isLegacy && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400">
              <Crown className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Legacy Player</span>
              <div className="relative group">
                <button
                  type="button"
                  aria-label="This player is potentially retired"
                  className="flex text-gold-400/70 hover:text-gold-300 focus:outline-none focus-visible:text-gold-300"
                >
                  <Info className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <div className="absolute bottom-full right-0 mb-2 w-48 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center z-20">
                  This player is potentially retired — no current team in their career data.
                </div>
              </div>
            </div>
          )}
        </div>

        <ol
          className={`grid gap-2.5 sm:gap-3 ${
            hideClubs ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}
        >
          {clubs.map((club, i) => (
            <ClubTile key={`${club.teamId}-${i}`} club={club} hidden={hideClubs} />
          ))}
        </ol>
      </section>

      {!revealed && (
        <section aria-label="Hints" className="space-y-2">
          <h3 className={`${SECTION_LABEL} px-1`}>Hints (one per missed guess)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HintCard step={1} label="Nationality" value={hints.nationality ? player.nationality || "Unknown" : null} />
            <HintCard step={2} label="Age" value={hints.age ? (age ? String(age) : "Unknown") : null} />
            <HintCard step={3} label="Position" value={hints.position ? player.position || "Unknown" : null} />
            <HintCard
              step={4}
              label="Photo"
              value={hints.photo ? photo ?? <span className="text-xs text-slate-400">No photo</span> : null}
            />
          </div>
        </section>
      )}

      {!revealed && onGuess && (
        // Sticky to the viewport bottom while the card runs past the fold; settles under the hints at the end.
        // No ancestor may set overflow, or sticky stops working.
        <div
          data-testid="guess-bar"
          className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-900/75 backdrop-blur-lg border-t border-slate-800 shadow-[0_-8px_32px_rgba(0,0,0,0.37)] lg:rounded-t-2xl lg:border-x"
        >
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <PlayerSearch
                onSelect={onGuess}
                disabledPlayerIds={disabledPlayerIds}
                placeholder={hints.initials
                  ? player.name.split(" ").map((part) => part[0] + ".".repeat(part.length - 1)).join(" ")
                  : "Player name"}
              />
            </div>
            {onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-3.5 glass-card border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-bold rounded-xl transition-colors shrink-0 inline-flex items-center gap-1.5"
                title={`Skip and reveal hint (${(attempts ?? 0) + 1}/${maxAttempts ?? 5})`}
              >
                <SkipForward className="w-4 h-4" aria-hidden="true" />
                Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
