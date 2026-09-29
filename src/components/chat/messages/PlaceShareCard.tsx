"use client";

import { OgPlacePreviewCard } from "@/components/chat/messages/OgPlacePreviewCard";
import { useOpenPlaceOnMap } from "@/hooks/useOpenPlaceOnMap";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSessionUser } from "@/hooks/useSessionUser";
import { placePhotoUrlQueryKey } from "@/lib/place-photo-query";
import { getQueryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { chatMessageChrome } from "@/components/chat/chat-message-chrome";
import { resolveChatMessageTypography } from "@/components/chat/chat-typography";
import type { ChatMessage } from "@/types/chat";
import { ChatMemberAvatarRing } from "@/components/chat/messages/ChatMemberAvatarRing";

export function PlaceShareCard({
  message,
  isMinimized = false,
}: {
  message: ChatMessage;
  isMinimized?: boolean;
}) {
  const typo = resolveChatMessageTypography(isMinimized);
  const place = message.place;
  const { data: sessionUser } = useSessionUser();
  const myId = sessionUser?.id;
  const openPlaceOnMap = useOpenPlaceOnMap();
  const setMapCenter = useMapCenterStore((s) => s.setMapCenter);

  const senderUserId = message.senderUserId;
  const isMine = myId != null && senderUserId != null && senderUserId === myId;

  const imageUrl = place?.googlePlaceId
    ? getQueryClient()?.getQueryData<string>(
        placePhotoUrlQueryKey(place.googlePlaceId),
      )
    : undefined;

  if (!place) return null;
  const p = place;

  function handleClick() {
    setMapCenter({ lat: p.latitude, lng: p.longitude });
    openPlaceOnMap(
      {
        name: p.name,
        category: "",
        rating: p.rating || null,
        address: p.formattedAddress,
        googlePlaceId: p.googlePlaceId,
        location: { lat: p.latitude, lng: p.longitude },
        image: imageUrl,
      },
      { analyticsSource: "chat" },
    );
  }

  const cardButton = (
    <OgPlacePreviewCard
      name={p.name}
      formattedAddress={p.formattedAddress}
      googlePlaceId={p.googlePlaceId}
      rating={p.rating}
      isMinimized={isMinimized}
      onClick={handleClick}
    />
  );

  const timeRow =
    message.time != null ? (
      <span className={typo.metaMuted}>{message.time}</span>
    ) : null;

  if (isMine) {
    return (
      <div className="flex flex-col items-end gap-1 -mr-1">
        {cardButton}
        {timeRow}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center gap-1">
        <ChatMemberAvatarRing
          chromeAvatarClassName={chatMessageChrome.avatarSm}
          avatarUrl={message.avatar}
          alt={message.sender ?? ""}
          senderNotInRoom={message.senderNotInRoom}
          reduceMotion
        />
        <span
          className={cn("max-w-[4rem] truncate text-center", typo.metaMuted)}
        >
          {message.sender}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        {cardButton}
        {timeRow}
      </div>
    </div>
  );
}
