import { Zap, Droplets, Trees, Paintbrush, Home, Container } from "lucide-react";
import svcElectrical from "@/assets/svc-electrical.jpg";
import svcPlumbing from "@/assets/svc-plumbing.jpg";
import svcLandscaping from "@/assets/svc-landscaping.jpg";
import svcPainting from "@/assets/svc-painting.jpg";
import svcProperty from "@/assets/svc-property.jpg";
import svcTank from "@/assets/svc-tank.jpg";

export type ServiceKey =
  | "electrical"
  | "plumbing"
  | "landscaping"
  | "painting"
  | "property_management"
  | "tank_cleaning";

export const SERVICES: Array<{ key: ServiceKey; label: string; icon: typeof Zap; desc: string; image: string }> = [
  { key: "electrical", label: "Electrical", icon: Zap, desc: "Wiring, lighting, faults, certified installations.", image: svcElectrical },
  { key: "plumbing", label: "Plumbing", icon: Droplets, desc: "Leaks, fittings, pressure issues, full installs.", image: svcPlumbing },
  { key: "landscaping", label: "Landscaping", icon: Trees, desc: "Gardens, irrigation, hardscaping, upkeep.", image: svcLandscaping },
  { key: "painting", label: "Painting", icon: Paintbrush, desc: "Interior & exterior, surface prep, finishing.", image: svcPainting },
  { key: "property_management", label: "Property Management", icon: Home, desc: "Ongoing facility care across portfolios.", image: svcProperty },
  { key: "tank_cleaning", label: "Tank Cleaning", icon: Container, desc: "Potable water tanks, disinfection, reports.", image: svcTank },
];

export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  admin_approved: "Admin Approved",
  inspected: "Inspected",
  quoted: "Quoted",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

export const BANK_DETAILS = {
  bank: "KCB",
  account_name: "Fusionpro Limited",
  branch: "KCB Gigiri Square Branch",
  bank_code: "323",
  account_number: "1351118463",
  swift_code: "KCBLKENX",
};
