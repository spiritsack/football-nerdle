import { CalendarDays, Flame, House, UserRound } from "lucide-react";
import type { NavItem } from "./types";

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/guess", label: "Guess Player", icon: UserRound, end: true, daily: true },
  { to: "/battle", label: "Battle Mode", icon: Flame, iconClass: "text-gold-500" },
  { to: "/guess/archive", label: "Archive", icon: CalendarDays },
];
