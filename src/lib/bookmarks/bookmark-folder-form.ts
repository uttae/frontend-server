import { z } from "zod";

export const BOOKMARK_FOLDER_TITLE_MAX_LENGTH = 50;
export const BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE =
  `제목은 ${BOOKMARK_FOLDER_TITLE_MAX_LENGTH}자까지 쓸 수 있어요.` as const;

/*
 * 북마크 폴더 추가·편집 폼 스키마.
 * 빈 제목은 허용한다(저장하는 쪽이 "제목 없는 북마크 N"을 고른다). maxLength가 있어도 한글 조합 중에는 한 글자 넘게 들어갈 수 있어
 * 제출 때 입력한 그대로의 길이를 본 뒤 trim한다
 */
export const bookmarkFolderTitleSchema = z
  .string()
  .max(BOOKMARK_FOLDER_TITLE_MAX_LENGTH, BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE)
  .trim();

export const bookmarkFolderFormSchema = z.object({
  title: bookmarkFolderTitleSchema,
  color: z.string(),
});
