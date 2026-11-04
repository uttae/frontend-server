// NEXT_PUBLIC values are fixed at build time; an omitted flag preserves AI access.
export const CHAT_AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED !== "false";
