import { readIsMobileDevice } from "./device";

/** 화면 방향을 읽는다. 뷰포트 비율은 소프트 키보드만 열려도 가로가 될 수 있다. */
export function readIsLandscapeOrientation(): boolean {
  if (typeof window === "undefined") return false;

  const type = window.screen?.orientation?.type;
  if (type === "landscape-primary" || type === "landscape-secondary") return true;
  if (type === "portrait-primary" || type === "portrait-secondary") return false;

  // Screen Orientation API를 지원하지 않는 구형 iOS Safari.
  const angle = window.orientation;
  if (typeof angle === "number" && Number.isFinite(angle)) {
    return Math.abs(angle) % 180 === 90;
  }

  // API가 없더라도 키보드로 축소되는 innerHeight/matchMedia는 사용하지 않는다.
  const screen = window.screen;
  return !!screen && screen.width > 0 && screen.height > 0 && screen.width > screen.height;
}

export function readIsMobileLandscape(): boolean {
  return readIsMobileDevice() && readIsLandscapeOrientation();
}
