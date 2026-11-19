import { TravelCarIcon, TravelTrainIcon, TravelWalkIcon } from "@/assets/icons";

export function TravelModeGlyph({ mode }: { mode: string }) {
  const key = mode.trim().toUpperCase();
  if (key.includes("WALK") || key === "WALKING") return <TravelWalkIcon size={16} className="shrink-0 text-primary" />;
  if (key.includes("DRIVE") || key.includes("CAR") || key === "DRIVING")
    return <TravelCarIcon size={16} className="shrink-0 text-primary" />;
  if (key.includes("TRANSIT") || key.includes("BUS") || key.includes("SUBWAY"))
    return <TravelTrainIcon size={16} className="shrink-0 text-primary" />;
  return null;
}
