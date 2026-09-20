import { SHARE_IMAGE } from "@/lib/public-site-metadata";

export const inviteShareMetadata = {
  title: "우때 여행 초대",
  description:
    "우때에서 함께 여행 계획을 세워요. 초대 링크를 눌러 참여해보세요.",
  imagePath: SHARE_IMAGE.url,
  imageWidth: SHARE_IMAGE.width,
  imageHeight: SHARE_IMAGE.height,
} as const;
