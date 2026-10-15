import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

describe("채팅 전용 스크롤 영역", () => {
  it("채팅 메시지 스크롤 영역도 gutter를 안정적으로 유지한다", () => {
    expect(globalStyles).toMatch(
      /\.chat-message-list-scroll\s*\{[^}]*scrollbar-gutter:\s*stable;/,
    );
  });
});
