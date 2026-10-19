// Shared class strings for the player-facing design. Colours and fonts are
// theme tokens in index.css (pitch, gold, night, font-body, font-display).

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const BTN_PRIMARY = `${BTN_BASE} bg-pitch-500 hover:bg-pitch-600 text-slate-950 shadow-lg shadow-pitch-500/25 hover:-translate-y-0.5`;
export const BTN_GOLD = `${BTN_BASE} bg-gold-500 hover:bg-gold-600 text-slate-950 shadow-lg shadow-gold-500/20 hover:-translate-y-0.5`;
export const BTN_SECONDARY = `${BTN_BASE} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`;

export const BTN_MD = "px-5 py-2.5 text-sm";
export const BTN_LG = "px-6 py-3.5 text-sm";

export const PANEL = "glass-panel rounded-2xl border-slate-800";
export const SECTION_LABEL = "text-xs font-bold uppercase tracking-wider text-slate-400";

export const ALERT_WARN =
  "bg-orange-500/10 border border-orange-500/40 rounded-xl px-4 py-3 text-center text-orange-300 text-sm";

export const BACK_LINK = "inline-flex items-center gap-1 text-pitch-400 hover:text-pitch-300 text-sm font-semibold";
