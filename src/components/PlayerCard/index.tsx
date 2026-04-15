import PlayerSearch from "../PlayerSearch";
import type { PlayerCardProps } from "./types";

function BadgeImg({ src, alt, size }: { src: string; alt: string; size: "sm" | "lg" }) {
  const imgClass = size === "lg" ? "w-16 h-16 object-contain" : "w-8 h-8 object-contain";
  const fallbackClass = size === "lg"
    ? "w-16 h-16 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-300 text-center p-1 leading-tight"
    : "w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-[0.5rem] text-gray-300 text-center p-0.5 leading-tight";

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

function HiddenField({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="bg-gray-700 rounded px-3 py-0.5 text-gray-600 text-sm select-none">???</span>
    </div>
  );
}

function RevealedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0 animate-[fadeIn_0.4s_ease-in]">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}

export default function PlayerCard({ player, clubs, hints, revealed, hardMode, result, onGuess }: PlayerCardProps) {
  const age = player.dateBorn ? new Date().getFullYear() - parseInt(player.dateBorn, 10) : null;

  // A player is considered "legacy" (potentially retired) if all their clubs have a departure year.
  // The is_legacy DB field overrides auto-detection when set.
  const autoLegacy = clubs.length > 0 && clubs.every((c) => c.yearDeparted);
  const isLegacy = player.isLegacy != null ? player.isLegacy : autoLegacy;

  const borderColor = result === "won" ? "border-green-600" : result === "lost" ? "border-red-600" : isLegacy ? "border-amber-700/60" : "border-gray-600";

  return (
    <div className={`${isLegacy ? "bg-gray-800/90" : "bg-gray-800"} border-2 ${borderColor} rounded-2xl overflow-visible max-w-md w-full transition-colors duration-500 relative`}>
      {/* Legacy badge */}
      {isLegacy && (
        <div className="absolute -top-3 right-4 flex items-center gap-1.5 bg-amber-900/80 border border-amber-700/60 rounded-full px-3 py-1 z-10">
          <span className="text-amber-300 text-xs font-medium">Legacy Player</span>
          <div className="relative group">
            <button
              type="button"
              aria-label="This player is potentially retired"
              className="text-amber-400/70 hover:text-amber-300 text-xs select-none focus:outline-none"
            >
              &#9432;
            </button>
            <div className="absolute bottom-full right-0 mb-2 w-48 px-3 py-2 bg-gray-700 text-gray-200 text-xs rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center z-20">
              This player is potentially retired — no current team in their career data.
              <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-700" />
            </div>
          </div>
        </div>
      )}

      {/* Player identity header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-4 border-b border-gray-700">
        {(revealed || hints.photo) && player.thumbnail ? (
          <img
            src={player.thumbnail}
            alt={revealed ? player.name : ""}
            className={`w-20 h-20 rounded-full object-cover bg-gray-700 border-2 shrink-0 ${isLegacy ? "border-amber-700/50 sepia-[.3]" : "border-gray-600"}`}
          />
        ) : (
          <div className={`w-20 h-20 rounded-full bg-gray-700 border-2 flex items-center justify-center text-3xl text-gray-500 select-none shrink-0 ${isLegacy ? "border-amber-700/50" : "border-gray-600"}`}>
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          {revealed ? (
            <p className="text-xl font-bold truncate">{player.name}</p>
          ) : onGuess ? (
            <PlayerSearch
              onSelect={onGuess}
              placeholder={hints.initials
                ? player.name.split(" ").map((part) => part[0] + ".".repeat(part.length - 1)).join(" ")
                : "Player name"}
            />
          ) : (
            <>
              <div className="h-6 bg-gray-700 rounded w-40 mb-2" />
              <div className="h-4 bg-gray-700 rounded w-24" />
            </>
          )}
        </div>
      </div>

      {/* Stats fields */}
      <div className="px-6 py-3">
        {hints.nationality || revealed
          ? <RevealedField label="Nationality" value={player.nationality || "Unknown"} />
          : <HiddenField label="Nationality" />
        }
        {hints.age || revealed
          ? <RevealedField label="Age" value={age ? String(age) : "Unknown"} />
          : <HiddenField label="Age" />
        }
        {hints.position || revealed
          ? <RevealedField label="Position" value={player.position || "Unknown"} />
          : <HiddenField label="Position" />
        }
      </div>

      {/* Club history */}
      <div className="px-6 pb-5 pt-2">
        <p className={`text-xs uppercase tracking-wider mb-3 ${isLegacy ? "text-amber-600/80" : "text-gray-500"}`}>Club History</p>
        {hardMode && !revealed ? (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {clubs.map((club, i) => (
              <div key={`${club.teamId}-${i}`} className="flex items-center">
                {i > 0 && <span className="text-gray-500 text-lg mx-1">→</span>}
                <div className={`rounded-lg p-1 border ${club.isLoan ? "border-dashed border-gray-500" : "border-transparent"}`}>
                  <BadgeImg src={club.badge} alt={club.teamName} size="lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {clubs.map((club, i) => (
              <div key={`${club.teamId}-${i}`}>
                {i > 0 && <div className="text-gray-500 text-center text-sm">↓</div>}
                <div className={`flex items-center gap-3 rounded-lg px-4 py-2 border ${club.isLoan ? "bg-gray-700/60 border-dashed border-gray-500" : "bg-gray-700 border-transparent"}`}>
                  <BadgeImg src={club.badge} alt={club.teamName} size="sm" />
                  <span className="font-medium text-sm">{club.teamName}</span>
                  {club.isLoan && (
                    <span className="text-gray-400 text-xs px-1.5 py-0.5 rounded-full bg-gray-600/50">loan</span>
                  )}
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full ml-auto whitespace-nowrap">
                    {club.yearJoined}{club.yearDeparted ? ` – ${club.yearDeparted}` : " – present"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
