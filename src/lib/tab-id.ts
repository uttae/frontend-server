/**
 * 이 탭이 보낸 변경 요청과 그 STOMP 반향(`originTabId`)을 잇는 ID.
 *
 * 모듈 변수에만 둔다. sessionStorage는 탭을 복제하면 값이 복사돼 두 탭이 같은 ID가 되고,
 * localStorage는 모든 탭이 같은 값을 쓴다. 새로고침하면 새 ID가 된다.
 */
let tabId: string | null | undefined;

/** 서버 렌더에서는 null. UUID를 만들 수 없는 브라우저도 null이고, 그때는 헤더를 싣지 않는다 */
export function getTabId(): string | null {
  if (tabId !== undefined) return tabId;
  if (typeof window === "undefined") return null;
  tabId = createUuidV4();
  return tabId;
}

function createUuidV4(): string | null {
  if (typeof crypto === "undefined") return null;
  // randomUUID는 보안 컨텍스트(https·localhost)에서만 있다 — `http://<LAN IP>`로 연 화면은 getRandomValues로 만든다
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto.getRandomValues !== "function") return null;

  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  // RFC 9562 v4: 13번째 자리는 버전 4, 17번째 자리는 변형 8~b
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
