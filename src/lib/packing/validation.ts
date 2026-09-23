export class PackingValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PackingValidationError"; }
}
function invalid(message: string): never { throw new PackingValidationError(message); }
export function assertPackingVersion(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid("목록 버전을 확인해 주세요.");
}
export function assertPackingId(value: unknown): asserts value is number {
  assertPackingVersion(value);
  if (value === 0) invalid("항목을 확인해 주세요.");
}
export function assertPackingChecked(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") invalid("체크 상태를 확인해 주세요.");
}
export function normalizePackingName(raw: string, kind: "part" | "item"): string {
  const maximum = kind === "part" ? 50 : 100;
  if (typeof raw !== "string" || raw.length > maximum || [...raw].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) invalid(`이름은 줄바꿈 없이 1~${maximum}자로 입력해 주세요.`);
  const result = raw.trim();
  if (!result) invalid("이름을 입력해 주세요.");
  return result;
}
export function normalizePackingMemo(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 2000 || [...raw].some(c => { const n = c.charCodeAt(0); return (n < 32 && n !== 9 && n !== 10 && n !== 13) || n === 127; })) invalid("메모는 제어문자 없이 2000자 이내로 입력해 주세요.");
  return raw.replace(/\r\n?/g, "\n").trim() || null;
}
