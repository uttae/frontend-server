# Amplitude 운영 가이드

## 목적과 범위

우때 프론트엔드는 분석 쿠키에 동의한 브라우저에서만 `@amplitude/unified`를 초기화한다. `src/lib/analytics/track.ts`로 기록한 이벤트 중 공통 성과와 세부 제품 행동을 Amplitude에 전달한다. GA4는 공통 성과와 랜딩 행동을 받는다. 목적지는 `event-destinations.ts`에서 관리하며 Session Replay도 같은 동의 경계 안에서 동작한다.

SDK 초기화는 애플리케이션 생명주기 동안 한 번만 수행된다. 서버 렌더링과 API 서버에서는 Amplitude SDK를 실행하지 않는다.

## 환경별 프로젝트와 환경변수

Amplitude의 Development와 Production 프로젝트를 분리하고 API 키를 배포 환경별로 설정한다. Preview는 Development 프로젝트를 공유해도 되지만 Production 프로젝트 키를 사용하지 않는다.

| 배포 환경 | `NEXT_PUBLIC_AMPLITUDE_API_KEY` | 권장 Amplitude 프로젝트 | 기본 Replay 비율 |
| --- | --- | --- | --- |
| Local development | 개발 프로젝트 API 키 | Development | `1` |
| Preview / staging | 개발 또는 별도 Preview API 키 | Development / Preview | `0.1` (`NODE_ENV=production`) |
| Production | 운영 프로젝트 API 키 | Production | `0.1` |

- API 키는 클라이언트 번들에 포함되는 공개 식별자이지만, 프로젝트 혼입을 막기 위해 소스에 리터럴로 커밋하지 않는다.
- `NEXT_PUBLIC_AMPLITUDE_API_KEY`가 비어 있으면 Amplitude만 비활성화된다. GA4와 애플리케이션 렌더링은 계속 동작한다.
- `NEXT_PUBLIC_AMPLITUDE_SESSION_REPLAY_SAMPLE_RATE`로 `0`부터 `1` 사이의 Replay 비율을 덮어쓸 수 있다. `0`은 Replay 수집을 끄고 `1`은 모든 동의 세션을 대상으로 한다.
- 범위를 벗어나거나 숫자가 아닌 Replay 값은 무시하며, Production은 `0.1`, 그 외 환경은 `1`을 사용한다.

환경변수 변경 후에는 새 클라이언트 번들이 필요하므로 반드시 다시 빌드하고 배포한다.

## 수집 정책

제품 분석의 기준은 `docs/analytics/amplitude-tracking-plan.md`와 타입으로 관리되는 커스텀 이벤트다.

- 자동 수집: 세션과 마케팅 유입 정보만 활성화한다.
- 페이지 조회: 앱의 SPA 라우트 추적기가 `page_view`를 직접 전송하므로 Amplitude 기본 page view autocapture는 끈다.
- 사용자 행동: element, form, file download, frustration, network, Web Vitals, performance autocapture는 끈다.
- URL 보강: SDK 자동 URL 보강은 끄고, 제품 이벤트에는 정규화된 `page_path`와 쿼리·해시가 없는 `page_location`을 명시적으로 전달한다.
- 사용자 ID: 로그인 성공 뒤 내부 사용자 ID만 설정하며, 동의 철회 시 제거하고 opt-out 처리한다. 짧은 양의 정수 ID를 그대로 사용하기 위해 `analytics.minIdLength: 1`을 지정한다(사용자·기기 ID 최소 길이에 함께 적용).

Amplitude 프로젝트의 원격 autocapture 설정이 로컬 설정과 충돌하지 않는지 배포 때 확인한다.

## Session Replay 개인정보 보호

기본 마스킹 레벨은 `conservative`이며 모든 텍스트를 마스킹한다. 채팅, 검색, 사용자 이름, 여행 제목처럼 화면에 렌더링되는 민감 가능 데이터를 기본적으로 노출하지 않는 쪽을 우선한다.

- `.amp-mask` 또는 `[data-amplitude-mask]`: 특정 영역의 텍스트를 명시적으로 마스킹한다.
- `.amp-block` 또는 `[data-amplitude-block]`: 이미지나 복합 UI 전체를 동일 크기의 자리 표시자로 대체한다.
- `.amp-unmask`나 원격 unmask 규칙은 개인정보 검토 없이 추가하지 않는다.
- Amplitude Session Replay 설정 화면의 원격 개인정보 규칙이 SDK의 로컬 규칙을 덮어쓸 수 있으므로 권한과 변경 이력을 제한한다.

