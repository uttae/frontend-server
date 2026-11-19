export function pickProfileImageUrl(
  raw: Record<string, unknown>,
): string | null {
  const keys = [
    "profileImageUrl",
    "profile_image_url",
    "photoURL",
    "photoUrl",
    "photo_url",
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}
