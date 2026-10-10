# GA4·Amplitude 이벤트 규약

## 기준 소스

- 이벤트 이름과 속성 타입: `src/lib/analytics/track.ts`
- 버킷과 페이지 조회 타입: `src/lib/analytics/context.ts`
- 전송 대상: `src/lib/analytics/event-destinations.ts`
- 전송 경로: `src/lib/analytics/client.ts`

이 문서는 운영과 분석을 위한 설명서다. 이름·속성은 TypeScript 타입, 목적지는 `event-destinations.ts`가 코드 기준이다. 분석 동의 후 공통 이벤트는 같은 이름·속성으로 양쪽에, 세부 제품 행동은 Amplitude에, 랜딩 행동은 GA4에 전송한다. 신규 이벤트도 목적에 따라 분류하며 미등록 이벤트는 전송하지 않는다. GA4는 유입별 성과, Amplitude는 사용 과정·활성화·재사용의 기준 도구다. 공통 전송 여부와 GA4 주요 이벤트 지정은 별개다.

## 데이터 원칙

- 이벤트 이름과 속성 이름은 `snake_case`를 사용한다.
- 검색어 원문, 채팅 메시지 원문, 사용자 이름·이메일, 여행 제목, 초대 코드, 장소 ID는 이벤트 속성으로 보내지 않는다.
- 수량과 순위는 가능한 한 아래의 고정 버킷으로 보낸다.
- `undefined`, 빈 문자열, `null` 속성은 전송 전에 제거한다.
- 모든 제품 이벤트에는 동적 식별자와 쿼리·해시를 제거한 `page_path`, `page_location`을 공통으로 추가한다.
- 새 이벤트나 속성을 추가할 때 타입·목적지·테스트·이 문서를 함께 갱신한다. 운영 Amplitude Tracking Plan과 보고서도 반영해야 하며, 코드 변경만으로 원격 설정이 갱신되지는 않는다.
- 속성 의미를 바꾸지 않는다. 의미가 달라지면 새 속성 또는 새 이벤트 이름을 사용한다.

## 제품 이벤트

| 이벤트 | 발생 조건 | 필수 속성 | 선택 속성 | 전송 대상 |
| --- | --- | --- | --- | --- |
| `sign_up` | Google 신규 가입 흐름이 성공했을 때 | `entry_point`, `method=google` | 없음 | 공통 |
| `login` | Google 기존 사용자 로그인이 성공했을 때 | `entry_point`, `method=google` | 없음 | 공통 |
| `create_bookmark_folder` | 북마크 폴더 생성 요청이 성공했을 때 | 없음 | 없음 | Amplitude |
| `add_to_bookmark` | 장소가 하나 이상 북마크에 추가됐을 때 | 없음 | `interaction_source`, `place_category` | 공통 |
| `create_plan` | 여행 계획 생성 요청이 성공했을 때 | `entry_point` | `trip_days_bucket` | 공통 |
| `view_plan` | 사용자가 새로운 계획 상세를 조회했을 때 | `member_count_bucket` | `role` | 공통 |
| `invite_view` | 초대 진입 페이지가 조회됐을 때 | `entry_point` | 없음 | 공통 |
| `join_group` | 즉시 참가 또는 참가 승인 완료로 계획에 합류했을 때 | 없음 | `member_count_bucket`, `role` | 공통 |
| `view_place` | 사용자가 새로운 장소 상세를 조회했을 때 | 없음 | `interaction_source`, `place_category`, `rank_bucket` | Amplitude |
| `add_to_itinerary` | 장소가 일정에 추가됐을 때 | `interaction_source`, `item_count_bucket` | `place_category` | 공통 |
| `remove_from_itinerary` | 장소가 일정에서 제거됐을 때 | `item_count_bucket` | 없음 | Amplitude |
| `reorder_itinerary` | 드래그 앤 드롭 일정 재정렬이 반영됐을 때 | `item_count_bucket`, `method=drag_drop` | 없음 | Amplitude |
| `view_search_results` | 새로운 검색 결과 세대가 화면에 반영됐을 때 | `result_count_bucket`, `search_mode` | 없음 | Amplitude |
| `share` | 초대 링크 복사 또는 네이티브 공유가 성공했을 때 | `method` | `member_count_bucket`, `role` | 공통 |
| `chat_message_sent` | 텍스트·AI·장소 채팅 전송 액션이 실행됐을 때 | `message_type` | 없음 | Amplitude |
| `tutorial_begin` | 사이드바 튜토리얼이 처음 시작됐을 때 | `tutorial_version=sidebar_v1` | 없음 | Amplitude |
| `tutorial_complete` | 사이드바 튜토리얼의 마지막 단계를 완료했을 때 | `tutorial_version=sidebar_v1` | 없음 | Amplitude |
| `tutorial_skip` | 사용자가 사이드바 튜토리얼을 중간에 닫았을 때 | `skip_step`, `tutorial_version=sidebar_v1` | 없음 | Amplitude |
| `expense_created` | 본인 지출 생성 응답 성공 | 없음 | 없음 | 공통 |
| `expense_updated` | 본인 지출 수정 응답 성공 | 없음 | 없음 | Amplitude |
| `expense_deleted` | 본인 지출 삭제 응답 성공 | 없음 | 없음 | Amplitude |
| `expense_budget_saved` | 본인 예산 저장 응답 성공(예산 해제 포함) | 없음 | 없음 | Amplitude |
| `settlement_summary_viewed` | 정산 요약을 열고 성공한 조회 데이터가 실제 표시됐을 때, 열기당 한 번 | 없음 | 없음 | Amplitude |
| `packing_item_added` | 개인 준비물 항목 추가 응답 성공 | 없음 | 없음 | 공통 |
| `packing_item_checked` | 본인 체크 요청 응답으로 미완료 → 완료가 확정됐을 때 | 없음 | 없음 | Amplitude |
| `packing_item_unchecked` | 본인 체크 요청 응답으로 완료 → 미완료가 확정됐을 때 | 없음 | 없음 | Amplitude |

