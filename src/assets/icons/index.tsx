import CalendarAddSvg from "@/assets/icons/calendar-add.svg";
import ChatSvg from "@/assets/icons/chat.svg";
import ChevronLeftSvg from "@/assets/icons/chevron-left.svg";
import CloseSvg from "@/assets/icons/close.svg";
import ReactionStarSvg from "@/assets/icons/reaction-star.svg";
import SavedSvg from "@/assets/icons/saved.svg";
import ShareSvg from "@/assets/icons/share.svg";

import { createIcon } from "./create-icon";

export type { IconProps } from "./create-icon";

export const CalendarAddIcon = createIcon(CalendarAddSvg, "CalendarAddIcon");
export const ChatIcon = createIcon(ChatSvg, "ChatIcon");
export const ChevronLeftIcon = createIcon(ChevronLeftSvg, "ChevronLeftIcon");
export const CloseIcon = createIcon(CloseSvg, "CloseIcon");
export const ReactionStarIcon = createIcon(ReactionStarSvg, "ReactionStarIcon");
export const SavedIcon = createIcon(SavedSvg, "SavedIcon");
export const ShareIcon = createIcon(ShareSvg, "ShareIcon");
