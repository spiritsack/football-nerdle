import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  accent?: "pitch" | "gold";
  children?: ReactNode;
}
