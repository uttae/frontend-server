import { describe, expect, it } from "vitest";

import type { ServerChatMessage } from "@/types/chat";

import {
  mergeServerMessageLists,
  partitionLiveMessages,
  replaceExistingServerMessages,
  tailCursorOf,
} from "./chat";

function msg(sequence: number | undefined, id = `m${sequence}`): ServerChatMessage {
  return {
    id,
    roomId: "room",
    senderId: 2,
    messageType: "CHAT",
    content: id,
    createdAt: new Date(Date.UTC(2026, 9, 25, 0, 0, sequence ?? 0)).toISOString(),
    ...(sequence != null ? { sequence } : {}),
  };
}

function aiRequest(aiStatus: string): ServerChatMessage {
  return {
    ...msg(50, "ai-50"),
    messageType: "AI_REQUEST",
    metadata: { aiStatus, cancelable: aiStatus === "QUEUED" ? "true" : "false" },
  };
}

const ids = (list: readonly ServerChatMessage[]) => list.map((m) => m.id);

describe("partitionLiveMessages", () => {
  const tail = { atTail: true, list: [msg(39), msg(40)] };

  it("appends only the next sequence and advances the cursor", () => {
    const result = partitionLiveMessages([msg(41), msg(42)], { ...tail, cursor: 40 });
    expect(ids(result.appended)).toEqual(["m41", "m42"]);
    expect(result.cursor).toBe(42);
    expect(result.hasGap).toBe(false);
  });

  it("reports a gap instead of appending past a missing sequence", () => {
    const result = partitionLiveMessages([msg(41), msg(43)], { ...tail, cursor: 40 });
    expect(ids(result.appended)).toEqual(["m41"]);
    expect(result.cursor).toBe(41);
    expect(result.hasGap).toBe(true);
  });

  it("treats sequences up to the cursor as updates of received messages", () => {
    const result = partitionLiveMessages([msg(40)], { ...tail, cursor: 40 });
    expect(result.appended).toEqual([]);
    expect(ids(result.updates)).toEqual(["m40"]);
  });

  it("sorts a buffered batch so out-of-order delivery is not a gap", () => {
    const result = partitionLiveMessages([msg(42), msg(41)], { ...tail, cursor: 40 });
    expect(ids(result.appended)).toEqual(["m41", "m42"]);
    expect(result.hasGap).toBe(false);
  });

  it("does not append in a middle window", () => {
    const result = partitionLiveMessages([msg(41)], { ...tail, atTail: false, cursor: undefined });
    expect(result.appended).toEqual([]);
    expect(ids(result.updates)).toEqual(["m41"]);
  });

  it("starts an empty room at sequence 1", () => {
    const result = partitionLiveMessages([msg(1)], { atTail: true, list: [], cursor: 0 });
    expect(ids(result.appended)).toEqual(["m1"]);
    expect(result.cursor).toBe(1);
  });

  it("falls back to ids for messages without a sequence", () => {
    const legacy = msg(undefined, "legacy");
    const result = partitionLiveMessages([legacy, msg(undefined, "new")], {
      atTail: true,
      list: [legacy],
      cursor: undefined,
    });
    expect(ids(result.updates)).toEqual(["legacy"]);
    expect(ids(result.appended)).toEqual(["new"]);
  });
});

describe("mergeServerMessageLists", () => {
  it("orders by sequence even when timestamps disagree", () => {
    const late = { ...msg(41), createdAt: "2026-10-25T01:00:00Z" };
    expect(ids(mergeServerMessageLists([msg(42)], [late]))).toEqual(["m41", "m42"]);
  });

  it("keeps the later copy of the same message", () => {
    const edited = { ...msg(41), content: "edited" };
    expect(mergeServerMessageLists([msg(41)], [edited])[0]?.content).toBe("edited");
  });

  it("does not put a processed or canceled AI request back into the queue", () => {
    const [kept] = mergeServerMessageLists([aiRequest("CANCELED")], [aiRequest("QUEUED")]);
    expect(kept?.metadata?.aiStatus).toBe("CANCELED");
  });

  it("moves an AI request forward from the queue", () => {
    const [kept] = mergeServerMessageLists([aiRequest("QUEUED")], [aiRequest("PROCESSING")]);
    expect(kept?.metadata?.aiStatus).toBe("PROCESSING");
  });
});

describe("replaceExistingServerMessages", () => {
  it("replaces listed ids and ignores new ones", () => {
    const list = [msg(40), aiRequest("QUEUED")];
    const next = replaceExistingServerMessages(list, [aiRequest("CANCELED"), msg(41)]);
    expect(ids(next)).toEqual(["m40", "ai-50"]);
    expect(next[1]?.metadata?.aiStatus).toBe("CANCELED");
  });

  it("keeps the same list when nothing changes", () => {
    const list = [msg(40)];
    expect(replaceExistingServerMessages(list, [msg(41)])).toBe(list);
  });
});

describe("tailCursorOf", () => {
  it("uses 0 for an empty room so the first message is next", () => {
    expect(tailCursorOf([])).toBe(0);
  });

  it("uses the largest sequence of the snapshot", () => {
    expect(tailCursorOf([msg(39), msg(40)])).toBe(40);
  });

  it("has no cursor when no message carries a sequence", () => {
    expect(tailCursorOf([msg(undefined, "legacy")])).toBeUndefined();
  });
});
