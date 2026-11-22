import { z } from "zod";

export const BOOKMARK_FOLDER_TITLE_MAX_LENGTH = 50;
export const BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE =
  `제목은 ${BOOKMARK_FOLDER_TITLE_MAX_LENGTH}자까지 쓸 수 있어요.` as const;

export const bookmarkFolderTitleSchema = z
  .string()
  .max(BOOKMARK_FOLDER_TITLE_MAX_LENGTH, BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE)
  .trim();

export const bookmarkFolderFormSchema = z.object({
  title: bookmarkFolderTitleSchema,
  color: z.string(),
});
