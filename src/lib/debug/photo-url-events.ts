export function logPlacePhotoImageError(args: {
  source: string;
  googlePlaceId?: string | null;
  placeName?: string | null;
  image: HTMLImageElement;
}): void {
  const googlePlaceId = typeof args.googlePlaceId === "string" ? args.googlePlaceId.trim() : "";
  const placeName = typeof args.placeName === "string" ? args.placeName.trim() : "";

  console.warn("[PHOTO-URL] img error", {
    source: args.source,
    googlePlaceId: googlePlaceId || null,
    placeName: placeName || null,
    src: args.image.src,
    currentSrc: args.image.currentSrc,
    complete: args.image.complete,
    naturalWidth: args.image.naturalWidth,
    naturalHeight: args.image.naturalHeight,
  });
}
