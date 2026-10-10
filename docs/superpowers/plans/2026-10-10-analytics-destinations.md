# 분석 이벤트 전송 대상과 가계부·준비물 계측

## 승인된 범위

사용자와 합의한 기능별 분류를 적용한다. 공통 성과 이벤트는 GA4와 Amplitude, 제품 세부 행동은 Amplitude, 랜딩 세부 행동은 GA4로 보낸다. 기존 ID·동의·환경 분리·URL 정규화 정책을 유지한다.

우선 추가 이벤트는 expense_created, expense_updated, expense_deleted, expense_budget_saved, settlement_summary_viewed, packing_item_added, packing_item_checked, packing_item_unchecked이다. 나머지 CRUD와 필터 이벤트는 후속 후보이며 이번 구현에 포함하지 않는다. 운영 대시보드 설정과 배포는 범위 밖이다.

## 구현 순서

- [x] 중앙 이벤트 전송 정책을 타입으로 완전하게 정의한다. client.ts에서 동의 검사 후 목적지를 선택하고 GA 큐에 Amplitude 전용 이벤트가 들어가지 않게 한다. 사용자 ID와 page_view는 공통으로 유지한다.
- [x] 실제 클라이언트 경로를 사용하는 테스트로 목적지, 큐 재생 중복, 동의 거절·철회, 한 SDK 비활성화, 알 수 없는 이벤트 차단을 검증한다.
- [x] ExpenseProvider의 성공한 본인 mutation에 생성·수정·삭제·예산 저장을 계측한다. 후속 조회 실패는 이미 성공한 작업의 이벤트를 취소하지 않는다. 정산 조회는 요약이 열린 상태에서 실제 성공 데이터가 표시될 때 열기당 한 번 보낸다.
- [x] PackingCoordinator의 확정된 본인 쓰기 성공에 항목 추가·체크·해제를 계측한다. 낙관적 갱신·초기화·읽기·실패·중복 클릭·해제된 scope는 이벤트를 만들지 않는다.
- [x] AGENTS.md와 analytics 문서에 목적지 표, 성공 기준, 개인정보 최소화, 사용자/여행방 분석 구분, 후속 후보를 기록한다.
- [x] 관련 테스트, 타입 검사, 변경 파일 lint, 전체 테스트와 diff를 확인하고 커밋한다.

## 인터페이스 및 검증 기준

새 이벤트 상수: AnalyticsEvents.expenseCreated / expenseUpdated / expenseDeleted / expenseBudgetSaved / settlementSummaryViewed / packingItemAdded / packingItemChecked / packingItemUnchecked. 속성은 우선 undefined로 두어 금액·메모·준비물 이름·방/항목 식별자를 전송하지 않는다. 공통 정규화 URL만 기존 trackAnalyticsEvent가 추가한다.

목적지 map은 AnalyticsEventName 및 page_view를 전부 포함하며 임의 이벤트의 기본 양쪽 전송을 허용하지 않는다. 화면은 trackAnalyticsEvent를 한 번 호출한다. 테스트는 SDK나 외부 전송 경계만 모킹하며 실제 mutation/코디네이터/전송 분기를 검증한다.

## 주의할 실패 모드

- GA 초기화 전 Amplitude 전용 이벤트가 GA 큐에 들어가지 않아야 한다.
- 동의 철회 후 큐 재생이나 과거 행동 보충 수집이 없어야 한다.
- 브로드캐스트·백그라운드 읽기는 작성 이벤트로 집계하지 않는다.
- 성공 응답 후 요약 재조회 실패가 이미 저장된 행동을 누락시키지 않는다.
- 정산 요약의 로딩·오류·재렌더·재조회는 중복 조회 이벤트를 만들지 않는다.
- 준비물의 scope 해제 또는 상태가 바뀌지 않은 체크는 성공 이벤트를 만들지 않는다.

## 실행 기록

합의된 설계와 작업 진행 요청을 승인으로 사용하여 추가 승인 단계 없이 진행한다. 가계부와 준비물은 별도 파일에 계측하므로 독립적으로 구현·검증할 수 있다.

검증 완료: 목적지 라우팅, 본인 쓰기 성공/실패, 동의 철회, 정산 조회 중복, 세션 변경과 왕복 전환 회귀를 확인했다. 전체 테스트·타입 검사·변경 파일 린트·문서 목적지 대조·diff 검사를 통과했다. 코드 리뷰에서 발견한 늦은 응답 귀속 및 왕복 전환 후 누락 문제를 회귀 테스트와 함께 수정했다. 운영 계정 수신/대시보드와 배포 검증은 별도다.
