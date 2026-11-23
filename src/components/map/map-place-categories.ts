import type { ComponentType } from "react";

import {
  TravelHotelIcon,
  TravelMuseumIcon,
  TravelRestaurantIcon,
  TravelThemeparkIcon,
  TravelTrainIcon,
  type IconProps,
} from "@/assets/icons";

export type MapPlaceCategory = {
  id: string;
  label: string;
  searchQuery: string;
  icon: ComponentType<IconProps>;
  googlePlaceTypeHint: string;
};

export const MAP_PLACE_CATEGORIES: MapPlaceCategory[] = [
  {
    id: "restaurant",
    label: "음식점",
    searchQuery: "음식점",
    icon: TravelRestaurantIcon,
    googlePlaceTypeHint: "restaurant",
  },
  {
    id: "lodging",
    label: "호텔",
    searchQuery: "호텔",
    icon: TravelHotelIcon,
    googlePlaceTypeHint: "lodging",
  },
  {
    id: "things_to_do",
    label: "즐길거리",
    searchQuery: "관광명소 즐길거리",
    icon: TravelThemeparkIcon,
    googlePlaceTypeHint: "tourist_attraction",
  },
  {
    id: "museum",
    label: "박물관",
    searchQuery: "박물관",
    icon: TravelMuseumIcon,
    googlePlaceTypeHint: "museum",
  },
  {
    id: "transit",
    label: "대중교통",
    searchQuery: "지하철역 버스정류장",
    icon: TravelTrainIcon,
    googlePlaceTypeHint: "transit_station",
  },
];
