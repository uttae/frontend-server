# QA 인증 쿠키 이름 분리

같은 도메인 구조를 유지하면서 QA는 `qa_access_token` / `qa_refresh_token`만 사용한다. 운영은 `access_token` / `refresh_token`을 유지한다. 부모 Domain `.uttae.app` 쿠키는 QA 호스트에도 전송된다. 이 변경은 이름 선택 충돌을 줄이며, 별도 등록 도메인 수준의 격리·토큰 발급자 격리·전체 보안 문제 해결을 제공하지 않는다.

## FE 설정

| 키 | QA 값 | 미설정 기본값 / 용도 |
| --- | --- | --- |
| `AUTH_ACCESS_COOKIE_NAME` | `qa_access_token` | `access_token` |
| `AUTH_REFRESH_COOKIE_NAME` | `qa_refresh_token` | `refresh_token` |
| `API_BASE_URL` | `https://api.qa.uttae.app` | 기본값 없음, 서버 BFF/세션/약관 조회 |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.qa.uttae.app` | 기본값 없음, 브라우저 직접 API/WS |
| `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | `https://qa.uttae.app/auth/callback` | 기존 OAuth 설정과 일치 필요 |

새 쿠키 이름 두 값은 함께 설정한다. 둘 다 없으면 운영/일반 dev 기본값을 사용한다. 하나만 있거나 빈 값·중복·잘못된 쿠키 이름이면 인증 처리를 실패시킨다. `NODE_ENV=production`은 QA의 Next 프로덕션 빌드에도 적용되므로 환경 선택에 사용하지 않는다. 호스트 자동 판별이나 운영 이름 fallback은 없다. QA에 두 값을 모두 누락하면 기본값을 사용하므로 등록 시 반드시 확인한다.

