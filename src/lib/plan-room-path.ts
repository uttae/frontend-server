export function roomIdFromPlanPathname(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "plan") return null;
  const id = decodeURIComponent(parts[1] ?? "").trim();
  return id.length > 0 ? id : null;
}
