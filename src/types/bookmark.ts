export type BookmarkedPlace = {
  id: string;
  name: string;
  address: string;
  primaryTypeDisplayName?: string;
  googlePlaceId: string;
  location?: { lat: number; lng: number };
};

export type BookmarkFolder = {
  id: string;
  title: string;
  color: string;
  placeCount?: number;
};
