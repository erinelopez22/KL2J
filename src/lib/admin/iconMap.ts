import {
  Compass,
  MapPin,
  ShieldCheck,
  Ruler,
  Landmark,
  Building2,
  Mountain,
  Layers,
  Split,
  Combine,
  FileCheck2,
  BadgeCheck,
  Award,
  type LucideIcon,
} from "lucide-react";

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  Compass,
  MapPin,
  ShieldCheck,
  Ruler,
  Landmark,
  Building2,
  Mountain,
  Layers,
  Split,
  Combine,
  FileCheck2,
  BadgeCheck,
  Award,
};

export const SERVICE_ICON_NAMES = Object.keys(SERVICE_ICONS);

export function getServiceIcon(name: string): LucideIcon {
  return SERVICE_ICONS[name] ?? Compass;
}
