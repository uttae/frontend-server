export type BatchItemStatus = "OK" | "ERROR" | "FAILED";

export type BatchItemError = {
  status: "ERROR" | "FAILED";
  errorCode?: string;
};

export function isBatchItemOk<T extends { status: BatchItemStatus }>(item: T): item is T & { status: "OK" } {
  return item.status === "OK";
}

export function isBatchItemError(item: { status?: string }): item is BatchItemError {
  return item.status === "ERROR" || item.status === "FAILED";
}
