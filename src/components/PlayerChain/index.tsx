import { Link2 } from "lucide-react";
import type { PlayerChainProps } from "./types";

export default function PlayerChain({ chain, compact }: PlayerChainProps) {
  return (
    <ol className={`flex flex-wrap items-center gap-2 ${compact ? "justify-center" : ""}`}>
      {chain.map((p, i) => (
        <li key={`${p.id}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-600 text-xs" aria-hidden="true">→</span>}
          <span className={`rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400 flex items-center gap-2 ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5"}`}>
            <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <span className={`block font-bold ${compact ? "" : "text-xs sm:text-sm"}`}>{p.name}</span>
              {!compact && p.nationality && <span className="block text-slate-400 text-[10px]">{p.nationality}</span>}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
