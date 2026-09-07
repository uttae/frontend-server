/** 장소 카드 / 선택 컨텍스트 공통 props — UI 컴포넌트와 타입 모듈 순환 방지 */
export type SearchResultCardProps = {
  name: string;
  /** 사람이 읽기 좋은 장소 유형 (e.g. "음식점") */
  category: string;
  /** AI 생성 리뷰 요약 */
  reviewSummary?: string | null;
  rating: number | null;
  userRatingCount?: number | null;
  isOpen?: boolean | null;
  /** Single preview image URL from /places/photos */
  image?: string;
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
  /** Google Places resource id when resolved from API */
  googlePlaceId?: string;
  /** Coordinates – present for real API results, used to pan the map */
  location?: { lat: number; lng: number };
  /** 북마크 목록에서 연 경우 지도 핀 색(북마크 제외 개인 핀은 primary) */
  fromBookmark?: boolean;
  /** 북마크 카테고리 맵 핀 색(hex). 있으면 선택 핀 확대 시 같은 색 유지 */
  bookmarkCategoryColor?: string;
};
