# 우때 (Uttae)

> 채팅, 일정, 장소 검색, 지도, 북마크, AI를 한 공간에 모은 실시간 여행 협업 서비스

카카오톡으로 대화하고, 지도에서 장소를 찾고, 노션·엑셀에 일정을 따로 정리하던 여행 준비 과정을 하나의 워크스페이스로 합칩니다.

## 기술 스택

| Category      |    Technology |
| :------------ | ------------: |
| **Framework** |       Next.js |
| **Styling**   |  Tailwind CSS |
| **State**     |       Zustand |
| **Animation** | Framer Motion |
| **DataFetch** | Tanstack Query|


## 실행
npm install
npm run dev

npm run lint
npm test
npm run build

## QA에서 AI 입력 끄기

QA용 Vercel 빌드 환경에 `NEXT_PUBLIC_AI_ENABLED=false`를 설정하고 재빌드합니다. 정확히 `false`인 경우에만 끄며, 미설정 또는 `true`이면 기존 AI UI·동작을 유지합니다. 이 공개 값은 빌드 시 고정되므로 서버 환경변수만 바꾸거나 브라우저를 새로고침해서는 적용되지 않습니다.

- AI 버튼·추천 문구·`@` 멘션 선택과 `@ai`의 AI 모드 전환을 제공하지 않습니다. 입력한 `@ai ...`는 원문 그대로 일반 채팅으로 전송됩니다.
- AI 요청·취소 publish도 차단합니다. 일반 채팅·장소 공유·수신 흐름은 유지합니다.
- 이 flag는 UI 제어이며 권한/보안 경계가 아닙니다. QA 백엔드도 `AI_ENABLED=false`여야 자동 요약과 외부 AI 호출이 중단됩니다. 백엔드의 `AI_DISABLED`, `retryable=false` 응답은 기존 공통 오류 처리로 안내합니다.
- `API_BASE_URL`과 `NEXT_PUBLIC_API_BASE_URL`은 같은 QA API를 가리켜야 합니다. 고정 QA 커스텀 도메인·공유 가능한 쿠키 범위·Google callback 일치는 별도 설정 전제입니다.

실제 Vercel 설정·배포·OAuth·도메인 변경은 이 코드 변경에 포함되지 않습니다. 운영 빌드에는 QA의 `false` 설정을 적용하지 않습니다.

## 기여하기

커밋, 브랜치 생성, PR 및 병합 절차는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 따릅니다.

## API Documentation - 8080포트

- **REST API**: Springdoc OpenAPI — `/swagger-ui/index.html` (dev 환경 전용)
- **WebSocket**: Springwolf — `/springwolf/asyncapi-ui.html` (dev 환경 전용)