두 이름은 서버 요청 처리에서 읽는 비밀이 아닌 설정이다. `NEXT_PUBLIC_` 접두사를 붙이거나 `next.config`의 `env`에 넣지 않는다. `API_BASE_URL`은 기존대로 서버 모듈 초기화 시 읽으므로 새 서버 인스턴스에도 제공해야 한다. 빌드의 route 수집에도 기존 필수 변수를 제공한다. `NEXT_PUBLIC_*`는 `next build` 때 번들에 고정되므로 QA용 값으로 빌드해야 한다. 운영 빌드를 QA로 단순 이동하지 않는다. [Next.js 환경 변수 문서](https://nextjs.org/docs/app/guides/environment-variables).

Vercel에서는 실제 QA 도메인을 담당하는 프로젝트/환경/브랜치 범위에 값을 등록하고 새 배포를 생성해야 한다. 환경 변수 수정은 기존 배포를 바꾸지 않는다. QA가 Vercel의 Production 환경을 쓰는 별도 프로젝트인지 Preview/Custom 환경인지는 운영 담당이 실제 연결을 확인한다. 전체 Preview나 운영 프로젝트에 무조건 등록하지 않는다. 이 PR은 등록·배포를 수행하지 않는다. [Vercel 환경 변수 관리](https://vercel.com/docs/environment-variables/managing-environment-variables).

## 경로별 계약

- proxy의 보호 경로/로그인/초대 진입과 `/api/auth/session`: 선택한 이름만 서버 검증에 전달하고, 해당 refresh 이름으로만 회전한다. refresh 후 일시 장애 때 새 쿠키를 보존하는 기존 정책도 유지한다.
- `/api/auth/refresh`, `/api/auth/logout`: 선택한 두 이름만 BE로 전달한다. 운영-only QA 요청은 운영 refresh를 전달하거나 폐기하지 않는다.
- Google 로그인/가입/재동의 및 세션·refresh·logout 응답: 선택한 두 이름의 Set-Cookie만 전달한다. Domain/Path/Expires/Max-Age/HttpOnly/Secure/SameSite는 변환하지 않는다. 다른 환경 이름과 무관한 쿠키는 인증 BFF에서 중계하지 않는다. `getSetCookie`가 없는 구형 응답의 합쳐진 헤더는 거부한다.
- 브라우저 직접 API, 초대 API, `DELETE /users/me`, SockJS/WS 핸드셰이크는 기존 credentials 흐름을 유지한다. 브라우저가 부모 도메인 쿠키도 전송하므로 **BE가 QA 이름만 선택해야 한다**. FE만으로 직접 요청을 격리할 수 없다. WS 세션 복구는 기존 BFF refresh/session 경로를 사용한다.
- 조회 캐시·이벤트 갱신·화면·재연결 정책은 변경하지 않는다.

## BE 동기화 및 전환

BE 별도 변경의 계약은 `cookie.access-name=qa_access_token`, `cookie.refresh-name=qa_refresh_token`, QA Domain `.qa.uttae.app`, 기존 Path 유지다. 운영은 기본 이름과 `.uttae.app`을 유지한다. 실제 BE PR의 최종 키·QA 프로필·로그아웃/탈퇴 만료 Domain/Path와 직접 API/WS 적용을 배포 전에 확인한다. 새 secret이나 서명 키/DB 비밀번호 회전은 필요하지 않다.

1. FE/BE 변경과 QA 설정을 함께 준비한다. QA 로그인·사용을 일시 중지한 전환 창에서 BE QA 이름 적용 후, 같은 이름으로 구성한 FE 새 배포를 연결한다. 운영 설정은 변경하지 않는다.
2. 기존 QA 로그인은 새 이름을 갖지 않으므로 QA 재로그인이 필요하다. 운영 쿠키를 복사하거나 fallback하지 않는다.
3. 활성화 전 운영-only QA 비인증, 동시 쿠키 양쪽 순서, 로그인/가입/재동의, refresh, WS 재연결, logout/탈퇴가 QA 쿠키만 만료시키는지 확인한다. 실제 계정·통합 검증은 별도 소유 로컬 QA에서 수행한다.

| 혼합 상태 | 영향 |
| --- | --- |
| 새 FE QA 이름 + 구 BE 기본 이름 | BFF가 운영 이름을 제거하고 구 BE 발급 쿠키를 버리므로 로그인/세션/refresh 불능 가능. 직접 API/WS는 구 BE이므로 격리 보장 없음. 지원되는 운영 상태가 아님. |
| 구 FE + 새 BE QA 이름 | 초기 세션은 원시 Cookie 전달로 동작할 수 있으나 자동 refresh는 구 FE의 기본 refresh 이름 검사로 누락되거나 부모 운영 쿠키 존재 여부에 좌우됨. 지속 로그인 보장 없음. |
| 새 FE 기본 이름 + 새 BE QA 이름 | FE가 QA 이름을 전달/중계하지 않아 인증 불능. FE 두 변수 등록 필요. |
| 양쪽 새 버전 + 일치한 QA 설정 | 의도한 이름 분리. 직접 API/WS/탈퇴의 최종 검증은 BE 통합 증거 필요. |

롤백은 QA 사용을 중지하고 FE/BE와 설정을 호환되는 조합으로 함께 되돌리는 방식으로 계획한다. 가능하면 새 QA 이름을 유지하는 수정 버전을 사용한다. 구 버전/기본 이름으로 되돌리면 원래 이름 충돌 위험도 되돌아오므로 격리 완료로 취급하지 말고 QA를 재개하지 않는다. 한쪽만 롤백하거나 운영 이름 fallback을 추가하지 않는다. 운영 세션/refresh를 폐기하지 않는다.

이 구현은 legacy QA 쿠키를 자동 삭제하지 않는다. 필요 시 운영 담당이 기존 QA 발급의 정확한 Domain/Path를 먼저 확인한 후 그 범위만 정리한다. `.uttae.app` 쿠키 만료, 광범위한 Clear-Site-Data, 운영 refresh 무효화는 금지한다. 소유 범위를 확인할 수 없다면 삭제하지 않는다.
