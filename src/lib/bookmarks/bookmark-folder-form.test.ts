import { describe, expect, it } from "vitest";

import {
  BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE,
  bookmarkFolderFormSchema,
  bookmarkFolderTitleSchema,
} from "./bookmark-folder-form";

describe("bookmarkFolderFormSchema", () => {
  it("allows an empty title and trims the title for save", () => {
    expect(bookmarkFolderFormSchema.parse({ title: "", color: "#EAB308" })).toEqual({ title: "", color: "#EAB308" });
    expect(bookmarkFolderFormSchema.parse({ title: "  맛집  ", color: "#EAB308" })).toEqual({
      title: "맛집",
      color: "#EAB308",
    });
  });

  it("checks the typed length before trimming and puts the issue on title", () => {
    const result = bookmarkFolderFormSchema.safeParse({ title: `${"가".repeat(50)} `, color: "#EAB308" });
    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ["title"], message: BOOKMARK_FOLDER_TITLE_TOO_LONG_MESSAGE },
    ]);
    expect(bookmarkFolderTitleSchema.safeParse("가".repeat(50)).success).toBe(true);
  });
});
