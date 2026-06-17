import logo from "@/assets/fusionpro-logo.asset.json";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo.url} alt="FusionPro" className={className} />;
}
