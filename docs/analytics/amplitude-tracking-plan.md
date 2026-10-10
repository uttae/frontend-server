# GA4·Amplitude 이벤트 규약

## 기준 소스

- 이벤트 이름과 속성 타입: `src/lib/analytics/track.ts`
- 버킷과 페이지 조회 타입: `src/lib/analytics/context.ts`
- 전송 대상: `src/lib/analytics/event-destinations.ts`
- 방 그룹 허용 범위: `src/lib/analytics/room-events.ts`
- 전송 경로: `src/lib/analytics/client.ts`

이 문서는 운영과 분석을 위한 설명서다. 이름·속성은 TypeScript 타입, 목적지는 `event-destinations.ts`가 코드 기준이다. 분석 동의 후 공통 이벤트는 같은 이름으로 양쪽에, 세부 제품 행동은 Amplitude에, 랜딩 행동은 GA4에 전송한다. 신규 이벤트도 목적에 따라 분류하며 미등록 이벤트는 전송하지 않는다. GA4는 유입별 성과, Amplitude는 사용 과정·활성화·재사용의 기준 도구다. 공통 전송 여부와 GA4 주요 이벤트 지정은 별개다. 모든 `room_id`와 그룹 정보는 Amplitude 전용이며 GA4로 보내지 않는다.

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
| `create_bookmark_folder` | 북마크 폴더 생성 요청이 성공했을 때 | `room_id` (Amplitude만) | 없음 | Amplitude |
| `add_to_bookmark` | 장소가 하나 이상 북마크에 추가됐을 때 | `room_id` (Amplitude만) | `interaction_source`, `place_category` | 공통 |
| `create_plan` | 여행 계획 생성 요청이 성공했을 때 | `entry_point`, `room_id` (Amplitude만) | `trip_days_bucket` | 공통 |
| `view_plan` | 사용자가 새로운 계획 상세를 조회했을 때 | `member_count_bucket`, `room_id` (Amplitude만) | `role` | 공통 |
| `invite_view` | 초대 진입 페이지가 조회됐을 때 | `entry_point` | 없음 | 공통 |
| `join_group` | 즉시 참가 또는 참가 승인 완료를 클라이언트가 확인했을 때 | `room_id` (Amplitude만) | `member_count_bucket`, `role` | 공통 |
| `view_place` | 사용자가 새로운 장소 상세를 조회했을 때 | 없음 | `interaction_source`, `place_category`, `rank_bucket`, `room_id` (확정된 방만, Amplitude) | Amplitude |
| `add_to_itinerary` | 장소가 일정에 추가됐을 때 | `interaction_source`, `item_count_bucket`, `room_id` (Amplitude만) | `place_category` | 공통 |
| `remove_from_itinerary` | 장소가 일정에서 제거됐을 때 | `item_count_bucket`, `room_id` (Amplitude만) | 없음 | Amplitude |
| `reorder_itinerary` | 드래그 앤 드롭 일정 재정렬이 반영됐을 때 | `item_count_bucket`, `method=drag_drop`, `room_id` (Amplitude만) | 없음 | Amplitude |
| `view_search_results` | 새로운 검색 결과 세대가 화면에 반영됐을 때 | `result_count_bucket`, `search_mode` | `room_id` (확정된 방만, Amplitude) | Amplitude |
| `share` | 초대 링크 복사 또는 네이티브 공유가 성공했을 때 | `method`, `room_id` (Amplitude만) | `member_count_bucket`, `role` | 공통 |
| `invite_code_issued` | 본인의 명시적 초대 코드 발급·재발급 POST 성공 | `room_id`, `role` | 없음 | Amplitude |
| `room_info_updated` | 본인의 방 정보 PATCH 성공 | `room_id`, `role` | 없음 | Amplitude |
| `chat_message_sent` | 텍스트·AI·장소 채팅 전송 액션이 실행됐을 때 | `message_type`, `room_id` (Amplitude만) | 없음 | Amplitude |
| `tutorial_begin` | 사이드바 튜토리얼이 처음 시작됐을 때 | `tutorial_version=sidebar_v1` | `room_id` (확정된 방만, Amplitude) | Amplitude |
| `tutorial_complete` | 사이드바 튜토리얼의 마지막 단계를 완료했을 때 | `tutorial_version=sidebar_v1` | `room_id` (확정된 방만, Amplitude) | Amplitude |
| `tutorial_skip` | 사용자가 사이드바 튜토리얼을 중간에 닫았을 때 | `skip_step`, `tutorial_version=sidebar_v1` | `room_id` (확정된 방만, Amplitude) | Amplitude |
| `expense_created` | 본인 지출 생성 응답 성공 | `room_id` (Amplitude만) | 없음 | 공통 |
| `expense_updated` | 본인 지출 수정 응답 성공 | `room_id` (Amplitude만) | 없음 | Amplitude |
| `expense_deleted` | 본인 지출 삭제 응답 성공 | `room_id` (Amplitude만) | 없음 | Amplitude |
| `expense_budget_saved` | 본인 예산 저장 응답 성공(예산 해제 포함) | `room_id` (Amplitude만) | 없음 | Amplitude |
| `settlement_summary_viewed` | 정산 요약을 열고 성공한 조회 데이터가 실제 표시됐을 때, 열기당 한 번 | `room_id` (Amplitude만) | 없음 | Amplitude |
| `packing_item_added` | 개인 준비물 항목 추가 응답 성공 | `room_id` (Amplitude만) | 없음 | 공통 |
| `packing_item_checked` | 본인 체크 요청 응답으로 미완료 → 완료가 확정됐을 때 | `room_id` (Amplitude만) | 없음 | Amplitude |
| `packing_item_unchecked` | 본인 체크 요청 응답으로 완료 → 미완료가 확정됐을 때 | `room_id` (Amplitude만) | 없음 | Amplitude |

