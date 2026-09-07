import { Bike, Bus, Car, Footprints } from "lucide-react";

export function TravelModeGlyph({ mode }: { mode: string }) {
  const key = mode.trim().toUpperCase();
  if (key.includes("WALK") || key === "WALKING")
    return <Footprints className="h-4 w-4 shrink-0 text-primary" />;
  if (
    key.includes("DRIVE") ||
    key.includes("CAR") ||
    key === "DRIVING"
  )
    return <Car className="h-4 w-4 shrink-0 text-primary" />;
  if (key.includes("TRANSIT") || key.includes("BUS") || key.includes("SUBWAY"))
    return <Bus className="h-4 w-4 shrink-0 text-primary" />;
  if (key.includes("CYCL") || key === "CYCLING" || key.includes("BICY"))
    return <Bike className="h-4 w-4 shrink-0 text-primary" />;
  return <Footprints className="h-4 w-4 shrink-0 text-primary" />;
}
