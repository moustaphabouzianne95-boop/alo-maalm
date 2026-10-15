import {
  AirVent,
  BrickWall,
  Briefcase,
  Camera,
  Car,
  ChefHat,
  Droplets,
  Flower2,
  GraduationCap,
  Hammer,
  KeyRound,
  MonitorSmartphone,
  Paintbrush,
  PartyPopper,
  Scissors,
  Shirt,
  Sparkles,
  Square,
  Truck,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Category icons are stored in the database as lucide names (`Category.icon`)
 * and are part of the API contract, so they are never translated. The map is
 * static on purpose: a dynamic `lucide-react[name]` lookup would pull the whole
 * icon set into the client bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  AirVent,
  BrickWall,
  Camera,
  Car,
  ChefHat,
  Droplets,
  Flower2,
  GraduationCap,
  Hammer,
  KeyRound,
  MonitorSmartphone,
  Paintbrush,
  PartyPopper,
  Scissors,
  Shirt,
  Sparkles,
  Square,
  Truck,
  WashingMachine,
  Zap,
  Wrench,
};

export function categoryIcon(name?: string | null): LucideIcon {
  return (name && ICONS[name]) || Briefcase;
}

export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = categoryIcon(name);
  return <Icon className={cn("h-5 w-5", className)} aria-hidden />;
}
