import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly (Home, and Guess without its Archive). */
  end?: boolean;
  /** Show the DAILY chip. */
  daily?: boolean;
  iconClass?: string;
}
