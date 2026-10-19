import { UserRound } from "lucide-react";
import type { CurrentLinkCardProps } from "./types";

export default function CurrentLinkCard({ player, sharedClubs }: CurrentLinkCardProps) {
  return (
    <div className="w-full max-w-md p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-gold-500/30 shadow-xl text-left space-y-3">
      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center">Current link</p>
      <div className="flex items-center gap-4">
        {player.thumbnail ? (
          <img
            src={player.thumbnail}
            alt={player.name}
            className="w-16 h-16 rounded-full object-cover bg-slate-700 border-2 border-gold-400 shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-gold-400 flex items-center justify-center text-slate-300 shrink-0">
            <UserRound className="w-7 h-7" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-white leading-tight">{player.name}</h2>
          <p className="text-slate-400 text-sm">{player.nationality}</p>
          {sharedClubs.length > 0 && (
            <p className="text-gold-400 text-xs font-semibold mt-1">
              Linked via: {sharedClubs.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
