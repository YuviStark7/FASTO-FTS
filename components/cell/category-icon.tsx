import {
  Amphora, Bean, CakeSlice, Candy, Carrot, Cheese, CircleHelp, Coffee, Croissant, CupSoda,
  Droplet, FlaskConical, Ham, Hexagon, Sprout, UtensilsCrossed, type LucideIcon,
} from "lucide-react";

// Icon names are stored on categories.icon; this map keeps the bundle to the icons we use.
const ICONS: Record<string, LucideIcon> = {
  Amphora, Bean, CakeSlice, Candy, Carrot, Cheese, Coffee, Croissant, CupSoda,
  Droplet, FlaskConical, Ham, Hexagon, Sprout, UtensilsCrossed,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleHelp;
  return <Icon aria-hidden className={className} />;
}