준비물 체크는 상태가 실제로 바뀐 경우만 기록한다. 자동 목록 초기화, 읽기, 낙관적 변경, 실패·불확실한 응답, 중복·차단 요청은 포함하지 않는다. 가계부/준비물 쓰기는 성공 응답 뒤 후속 조회가 실패해도 집계하되, 계정·방·권한이 바뀐 뒤의 응답을 다른 사용자에게 귀속하지 않는다. 브로드캐스트 수신자의 이벤트는 만들지 않는다.

정산 요약 조회는 버튼 클릭이나 로딩·오류가 아니라 성공 데이터 표시를 뜻한다. 열린 동안 재렌더·재조회로 중복하지 않으며 닫았다 다시 열면 새 조회다. 송금·정산 완료 이벤트는 구현하지 않는다. `chat_message_sent`도 서버 저장·AI 응답 성공으로 해석하지 않는다.

## 시스템 이벤트

| 이벤트 | 발생 조건 | 필수 속성 | 선택 속성 |
| --- | --- | --- | --- |
| `page_view` | 동의 후 라우트가 변경되거나 같은 방 화면에서 실제 대상 방이 바뀌었을 때 | `page_location`, `page_path`, `page_title` | `page_referrer`, `room_id` (확정된 방만, Amplitude) |

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
3. 원문 콘텐츠·초대 코드·사용자 직접 식별자가 포함되지 않고, 승인된 `room_id`는 Amplitude에만 전달되는지 확인한다.
4. Development 프로젝트에서 이벤트와 사용자 ID 연결을 확인한다.
5. 동일 사용자 액션에서 이벤트가 한 번만 발생하는지 확인한다.
6. 대시보드나 퍼널에서 사용하는 이벤트를 삭제·변경하기 전에 영향 범위를 확인한다.

## 후속 후보와 분석 단위

이번 구현은 위 이벤트로 제한한다. 가계부 필터, 준비물 이름·메모·삭제·카테고리 관리, 일정 시간·날짜·이동수단 변경, 일차 관리, 북마크 이동/삭제, 이번 명시적 초대 코드 발급·재발급과 방 정보 저장을 제외한 여행·멤버 관리의 세부 이벤트는 아직 추가하지 않았다. 분석 질문이 생기면 Amplitude 전용 후보로 검토한다. 원문 속성은 추가하지 않는다.

개인 활성화는 생성자 `create_plan → add_to_itinerary`, 초대 참여자 `invite_view → join_group → view_plan`처럼 분리한다. 공유자(HOST 또는 MEMBER)의 `share`와 다른 사람의 `join_group`을 기본 사용자 퍼널로 연결하지 않는다. 여행방에 속한 기능 이벤트에 이벤트별 여행방 그룹 계측을 적용했다. Amplitude 그룹 보고 기능의 계약/활성화와 퍼널 구성은 별도로 필요하다. 준비물은 여행방 공동 작업이 아닌 개인 사용이다.

## 여행방 단위 그룹 분석