개인정보처리방침과 쿠키 안내에는 Amplitude Analytics 및 Session Replay의 목적, 동의 철회 방법, 보유 기간을 반영한다.

## 배포 전 검증

1. 분석 쿠키를 거부한 상태에서 Amplitude 도메인 요청이 발생하지 않는지 확인한다.
2. 동의 후 `create_plan` 등 테스트 이벤트 하나를 발생시킨다.
3. 브라우저 개발자 도구에서 Analytics와 Replay 요청이 성공하는지 확인한다.
4. Amplitude Development 프로젝트의 Events와 User Lookup에서 테스트 이벤트를 확인한다.
5. Replay 표본에 텍스트가 마스킹되어 있는지 확인한다.
6. Production API 키가 Development/Preview 배포에 포함되지 않았는지 확인한다.
7. Production 배포 후 실제 이벤트 하나를 다시 발생시키고 Production 프로젝트 수신을 확인한다.

AdGuard 같은 DNS 광고 차단기를 사용하면 아래 호스트를 허용해야 직접 검증할 수 있다.

- `api2.amplitude.com`: Analytics 이벤트 수집
- `sr-client-cfg.amplitude.com`: Session Replay 원격 설정
- `api-sr.amplitude.com`: Session Replay 업로드

일부 실제 사용자의 차단으로 인한 누락이 사업 지표에 중요해지면, 개인정보·인프라 검토 후 퍼스트파티 프록시를 별도 도입한다.

## 전송 실패 진단

개발 서버에 `[browser] Amplitude Logger`가 출력되면 브라우저 SDK의 로그가 터미널로 전달된 것이다. Next.js 페이지의 `GET ... 200`은 페이지 응답이며 Amplitude 이벤트 수집 성공을 뜻하지 않는다.

- `Failed to fetch`와 `Status 'failed'`의 `code: 0`이 함께 나오면 SDK 전송 중 예외가 발생한 것이다. `0`은 실제 HTTP 응답 상태가 아니다. DNS, 광고 차단, 연결 실패, CORS 등을 브라우저 Network에서 구분한다.
- `Event rejected due to exceeded retry count`는 전송 실패가 반복돼 재시도 한도를 초과한 이벤트가 폐기됐다는 뜻이다. 로그를 숨기거나 재시도 횟수만 늘려도 수집 문제는 해결되지 않는다.
- `net::ERR_NAME_NOT_RESOLVED`라면 API 키나 이벤트 내용을 바꾸기 전에 로컬 DNS, VPN의 DNS 경로, 도메인 차단 설정을 확인한다. 시스템의 DNS 조회 결과와 공유기 또는 공용 DNS의 조회 결과를 비교한다.
- Network에서 실제 HTTP 응답이 확인되면 그 응답 본문을 기준으로 API 키, 프로젝트 리전, 이벤트 형식 등을 진단한다.

직접 전송하는 현재 구성에서는 `https://api2.amplitude.com/2/httpapi`의 호스트가 브라우저에서 해석되고 연결되어야 한다. 도메인 해석을 복구한 뒤 페이지를 새로고침하고 새 이벤트의 전송 성공 및 Development 프로젝트 수신을 다시 확인한다. 재시도 한도를 넘겨 이미 폐기된 이벤트는 해당 재시도에서 더 이상 전송되지 않는다.

## 대시보드 시작점

- 생성자 활성화 퍼널: `create_plan` → `add_to_itinerary` (신규 가입자는 별도 코호트로 구분)
- 참여자 활성화 퍼널: `invite_view` → `join_group` → `view_plan`; 이후 일정 편집과 조회 위주 사용을 구분
- 공유: 생성자의 `create_plan → share`와 참여자의 `invite_view → join_group`을 분리. 서로 다른 사람의 행동을 기본 사용자 퍼널로 연결하지 않는다. 여행방 기능 이벤트에는 기존 방 ID를 이벤트별 `groups.room_id`로 전달한다. 그룹 보고 기능의 사용 가능 여부를 확인한 뒤 방 기준 퍼널로 분석한다(정확한 신규 합류 판정은 별도 백엔드 이벤트 필요).
- 탐색 퍼널: `view_search_results` → `view_place` → `add_to_bookmark` 또는 `add_to_itinerary`
- 온보딩 퍼널: `tutorial_begin` → `tutorial_complete`; `tutorial_skip`은 `skip_step`별 이탈을 분석한다.

