# QA 인증 쿠키 이름 분리

같은 도메인 구조를 유지하면서 QA는 `qa_access_token` / `qa_refresh_token`만 사용한다. 운영은 `access_token` / `refresh_token`을 유지한다. 부모 Domain `.uttae.app` 쿠키는 QA 호스트에도 전송된다. 이 변경은 이름 선택 충돌을 줄이며, 별도 등록 도메인 수준의 격리·토큰 발급자 격리·전체 보안 문제 해결을 제공하지 않는다.

## FE 설정

서버는 요청 처리 시 `VERCEL_TARGET_ENV`가 정확히 `qa`일 때 QA 이름만 선택한다. 두 종류의 쿠키가 함께 와도 QA 이름만 사용하고, QA 쿠키가 없으면 일반 쿠키로 재시도하지 않는다. 운영, 일반 PR Preview, 로컬 개발과 다른 대상에서는 일반 이름을 사용한다.

Vercel은 시스템 환경 변수 접근을 활성화한 프로젝트의 빌드와 런타임에 커스텀 환경 이름을 제공한다. QA 적용 전 운영 담당자는 이 전제를 확인해야 한다. 신호가 노출되지 않으면 서버는 로컬 개발과 구별할 수 없어 일반 이름을 선택한다. GitHub 배포 기록의 환경 이름이나 배포 성공만으로 함수에 값이 전달됐는지는 확인할 수 없다. [Vercel 시스템 환경 변수](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_target_env)

| 기존 공개 설정 | QA 빌드 예시 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.qa.uttae.app` | 서버 BFF/세션/약관과 브라우저 직접 API/WS의 공통 주소 |
| `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | `https://qa.uttae.app/auth/callback` | OAuth 리디렉션 주소 |

공개 설정은 QA 대상에 맞춰 빌드한다. feature 브랜치의 Vercel 검사는 해당 브랜치 배포를 확인하며, `dev` 병합은 Git 연동으로 QA 배포를 시작한다.

## 경로별 계약

- proxy의 보호 경로/로그인/초대 진입과 `/api/auth/session`: 선택한 이름만 서버 검증에 전달하고, 해당 refresh 이름으로만 회전한다. refresh 후 일시 장애 때 새 쿠키를 보존하는 기존 정책도 유지한다.
- `/api/auth/refresh`, `/api/auth/logout`: 선택한 두 이름만 BE로 전달한다. 운영-only QA 요청은 운영 refresh를 전달하거나 폐기하지 않는다.
- Google 로그인/가입/재동의 및 세션·refresh·logout 응답: 선택한 두 이름의 Set-Cookie만 전달한다. Domain/Path/Expires/Max-Age/HttpOnly/Secure/SameSite는 변환하지 않는다. 다른 환경 이름과 무관한 쿠키는 인증 BFF에서 중계하지 않는다. `getSetCookie`가 없는 구형 응답의 합쳐진 헤더는 거부한다.
- 브라우저 직접 API, 초대 API, `DELETE /users/me`, SockJS/WS 핸드셰이크는 기존 credentials 흐름을 유지한다. 브라우저가 부모 도메인 쿠키도 전송하므로 **BE가 QA 이름만 선택해야 한다**. FE만으로 직접 요청을 격리할 수 없다. WS 세션 복구는 기존 BFF refresh/session 경로를 사용한다.
- 조회 캐시·이벤트 갱신·화면·재연결 정책은 변경하지 않는다.

## BE 동기화 및 전환

[BE #226](https://github.com/uttae/backend-server/pull/226)의 QA 프로필은 `cookie.access-name=qa_access_token`, `cookie.refresh-name=qa_refresh_token`을 지정한다. QA 발급·만료 범위는 Domain `.qa.uttae.app`, Path `/`다. 운영은 기본 이름과 `.uttae.app`을 사용한다.

1. FE 수정은 독립적으로 병합할 수 있다. QA 사용을 재개하려면 #226이 반영된 BE를 QA 프로필로 실행하고, Vercel에서 QA 대상을 식별하는 FE를 연결한다. FE의 dev 병합은 자동 QA 배포를 유발하고 BE QA 배포는 별도 수동 작업이므로, 전환 중에는 QA 인증 사용을 중지한다.
2. 기존 QA 로그인은 새 이름을 갖지 않으므로 QA 재로그인이 필요하다. 운영 쿠키를 복사하거나 fallback하지 않는다.
3. 활성화 전 운영-only QA 비인증, 동시 쿠키 양쪽 순서, 로그인/가입/재동의, refresh, WS 재연결, logout/탈퇴가 QA 쿠키만 만료시키는지 확인한다. 실제 계정·통합 검증은 별도 소유 로컬 QA에서 수행한다.

| 혼합 상태 | 영향 |
| --- | --- |
| 새 FE QA 이름 + 구 BE 기본 이름 | BFF가 운영 이름을 제거하고 구 BE 발급 쿠키를 버리므로 로그인/세션/refresh 불능 가능. 직접 API/WS는 구 BE이므로 격리 보장 없음. 지원되는 운영 상태가 아님. |
| 구 FE + 새 BE QA 이름 | 초기 세션은 원시 Cookie 전달로 동작할 수 있으나 자동 refresh는 구 FE의 기본 refresh 이름 검사로 누락되거나 부모 운영 쿠키 존재 여부에 좌우됨. 지속 로그인 보장 없음. |
| 새 FE 기본 이름 + 새 BE QA 이름 | FE가 QA 이름을 전달/중계하지 않아 인증 불능. QA 대상 이름과 시스템 변수 노출 여부 확인 필요. |
| 양쪽 새 버전 + 일치한 QA 설정 | 의도한 이름 분리. 직접 API/WS/탈퇴의 최종 검증은 BE 통합 증거 필요. |

새 FE는 `AUTH_ACCESS_COOKIE_NAME`과 `AUTH_REFRESH_COOKIE_NAME`을 읽지 않는다. 전환 기간에는 기존 값을 유지해도 된다. 새 QA 배포의 대상 신호와 쿠키 동작을 확인하고, 구버전 QA 소스를 재빌드·재배포할 가능성 및 롤백 절차의 의존성이 사라진 뒤 두 설정을 정리한다. 프로젝트 환경 변수 변경은 기존 배포에 소급되지 않지만 구버전을 새로 빌드하면 그 시점의 설정이 필요하다. [Vercel 환경 변수 관리](https://vercel.com/docs/environment-variables/managing-environment-variables)

롤백은 QA 사용을 중지하고 FE/BE와 설정을 호환되는 조합으로 함께 되돌리는 방식으로 계획한다. 가능하면 새 QA 이름을 유지하는 수정 버전을 사용한다. 구 버전/기본 이름으로 되돌리면 원래 이름 충돌 위험도 되돌아오므로 격리 완료로 취급하지 말고 QA를 재개하지 않는다. 한쪽만 롤백하거나 운영 이름 fallback을 추가하지 않는다. 운영 세션/refresh를 폐기하지 않는다.

이 구현은 legacy QA 쿠키를 자동 삭제하지 않는다. 필요 시 운영 담당이 기존 QA 발급의 정확한 Domain/Path를 먼저 확인한 후 그 범위만 정리한다. `.uttae.app` 쿠키 만료, 광범위한 Clear-Site-Data, 운영 refresh 무효화는 금지한다. 소유 범위를 확인할 수 없다면 삭제하지 않는다.
