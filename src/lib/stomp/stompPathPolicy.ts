export function pathSuspendsStomp(pathname: string): boolean {
  return pathname === "/waiting" || pathname.startsWith("/join/");
}

export function pathDefersRoomStompRoomTopics(pathname: string): boolean {
  return pathname === "/home" || pathname.startsWith("/home/");
}
