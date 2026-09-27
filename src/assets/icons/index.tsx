import CalendarAddSvg from "@/assets/icons/calendar-add.svg";
import ChatSvg from "@/assets/icons/chat.svg";
import ChevronLeftSvg from "@/assets/icons/chevron-left.svg";
import CircleCancelSvg from "@/assets/icons/circle-cancel.svg";
import CloseSvg from "@/assets/icons/close.svg";
import LocationErrorSvg from "@/assets/icons/location-error.svg";
import LocationSvg from "@/assets/icons/location.svg";
import ReactionStarSvg from "@/assets/icons/reaction-star.svg";
import SavedSvg from "@/assets/icons/saved.svg";
import SearchSvg from "@/assets/icons/search.svg";
import ShareSvg from "@/assets/icons/share.svg";

import { createIcon } from "./create-icon";

export type { IconProps } from "./create-icon";

export const CalendarAddIcon = createIcon(CalendarAddSvg, "CalendarAddIcon");
export const ChatIcon = createIcon(ChatSvg, "ChatIcon");
export const ChevronLeftIcon = createIcon(ChevronLeftSvg, "ChevronLeftIcon");
export const CircleCancelIcon = createIcon(CircleCancelSvg, "CircleCancelIcon");
export const CloseIcon = createIcon(CloseSvg, "CloseIcon");
export const LocationErrorIcon = createIcon(LocationErrorSvg, "LocationErrorIcon");
export const LocationIcon = createIcon(LocationSvg, "LocationIcon");
export const ReactionStarIcon = createIcon(ReactionStarSvg, "ReactionStarIcon");
export const SavedIcon = createIcon(SavedSvg, "SavedIcon");
export const SearchIcon = createIcon(SearchSvg, "SearchIcon");
export const ShareIcon = createIcon(ShareSvg, "ShareIcon");
