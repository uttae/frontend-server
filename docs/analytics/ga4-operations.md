# GA4 운영 체크리스트

이 문서는 우때 프런트엔드의 GA4 코드 설정과 GA 관리자 설정이 어긋나 페이지뷰가 중복되거나 식별자가 수집되는 일을 방지하기 위한 운영 기준이다.

## 코드에서 보장하는 항목

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`는 `G-`로 시작하는 유효한 형식만 사용한다.
- 프로덕션에서는 사용자가 분석 쿠키를 허용한 뒤에만 gtag.js를 로드한다.
- `gtag('config', ...)`에 `send_page_view: false`를 적용해 기본 페이지뷰를 끈다.
- 페이지뷰, User-ID, 일반 이벤트는 모두 중앙 데이터 명령 게이트에서 런타임 활성화와 현재 분석 동의를 확인한다. 초기화 전에 보류된 명령도 실제 전송 직전에 같은 게이트를 다시 통과한다.
- Consent Mode의 `default`, `update`, `js`, `config`와 철회 시 `user_id: null`은 데이터 명령과 분리된 제어 경로로 전송한다.
- App Router 경로 변경마다 애플리케이션이 `page_view`를 한 번 전송한다.
- 일반 경로의 첫 `page_view`는 세션 사용자 쿼리가 성공 또는 오류로 확정된 뒤 전송한다. 로그인 사용자는 `user_id` 설정 명령을 먼저 보내고, 비로그인 성공 결과와 조회 오류는 `user_id: null`로 전송한다.
- 세션 조정을 생략하는 `/login`, `/login/*`, `/auth/callback`, `/auth/callback/*`은 쿼리를 기다리지 않고 익명 페이지뷰를 전송한다.
- 세션 확인 중 경로가 여러 번 바뀌면 준비 완료 시점의 최신 경로만 전송하고 기술적 중간 화면은 집계하지 않는다.
- 현재 페이지와 같은 출처의 리퍼러는 정규화된 내부 경로를 보존하고, 외부 HTTP(S) 리퍼러는 `https://host[:port]/` 형식의 출처 루트만 보존한다. 외부 사용자 정보, 경로, 쿼리, 해시는 보내지 않는다.
- 비 HTTP(S) 또는 파싱할 수 없는 리퍼러는 `page_referrer`에서 생략한다.
- `page_location`에는 표준 UTM 캠페인 파라미터만 허용한다. 그 밖의 쿼리와 모든 해시는 제거하며, `page_path`와 `page_referrer`에는 쿼리를 포함하지 않는다.
- 동적 경로는 다음과 같이 낮은 카디널리티의 템플릿으로 전송한다.

| 실제 경로 | GA 전송 경로 |
| --- | --- |
| `/join/{초대코드}` | `/join/[inviteCode]` |
| `/plan/{방 ID}` | `/plan/[roomId]` |
| `/bookmark/{폴더 ID}` | `/bookmark/[folderId]` |

## 리퍼러와 캠페인 수집 정책

도메인 기반 유입 출처는 외부 리퍼러의 origin으로 분석한다. 외부 페이지의 세부 경로는 유입 도메인 판정에 필요하지 않으므로 수집하지 않는다.

현재 페이지의 `page_location`에는 GA4 수동 캠페인 분석에 사용하는 `utm_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_source_platform`, `utm_term`, `utm_content`, `utm_creative_format`, `utm_marketing_tactic`만 허용한다. 검색어, 초대 코드, 방 이름 등 그 밖의 쿼리와 모든 해시는 제거한다. `page_path`와 `page_referrer`는 캠페인 파라미터를 포함하지 않는다.

운영자가 만드는 UTM 값에는 이름, 이메일, 전화번호, 검색어 등 개인을 식별하거나 사용자가 입력한 값을 넣지 않는다. 허용 키를 추가하려면 실제 분석 목적과 개인정보 처리방침의 수집 범위를 먼저 검토한다.

## 배포 환경 변수

프로덕션에는 운영 데이터 스트림의 측정 ID만 설정한다.

```dotenv
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

로컬 또는 스테이징에서 DebugView를 확인할 때만 별도 테스트 데이터 스트림의 ID와 디버그 모드를 함께 설정한다.

```dotenv
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-DEBUGXXXXX
NEXT_PUBLIC_GA_DEBUG_MODE=true
```

`NEXT_PUBLIC_GA_DEBUG_MODE=true`는 프로덕션이 아니어도 분석을 활성화하고 gtag 설정에 `debug_mode: true`를 추가한다. 운영 데이터 스트림에 디버그 트래픽을 보내지 않는다.

## 분석 동의 변경 및 철회

우때는 기본 동의 모드를 사용한다. 선택 전과 거부 상태에서는 gtag.js를 로드하거나 쿠키 없는 분석 핑을 보내지 않는다.

- 공개 `/privacy-settings`에서 로그인 여부와 관계없이 현재 선택을 확인하고 변경할 수 있다.
- `analytics_storage`만 사용자 선택에 따라 바뀐다.
- `ad_storage`, `ad_user_data`, `ad_personalization`은 항상 `denied`다.
- 철회하면 `user_id`를 `null`로 초기화하고 분석 저장소를 거부한 뒤 `_ga`, `_ga_*` 쿠키 삭제를 시도한다.
- 기존 `granted`, `denied`는 v1 선택으로 인정하며 다음 변경부터 `v1:granted`, `v1:denied`로 저장한다.
- 수집 목적, 제공자, 데이터 범위처럼 동의의 의미가 중대하게 바뀔 때만 정책 버전을 올리고 재동의를 받는다.

## GA 관리자 설정

### 1. 자동 페이지뷰 끄기

관리자 → 데이터 스트림 → 웹 스트림 → 향상된 측정 → 페이지 조회의 고급 설정에서 다음 항목을 끈다.

- 페이지 로드 기반 페이지뷰
- 브라우저 기록 변경 기반 페이지뷰

코드가 수동 `page_view`를 전송하므로 둘 중 하나라도 켜져 있으면 페이지뷰가 중복될 수 있다. 설정 변경 후 실시간 보고서에서 한 번의 화면 이동에 `page_view`가 한 번만 발생하는지 확인한다.

### 2. 사이트 검색 자동 수집 끄기

관리자 → 데이터 스트림 → 웹 스트림 → 향상된 측정에서 `사이트 검색`을 끈다.

우때는 검색 결과가 확정된 시점에 `view_search_results`를 Amplitude에만 전송하며, 검색어 원문은 보내지 않는다. GA4 사이트 검색 자동 수집이 켜져 있으면 `/search?q=...`의 `q` 값이 `search_term`으로 별도 수집되어 목적지·개인정보 정책을 벗어날 수 있다.

Amplitude로 보내는 검색 이벤트에는 다음 파라미터만 허용한다.

- `search_mode`: `text` 또는 `map_recenter`
- `result_count_bucket`: `0`, `1_5`, `6_20`, `21_plus`

데이터 가림 대상의 `q`는 설정 누락에 대비한 이중 방어로 유지한다. 데이터 가림만으로 자동 생성된 `search_term` 파라미터의 부재를 보장한다고 간주하지 않는다.

### 3. 맞춤 측정기준 등록

아래 이벤트 파라미터를 이벤트 범위 맞춤 측정기준으로 등록한다. 이름은 팀이 읽기 쉬운 표시명을 써도 되지만 이벤트 파라미터 값은 표와 정확히 일치시킨다.

| 이벤트 파라미터 | 용도 |
| --- | --- |
| `entry_point` | 직접 진입/초대 진입 |
| `item_count_bucket` | 일정 항목 수 구간 |
| `member_count_bucket` | 참여 인원 수 구간 |
| `method` | 로그인·공유 방식 |
| `place_category` | 장소 카테고리 |
| `role` | 방 역할 |
| `interaction_source` | 제품 내부 상호작용 출처 |
| `trip_days_bucket` | 여행 일수 구간 |

`user_id`는 GA의 전용 User-ID 기능으로만 사용하고 맞춤 측정기준으로 등록하지 않는다.

`message_type`, `rank_bucket`, `result_count_bucket`, `search_mode`, `tutorial_version`, `skip_step`은 이제 Amplitude 전용 이벤트의 속성이다. GA4에 신규 등록하지 않으며 기존 정의는 과거 보고서 의존성을 확인한 뒤 정리한다. 랜딩 맞춤 속성은 [랜딩 이벤트](landing-events.md)를 따른다.

### 4. 주요 이벤트 지정

전환 퍼널에 직접 쓰는 다음 이벤트를 주요 이벤트로 지정한다.

- `sign_up`
- `create_plan`
- `join_group`
- `add_to_itinerary`

로그인과 조회 이벤트는 진단·퍼널 보조 지표로 유지하고, 캠페인 목적이 정해지기 전에는 주요 이벤트로 과도하게 지정하지 않는다.

### 5. 데이터 삭제 및 필터

웹 스트림의 데이터 삭제 설정에 다음 쿼리 파라미터를 등록한다. 프런트엔드 정규화가 누락되더라도 원문이 보고서에 남지 않게 하는 방어선이다.

`q`, `inviteCode`, `roomId`, `roomTitle`, `code`, `state`, `error`, `reacceptanceToken`

필터는 테스트 상태에서 실제 분류를 검증한 뒤 활성화한다.

- 개발자 트래픽: `debug_mode`가 설정된 이벤트 제외
- 내부 트래픽: 사무실·운영자 IP 규칙을 정의하고 내부 트래픽 제외

필터를 활성화하면 과거 데이터에는 소급 적용되지 않으므로 테스트 결과와 활성화 일자를 운영 기록에 남긴다.

### 6. 보관 및 개인정보 설정

- 이벤트 데이터 보관 기간을 제품 분석에 필요한 기간으로 선택하고 결정 근거·담당자·검토일을 기록한다.
- Google Signals와 광고 개인 최적화는 사용 목적, 동의 문구, 개인정보 처리방침 검토가 끝난 경우에만 활성화한다.
- 개인정보 처리방침에는 제공자, 수집 목적, User-ID 사용, 보관 기간, 국외 처리, 동의 철회 방법이 실제 운영과 일치하는지 확인한다.

## 배포 전 검증

1. 선택 전에는 gtag.js 요청, `window.gtag`, GA 이벤트가 없는지 확인한다.
2. 허용하면 Consent Mode 명령이 `default denied → analytics_storage granted → config` 순서인지 확인한다.
3. `/privacy-settings`에서 거부하면 User-ID가 초기화되고 추가 `page_view`와 일반 이벤트가 중단되는지 확인한다.
4. 철회 후 `_ga`, `_ga_*` 쿠키가 제거되고 새로고침 뒤 `v1:denied`가 유지되는지 확인한다.
5. 다시 허용하면 `config`와 현재 페이지뷰가 중복되지 않고 추적이 재개되는지 확인한다.
6. 홈 프로필 메뉴와 메인 사이드바에서 키보드로 개인정보 설정에 진입할 수 있는지 확인한다.
7. 분석 쿠키가 없거나 거부 상태일 때 gtag.js 요청과 GA 이벤트가 없는지 확인한다.
8. 로그인 상태로 일반 경로에 진입해 `set user_id → page_view` 순서이며 첫 화면의 `page_view`가 한 번만 발생하는지 확인한다.
9. 비로그인 상태로 일반 경로에 진입해 세션 확인 뒤 `user_id: null → page_view` 순서로 한 번만 발생하는지 확인한다.
10. `/login`과 `/auth/callback`에서 세션 확인을 기다리지 않고 익명 `page_view`가 한 번만 발생하는지 확인한다.
11. 세션 확인 중 빠르게 리다이렉트되면 중간 경로는 없고 최종 경로의 `page_view`만 한 번 발생하는지 확인한다.
12. `/?utm_source=newsletter&utm_medium=email&utm_campaign=launch`로 진입해 `page_location`에 세 값이 있고 획득 보고서에 반영되는지 확인한다.
13. `/search?q=secret`, `/join/secret`, `/plan/123`, `/bookmark/456`을 이동해 GA 요청에 원문 값이 없는지 확인한다.
14. 스테이징 DebugView에서 `sign_up`, `create_plan`, `join_group`, `share`, `add_to_itinerary`, `expense_created`, `packing_item_added`와 공통 파라미터를 확인한다.
15. 텍스트 검색과 지도 재검색을 각각 한 번 실행해 `view_search_results`가 Amplitude에만 한 번 발생하고 GA4에는 없는지 확인한다. 튜토리얼·채팅·세부 편집도 GA4로 전달되지 않는지 확인한다.
16. DebugView와 `google-analytics.com/g/collect` 요청에 `search_term`, 검색어 원문, `q=<원문>`이 없는지 확인한다.
17. 개발자·내부 트래픽 필터가 운영 보고서에서 의도대로 제외되는지 확인한다.
18. 미선택 또는 거부 상태에서 페이지뷰, User-ID, 일반 이벤트 호출 경로와 중앙 데이터 명령을 직접 실행해도 `dataLayer`에 데이터 명령이 추가되지 않고, 이후 허용해도 이전 명령이 되살아나지 않는지 확인한다.
19. 같은 출처 화면 이동의 `page_referrer`에는 정규화된 내부 경로가 남고, 외부 HTTP(S) 유입에는 출처 루트만 남는지 `page_view` 페이로드에서 확인한다.
20. 외부 리퍼러의 사용자 정보·경로·쿼리·해시와 `mailto:`, `ftp:` 등 비 HTTP(S) 리퍼러가 `page_view` 페이로드에 없는지 확인한다.
21. UTM과 임의 쿼리가 함께 포함된 URL로 진입해 `page_location`에는 허용된 UTM만 있고 `page_path`, `page_referrer`에는 쿼리가 없는지 확인한다.

## Amplitude와 역할 분담

GA4는 유입·캠페인별 주요 성과의 기준 도구다. [이벤트 규약](amplitude-tracking-plan.md)의 공통 이벤트와 랜딩 이벤트만 수신한다. 탐색·편집·채팅·튜토리얼 등 제품 세부 행동은 Amplitude에서 분석한다. 이벤트 전송은 `event-destinations.ts`에서 결정하며 화면별 SDK 직접 호출을 추가하지 않는다.

공통 이벤트를 모두 주요 이벤트로 지정하지 않는다. 초기 후보는 `sign_up`, `create_plan`, `join_group`, `add_to_itinerary`이며 실제 운영 지정은 GA4에서 별도로 한다. `expense_created`, `packing_item_added`는 유입별 기능 사용을 비교하는 데 사용할 수 있다. 코드 변경은 보고서/주요 이벤트 설정을 자동 변경하지 않는다.

기존 세부 행동 이벤트는 목적지 분리 배포 이후 GA4 신규 수집이 중단된다. 해당 기능 분석은 Amplitude로 옮기고 과거 구간과 비교할 때 실제 배포일을 표시한다. 동의·차단·집계 정의가 다른 양 도구의 사용자/세션 수를 무조건 동일한 값으로 취급하지 않는다.

`share`와 `join_group` 이벤트는 계속 공통 수집하지만 방 식별자인 `room_id` 및 Amplitude 그룹 정보는 GA4에 전송하지 않는다. 방 ID를 맞춤 측정기준으로 등록하지 않는다.
