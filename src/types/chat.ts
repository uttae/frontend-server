export type ChatMessageType = "other" | "mine" | "system" | "ai" | "place";

export type AiRequestStatus = "QUEUED" | "PROCESSING" | "CANCELED";

export interface PlaceShareData {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  rating: number;
}

export interface AiRecommendedPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  reason?: string;
  googleMapsUri?: string;
}

export interface AiConversationSummarySection {
  type: string;
  title: string;
  items: string[];
}

export interface AiConversationSummaryPayload {
  title: string;
  overview: string;
  sections?: AiConversationSummarySection[];
}

export interface AiPlaceRecommendationHeading {
  title?: string;
  subtitle?: string;
}

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  sender?: string;
  text: string;
  time?: string;
  avatar?: string;
  senderNotInRoom?: boolean;
  senderUserId?: number;
  place?: PlaceShareData;
  isAiRequest?: boolean;
  aiRequest?: {
    requestMessageId: string;
    aiStatus?: AiRequestStatus;
    cancelable: boolean;
    canceledBy?: number;
  };
  aiRepliesTo?: {
    requestMessageId: string;
    quotePreview: string;
  };
  aiIntent?: string;
  aiRecommendedPlaces?: AiRecommendedPlace[];
  aiPlaceRecommendationHeading?: AiPlaceRecommendationHeading;
  aiConversationSummary?: AiConversationSummaryPayload;
}

export type ServerChatMessageType = "CHAT" | "AI_REQUEST" | "AI_RESPONSE" | "PLACE_SHARE" | "SYSTEM" | "AI";

export interface ServerChatMessage {
  id: string;
  roomId: string;
  senderId: number;
  messageType: ServerChatMessageType;
  content?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  clientMessageId?: string;
  sequence?: number;
}
