# 랜딩 이벤트 측정 명세

기존 `trackAnalyticsEvent` 공통 래퍼로 GA와 Amplitude에 전달한다. 공통 래퍼의 기존 정규화된 `page_path`, `page_location` 외에 아래 파라미터만 추가한다. 버전, 동적 URL, 사용자 식별자를 새로 추가하지 않는다.

## CTA

`cta_click`, `page_type=landing`. 세 링크 모두 `/login`으로 이동한다.

| 기존 위치 | cta_id | cta_position |
| --- | --- | --- |
| LandingHeader 로그인 | login | header |
| LandingHero 여행 시작하기 | start_trip | hero |
| LandingFinalCta 여행 시작하기 | start_trip | final |

렌더링/프리패치에는 전송하지 않는다. 기본 클릭과 Enter가 생성하는 네이티브 click을 동일한 핸들러에서 처리한다. keydown에는 별도 이벤트를 전송하지 않는다. 중간 버튼은 auxclick에서만 처리하고 오른쪽 버튼은 제외한다. 재클릭은 새 이벤트다. 기본 링크 이동, modifier, 새 탭 동작을 변경하지 않는다. 로그인 성공 이벤트가 아니다.

## 섹션

`section_view`, `page_type=landing`.

| section_id | 기존 컴포넌트/영역 |
| --- | --- |
| hero | LandingHero 전체 section |
| problem | ProblemAndSolution의 PROBLEM section |
| solution | ProblemAndSolution의 SOLUTION section |
| features | Features 전체 #features section (3개 article 통합) |
| devices | Devices의 PC/모바일 소개 section |
| travel_steps | TravelSteps 전체 #how-it-works section (4개 카드 통합) |
| final_cta | LandingFinalCta 전체 section |

헤더/푸터는 제외한다. 명시적인 `data-landing-section` 속성으로 연결하며 카피나 DOM 순서로 ID를 생성하지 않는다.

문서가 foreground(`visibilityState=visible`)이고 세로 가시 픽셀이 `0.5 × min(section 높이, viewport 높이)` 이상인 상태를 연속 1000ms 유지해야 한다. 세로 가시 픽셀은 `max(0, min(bottom, innerHeight) - max(top, 0))`이다. 0 높이는 제외한다. 뷰포트보다 긴 섹션도 이 기준으로 측정한다. 애니메이션 프레임의 실제 geometry, scroll, resize, 타이머 만료 시점에 재평가한다. 가림 요소/불투명도에 대한 시각적 주목도 측정은 아니다.

방문 ledger는 브라우저 문서의 모듈 상태다. 루트의 LandingSectionTracker가 동의 상태와 무관하게 모든 pathname 변경을 관찰한다. pathname이 바뀌면 ledger를 초기화한다. `/`에서 나갔다 돌아오거나 새로고침하면 새 방문이고 query/hash만 바뀌면 같은 방문이다. 컴포넌트 rerender/remount, StrictMode, 재스크롤은 이미 집계한 섹션을 반복하지 않는다. 타이머/프레임/리스너는 effect 수명에 묶여 cleanup 때 제거된다. 완료되지 않은 dwell은 remount에서 새로 시작한다.

pending/denied 이벤트는 저장/소급 전송하지 않는다. 동의 시 현재 보이는 섹션에서 새 1초를 시작한다. 백그라운드 전환, 기준 미달, 동의 철회는 시간을 초기화한다. 철회는 기존 공통 동의 액션을 통해 GA/Amplitude 대기열도 지운다. 재동의해도 같은 방문에서 이미 집계한 섹션은 반복하지 않는다.

GA 초기화 전 이벤트는 Amplitude에 최초 한 번 전달된 뒤 GA 전용 대기열에 들어간다. GA 초기화는 그 대기열을 GA에만 전달하여 Amplitude 중복 전송을 방지한다.

## 사람의 GA 관리 체크리스트

기존 등록을 먼저 조회하고 중복 등록하지 않는다. 필요하면 사람이 다음 **이벤트 범위** 맞춤 측정기준을 등록한다. 이 변경은 관리자 작업을 수행하지 않는다.

| 이벤트 파라미터 | 제안 표시명 | 범위 |
| --- | --- | --- |
| page_type | Page type | Event |
| section_id | Section ID | Event |
| cta_id | CTA ID | Event |
| cta_position | CTA position | Event |

주요 이벤트 승격은 포함하지 않는다. 로컬 테스트 sink의 호출 수는 실제 GA 수신 증거가 아니다. GA DebugView/Realtime, 실제 등록 상태는 별도 확인 대상이며 이번 로컬 검증에서 확인하지 않는다. 브라우저 검증은 Hermes가 담당한다.