- 여행방에 속한 이벤트는 기존 여행방 ID를 `room_id` 속성과 `groups: { room_id: "기존 방 ID" }`로 Amplitude에 보낸다. 그룹은 이 이벤트에만 적용하며 `setGroup`으로 사용자의 모든 행동을 방에 귀속하지 않는다.
- `share`: 공유한 패널이 받은 방 ID를 사용한다. 현재 선택한 전역 방이나 초대 코드에서 유추하지 않는다.
- `join_group`: 즉시 참여와 승인 대기 완료 모두 서버 응답의 `id`를 사용한다. 추가 방 정보 조회가 실패해도 응답의 방 ID는 유지한다.
- `invite_view`: 로그인 전에는 방 ID를 알 수 없어 기존 상태를 유지한다. 초대 코드를 ID로 대체하지 않는다.
- GA4로 보내거나 GA 대기열에 넣기 전에 `room_id`를 제거한다. 양 도구의 사용자 ID는 계속 실제 사용자 ID다. URL 정규화 정책도 유지한다.
- Amplitude Accounts 그룹 분석 사용 가능 여부를 확인하고 그룹 타입 `room_id`로 퍼널을 만든다. 전체 공유 퍼널의 1단계는 `share`이며 HOST와 MEMBER를 모두 포함한다. 역할별 비교는 `role=host`와 `role=member` 세그먼트로 나누고, 2단계는 `join_group` + `role=member`로 본다. 관찰 기간(예: 7일)은 보고서에 명시한다.
- 이 퍼널은 같은 방에서 공유 후 참여 완료가 관측됐다는 뜻이다. 특정 링크/공유자가 실제 합류를 유발했다는 증명은 아니며 `share`의 복사 성공도 전달 완료가 아니다.
- 현재 참여 API 응답에는 신규 멤버십 생성 여부/고유 참여 발생 ID가 없다. 클라이언트의 `join_group`만으로 기존 멤버 재진입과 신규 합류를 엄밀히 구분하거나 서버 기준으로 중복 제거할 수 없다. 정확한 신규 참여 전환율에는 백엔드의 멤버십 확정 이벤트가 추가로 필요하다.

### 방 ID를 정하는 기준

- 생성은 서버 응답의 새 방 ID, 조회는 표시한 방 데이터의 ID, 쓰기·채팅은 해당 요청/전송 대상 ID를 사용한다.
- 가계부는 프로바이더의 방, 준비물은 개인 목록 코디네이터의 방을 사용한다. 준비물 그룹은 해당 여행에서의 개인 사용을 나타내며 공동 편집 여부를 뜻하지 않는다.
- 검색은 결과 수신 시점의 선택 방이 아니라 검색 시작 당시 확정된 방을 사용한다. 장소 상세·튜토리얼·페이지 조회는 실제 방 화면 문맥에서만 지정한다.
- 홈·로그인·가입·초대 진입·개인정보 화면에 남아 있는 전역 선택 방을 자동으로 붙이지 않는다. 잘못되거나 아직 일치하지 않는 URL/선택 방은 그룹 문맥으로 확정하지 않는다.
- `setGroup`을 호출하지 않는다. 같은 사용자가 여러 방을 오가도 그룹은 각 이벤트에만 적용한다. 방과 무관한 이벤트는 중앙 허용 정책에서도 `room_id`를 제외한다.
- 이벤트 수집 목적지는 그대로다. 그룹 확대는 Amplitude의 방 단위 분석 문맥만 추가하며 GA4로 방 ID를 전달하지 않는다.

페이지 조회는 늦은 사용자/방 문맥 보충만으로 중복하지 않는다. 사용자 조회 오류/익명 상태의 기존 페이지뷰는 그룹 없이 유지하고, 실제로 화면의 대상 방이 바뀐 경우를 별도 조회로 센다. `/packing/{roomId}`도 다른 동적 경로와 같이 정규화하여 GA URL에 원본 방 ID가 남지 않게 한다.


## 멤버 초대 발급과 방 정보 수정

- 기존 초대 코드 발급·재발급 UI는 활성 HOST와 MEMBER가 사용한다. 조회·공유는 기존 코드를 유지하며, 명시적 POST 성공은 새 코드 발급/기존 코드 교체를 뜻한다. `invite_code_issued`는 두 경우를 포괄하며 최초 발급인지 재발급인지 추측하지 않는다. 코드 누락 시 자동 fallback은 이 이벤트로 세지 않는다.
- `room_info_updated`는 서버 PATCH 성공 직후, 캐시 갱신·후속 일정 재조회 전에 한 번 기록한다. 요청 실패·취소·연속 클릭으로 차단된 요청·재조회는 성공 이벤트가 아니다.
- 두 이벤트는 Amplitude 전용이며 기존 `room_id`와 이벤트별 `groups.room_id`를 사용한다. GA4로 보내지 않는다. `role`은 `host` 또는 `member`: 방 정보 수정은 서버 성공 응답의 실제 역할, 발급은 요청 시작 시 서버 조회 캐시에 있는 역할을 사용한다. 발급 응답에는 역할이 없으므로 서버 처리 순간의 역할을 재검증했다고 해석하지 않는다.
- 요청 시작과 성공 시 모두 분석 동의·로그인 문맥이 유효해야 한다. 대기 중 계정/선택 방 변경, 세션 종료, 알려진 멤버십 상실, 관련 캐시 제거, 동의 철회가 발생하면 원래 문맥으로 돌아와도 해당 요청의 이벤트를 보내지 않는다. 홈 카드처럼 다른 방을 대상으로 한 행동도 요청 인자의 방 ID를 사용한다.
- 초대 코드/링크, 여행 제목·여행지·날짜 원문은 보내지 않는다. 새 초대자 링크 조회 이벤트는 추가하지 않는다. 기존 `share`는 HOST와 MEMBER 모두 복사/공유 성공 후 기록하며 기존 의미를 유지한다.
