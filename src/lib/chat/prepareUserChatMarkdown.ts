export function prepareUserChatMarkdown(text: string): string {
  return text.replace(/\r\n/g, "\n");
}
