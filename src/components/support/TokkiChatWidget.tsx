"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const TOKKI_WIDGET_SRC = "https://chatbot.tokki-ai.com/widget.js";
const TOKKI_WIDGET_KEY = "lZcn0_G6chmnD0EndFiG1BJxCNNC1gwe";
const TOKKI_WIDGET_PATHS = new Set(["/", "/home"]);

// widget.js는 숨김 API 없이 런처 버튼과 iframe을 body에 직접 붙이고, 한 번 붙인 뒤에는 페이지를 옮겨도 남는다.
// display·opacity는 위젯이 인라인으로 정하므로 위젯이 건드리지 않는 visibility로 감춘다.
const HIDE_WIDGET_CSS = `body > button[aria-label^="챗봇"], body > iframe[title="톡키 챗봇"] { visibility: hidden; }`;
// 모바일에서 런처 버튼이 쿠키 동의 배너의 허용 버튼을 가리므로, 배너가 떠 있는 동안 런처를 감춘다.
const HIDE_LAUNCHER_DURING_CONSENT_CSS = `body:has([aria-label="쿠키 동의"]) > button[aria-label^="챗봇"] { visibility: hidden; }`;

export function TokkiChatWidget() {
  const pathname = usePathname();

  if (!TOKKI_WIDGET_PATHS.has(pathname)) {
    return <style>{HIDE_WIDGET_CSS}</style>;
  }

  return (
    <>
      <Script src={TOKKI_WIDGET_SRC} data-tokki-key={TOKKI_WIDGET_KEY} strategy="afterInteractive" />
      <style>{HIDE_LAUNCHER_DURING_CONSENT_CSS}</style>
    </>
  );
}