준비물 체크는 상태가 실제로 바뀐 경우만 기록한다. 자동 목록 초기화, 읽기, 낙관적 변경, 실패·불확실한 응답, 중복·차단 요청은 포함하지 않는다. 가계부/준비물 쓰기는 성공 응답 뒤 후속 조회가 실패해도 집계하되, 계정·방·권한이 바뀐 뒤의 응답을 다른 사용자에게 귀속하지 않는다. 브로드캐스트 수신자의 이벤트는 만들지 않는다.

정산 요약 조회는 버튼 클릭이나 로딩·오류가 아니라 성공 데이터 표시를 뜻한다. 열린 동안 재렌더·재조회로 중복하지 않으며 닫았다 다시 열면 새 조회다. 송금·정산 완료 이벤트는 구현하지 않는다. `chat_message_sent`도 서버 저장·AI 응답 성공으로 해석하지 않는다.

## 시스템 이벤트

| 이벤트 | 발생 조건 | 필수 속성 | 선택 속성 |
| --- | --- | --- | --- |
| `page_view` | 동의 후 SPA의 정규화된 라우트가 변경됐을 때 | `page_location`, `page_path`, `page_title` | `page_referrer` |

`page_view`는 공통 전송한다. Amplitude 기본 page view autocapture는 중복을 막기 위해 비활성화한다.

## 랜딩 이벤트

`cta_click`, `section_view`는 GA4 전용이다. 속성과 발생 기준은 [랜딩 이벤트](landing-events.md)를 따른다. Amplitude에는 전달하지 않으며 GA 초기화 대기열만 사용한다.

## 허용 값

| 속성 | 허용 값 |
| --- | --- |
| `entry_point` | `direct`, `invite` |
| `role` | `host`, `member` |
| `interaction_source` | `bookmark`, `chat`, `map`, `plan`, `search` |
| `method` (`share`) | `copy_link`, `native_share` |
| `method` (`reorder_itinerary`) | `drag_drop` |
| `message_type` | `ai`, `place`, `text` |
| `search_mode` | `map_recenter`, `text` |
| `skip_step` | `1`, `2`, `3`, `4`, `5` |
| `tutorial_version` | `sidebar_v1` |

## 버킷 정의

| 속성 | 허용 값 |
| --- | --- |
| `item_count_bucket` | `0`, `1`, `2_3`, `4_7`, `8_plus` |
| `member_count_bucket` | `0`, `1`, `2`, `3_4`, `5_plus` |
| `result_count_bucket` | `0`, `1_5`, `6_20`, `21_plus` |
| `rank_bucket` | `1_3`, `4_10`, `11_plus` |
| `trip_days_bucket` | `1`, `2_3`, `4_7`, `8_plus` |

## 검증 체크리스트

1. 이벤트 이름이 `AnalyticsEvents`에 존재하는지 확인한다.
2. 필수·선택 속성과 허용 값이 `AnalyticsEventParamsMap`과 일치하는지 확인한다.
3. 원문 콘텐츠나 직접 식별자가 속성에 포함되지 않았는지 확인한다.
4. Development 프로젝트에서 이벤트와 사용자 ID 연결을 확인한다.
5. 동일 사용자 액션에서 이벤트가 한 번만 발생하는지 확인한다.
6. 대시보드나 퍼널에서 사용하는 이벤트를 삭제·변경하기 전에 영향 범위를 확인한다.

## 후속 후보와 분석 단위

이번 구현은 위 이벤트로 제한한다. 가계부 필터, 준비물 이름·메모·삭제·카테고리 관리, 일정 시간·날짜·이동수단 변경, 일차 관리, 북마크 이동/삭제, 여행·멤버 관리의 세부 이벤트는 아직 추가하지 않았다. 분석 질문이 생기면 Amplitude 전용 후보로 검토한다. 원문 속성은 추가하지 않는다.

개인 활성화는 생성자 `create_plan → add_to_itinerary`, 초대 참여자 `invite_view → join_group → view_plan`처럼 분리한다. 방장의 `share`와 다른 사람의 `join_group`을 기본 사용자 퍼널로 연결하지 않는다. 여행방 전환율은 그룹 계측/계약 또는 백엔드 집계가 별도로 필요하다. 준비물은 여행방 공동 작업이 아닌 개인 사용이다.
