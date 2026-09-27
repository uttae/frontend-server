// Changing this list can assign different covers to existing rooms.
const ROOM_COVERS = [
  "/rooms/covers/desert-road.webp",
  "/rooms/covers/airplane-window.webp",
  "/rooms/covers/road-map.webp",
  "/rooms/covers/seaplane-island.webp",
  "/rooms/covers/rome-map-planning.webp",
  "/rooms/covers/travel-camera-map.webp",
  "/rooms/covers/passport-world-map.webp",
  "/rooms/covers/packed-suitcase.webp",
  "/rooms/covers/beach-reading.webp",
] as const;

export function roomCoverForId(roomId: string): string {
  let hash = 2166136261;

  for (let index = 0; index < roomId.length; index += 1) {
    hash = Math.imul(hash ^ roomId.charCodeAt(index), 16777619);
  }

  return ROOM_COVERS[(hash >>> 0) % ROOM_COVERS.length];
}
