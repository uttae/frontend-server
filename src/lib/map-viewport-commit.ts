import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { viewportSearchRadiusMetersFromBounds } from "@/lib/maps";
import { useMapCenterStore } from "@/stores/map-center-store";
import {
  useSearchRecenterStore,
  type DiscoverMapSnapshot,
  type SearchMapSnapshot,
} from "@/stores/search-recenter-store";

export function buildSearchMapSnapshotFromMapCenterStore(): SearchMapSnapshot | null {
  const { mapCenter, zoom, radiusMeters } = useMapCenterStore.getState();
  if (!mapCenter) return null;
  const radius =
    radiusMeters != null && Number.isFinite(radiusMeters) ? clampPlacesSearchRadiusMeters(radiusMeters) : undefined;

  return {
    center: mapCenter,
    zoom: zoom ?? null,
    radius: radius ?? clampPlacesSearchRadiusMeters(5000),
  };
}

export function settleSearchSnapshotAfterMove(map: Pick<google.maps.Map, "getDiv" | "addListener">): () => void {
  const div = map.getDiv();
  const cancel = () => {
    idle.remove();
    div.removeEventListener("pointerdown", cancel, true);
    div.removeEventListener("wheel", cancel, true);
  };
  const idle = map.addListener("idle", () => {
    cancel();
    const camera = buildSearchMapSnapshotFromMapCenterStore();
    const { searchSnapshot, setSearchSnapshot } = useSearchRecenterStore.getState();
    if (camera && searchSnapshot) setSearchSnapshot(camera);
  });
  div.addEventListener("pointerdown", cancel, true);
  div.addEventListener("wheel", cancel, { capture: true, passive: true });
  return cancel;
}

export function buildDiscoverSnapshotFromGoogleMap(map: google.maps.Map): DiscoverMapSnapshot | null {
  const bounds = map.getBounds();
  if (!bounds) return null;

  const boundsLiteral = bounds.toJSON();
  const center = bounds.getCenter().toJSON();
  const radius = viewportSearchRadiusMetersFromBounds(center, boundsLiteral);

  const zoomRaw = map.getZoom();
  const zoom = typeof zoomRaw === "number" ? zoomRaw : null;

  return {
    bounds: boundsLiteral,
    center,
    zoom,
    radius: clampPlacesSearchRadiusMeters(radius),
  };
}

export function boundsInstanceFromDiscoverSnapshot(b: google.maps.LatLngBoundsLiteral): google.maps.LatLngBounds {
  return new google.maps.LatLngBounds({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east });
}
