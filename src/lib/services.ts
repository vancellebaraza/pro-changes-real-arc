import { Zap, Droplets, Trees, Paintbrush, Home, Container } from "lucide-react";

export type ServiceKey =
  | "electrical"
  | "plumbing"
  | "landscaping"
  | "painting"
  | "property_management"
  | "tank_cleaning";

export const SERVICES: Array<{ key: ServiceKey; label: string; icon: typeof Zap; desc: string }> = [
  { key: "electrical", label: "Electrical", icon: Zap, desc: "Wiring, lighting, faults, certified installations." },
  { key: "plumbing", label: "Plumbing", icon: Droplets, desc: "Leaks, fittings, pressure issues, full installs." },
  { key: "landscaping", label: "Landscaping", icon: Trees, desc: "Gardens, irrigation, hardscaping, upkeep." },
  { key: "painting", label: "Painting", icon: Paintbrush, desc: "Interior & exterior, surface prep, finishing." },
  { key: "property_management", label: "Property Management", icon: Home, desc: "Ongoing facility care across portfolios." },
  { key: "tank_cleaning", label: "Tank Cleaning", icon: Container, desc: "Potable water tanks, disinfection, reports." },
];

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  inspected: "Inspected",
  quoted: "Quoted",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};
