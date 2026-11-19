export type SearchResultCardProps = {
  name: string;
  category: string;
  reviewSummary?: string | null;
  rating: number | null;
  userRatingCount?: number | null;
  isOpen?: boolean | null;
  image?: string;
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
  googlePlaceId?: string;
  location?: { lat: number; lng: number };
  fromBookmark?: boolean;
  bookmarkCategoryColor?: string;
};
