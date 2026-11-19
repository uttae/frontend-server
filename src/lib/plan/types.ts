export type PlanPlace = {
  id: string;
  title: string;
  subtitle?: string;
  primaryTypeDisplayName?: string;
  imageUrl?: string;
  itemId?: number;
  googlePlaceId?: string;
  location?: { lat: number; lng: number };
  startTime?: string | null;
  endTime?: string | null;
  travelMode?: string;
  memo?: string;
};

export type PlanDayData = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  shortDateLabel: string;
  places: PlanPlace[];
};
