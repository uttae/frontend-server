import { describe, expect, it } from "vitest";
import { normalizePackingName, normalizePackingMemo, assertPackingVersion, assertPackingId, assertPackingChecked } from "./validation";

describe("packing strict input", () => {
  it("normalizes ECMAScript edge whitespace and preserves Unicode/interior spaces", () => {
    expect(normalizePackingName("\uFEFF\u00a0 여권 🎒 ·  서류　", "part")).toBe("여권 🎒 ·  서류");
    expect(normalizePackingMemo("　 a\r\n\tb\rc  \n d \uFEFF")).toBe("a\n\tb\nc  \n d");
    expect(normalizePackingMemo("\t\r\n\u00a0\uFEFF　")).toBeNull();
  });
  it("counts raw UTF-16 units before trim or newline normalization", () => {
    expect(() => normalizePackingName(" " + "a".repeat(50), "part")).toThrow();
    expect(normalizePackingName("🎒".repeat(25), "part")).toHaveLength(50);
    expect(() => normalizePackingName("🎒".repeat(51), "item")).toThrow();
    expect(() => normalizePackingMemo("\r\n".repeat(1001))).toThrow();
    expect(normalizePackingMemo("a".repeat(2000))).toHaveLength(2000);
  });
  it.each(["", "　", "a\nb", "a\rb", "a\tb", "a\0b", "a\x7fb"])("rejects invalid name %j", raw => {
    expect(() => normalizePackingName(raw, "item")).toThrow();
  });
  it.each(["a\0b", "a\x01b", "a\x7fb"])("rejects harmful memo control %j", raw => {
    expect(() => normalizePackingMemo(raw)).toThrow();
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null])( "rejects invalid version %j", value => {
    expect(() => assertPackingVersion(value)).toThrow();
  });
  it("does not coerce IDs or booleans", () => {
    expect(() => assertPackingId(0)).toThrow();
    expect(() => assertPackingId(-1)).toThrow();
    expect(() => assertPackingChecked("true")).toThrow();
    expect(() => assertPackingChecked(1)).toThrow();
    expect(() => assertPackingVersion(0)).not.toThrow();
    expect(() => assertPackingId(Number.MAX_SAFE_INTEGER)).not.toThrow();
    expect(() => assertPackingChecked(false)).not.toThrow();
  });
});