## 긴급 비활성화

- Analytics와 Replay 모두 중지: 배포 환경에서 `NEXT_PUBLIC_AMPLITUDE_API_KEY`를 제거하고 재배포한다.
- Replay만 중지: `NEXT_PUBLIC_AMPLITUDE_SESSION_REPLAY_SAMPLE_RATE=0`으로 설정하고 재배포한다.
- 사용자별 중지: 분석 동의를 철회하면 사용자 ID를 지우고 Amplitude opt-out을 활성화한다.

## 이벤트 전송 대상 변경 후 운영 확인

- `expense_created`·`packing_item_added`와 기존 공통 이벤트가 양쪽에서 수신되는지 확인한다.
- `expense_updated`·`expense_budget_saved`·`settlement_summary_viewed`·`packing_item_checked` 등 세부 행동은 Amplitude에만, `cta_click`·`section_view`는 GA4에만 수신되는지 확인한다.
- GA4 전용 랜딩 이벤트의 Amplitude 기존 차트와 Amplitude 전용 행동의 GA4 기존 차트는 배포 이후 신규 데이터가 끊긴다. 과거 데이터가 삭제되는 것은 아니다. 해당 보고서를 각 기준 도구로 옮기고 실제 배포일을 비교 구간에 표시한다.
- 재사용 분석은 단순 페이지 재방문과 핵심 행동 재사용을 구분하고 여행 준비 기간/다음 여행을 고려한다.
- 운영 Tracking Plan·대시보드·GA4 주요 이벤트 지정은 원격 설정이며 코드 변경만으로 완료되지 않는다. 가계부·준비물 이벤트에는 공통 정규화 URL과 방 ID만 사용하고 금액·메모·이름·항목 식별자는 추가하지 않는다.

방 단위 퍼널은 그룹 타입 `room_id`를 선택하고 `share` 단계에 `role=host`, `join_group` 단계에 `role=member`를 적용한다. Accounts 기능 활성화/계약은 이번 프론트 코드 변경과 별개다. 이벤트 속성에 방 ID가 보이는 것만으로 그룹 퍼널이 설정된 것은 아니다.

그룹 분석은 생성·조회·일정·북마크·채팅·가계부·준비물 전반에 사용할 수 있다. 검색·장소 상세·튜토리얼·페이지 조회는 확정된 방 문맥에서만 그룹을 가진다. 준비물은 개인 기능이며 이를 공동 편집 활성의 근거로 삼지 않는다. 협업 지표에는 적절한 이벤트 집합과 서로 다른 참여자 조건을 별도로 정의한다.

현재 `SidebarTutorial`은 컴포넌트와 이벤트 코드만 있고 실제 화면에서 마운트하는 호출이 없다. 튜토리얼 이벤트의 그룹 지원은 준비되어 있으나, 화면에 연결하기 전에는 운영 이벤트 유입을 기대하지 않는다. 이번 변경에서 튜토리얼 표시를 새로 활성화하지 않았다.

## 로그아웃 사용자 식별 경계

- 세션 사용자 캐시가 있는 상태에서 로그아웃·세션 만료로 정리될 때 `resetAmplitudeIdentityOnLogout`을 호출한다. 준비된 SDK는 `reset()`으로 사용자 ID를 비우고 새 기기 ID를 발급한다. GA4는 기존 `user_id: null` 처리만 유지한다.
- 일반 익명 페이지 조회와 반복된 세션 정리는 기기 ID를 다시 만들지 않는다. 재로그인은 새 기기 ID에 해당 사용자의 기존 내부 ID를 설정한다.
- SDK 초기화 전 대기 중이던 이전 사용자의 Amplitude 명령은 폐기한다. 초기화 완료 후 식별자를 재설정한 다음 로그아웃 이후 명령을 처리한다. 초기화 중에는 SDK 자동 수집을 일시 정지하고, 동의가 유지된 경우에만 준비 후 재개한다.
- SDK가 시작되지 않았다면 해당 프로젝트의 저장된 식별 쿠키만 제거한다. 로그아웃 때문에 SDK를 초기화하거나 동의를 허용하지 않는다. 초기화 실패 후 재시도에도 식별 경계를 유지한다.
- 이 처리는 로그아웃 이후 이벤트의 귀속을 분리하며, 이미 수집된 과거 이벤트를 삭제하는 기능은 아니다.
