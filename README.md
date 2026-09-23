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


## 지출 데이터 동기화

지출은 `/topic/rooms/{roomId}/expenses`의 무효화 이벤트를 받으면 REST로 다시 조회합니다. `EXPENSES_INVALIDATED`는 지출 목록·통화별 요약·원화 요약을, `BUDGET_INVALIDATED`는 예산을 갱신합니다. 최초 진입과 STOMP 연결·재연결, 보이는 탭의 focus·visibilitychange에서는 참여자·통화 목록을 포함한 전체 지출 데이터를 다시 조회합니다. 기존 네트워크 복귀 처리와 수동·오류 재시도, 편집 중 초안 보존은 유지합니다.

지출 복구용 30초 주기 조회는 사용하지 않습니다. 계속 열린 탭에서 이벤트가 조용히 유실되거나 환율만 변경되면 시간 경과만으로는 복구되지 않습니다. 해당 데이터를 다시 읽는 이벤트, 재진입·재연결, 탭 복귀 또는 기존 재시도가 있어야 최신 값이 반영됩니다. presence `/app/ping`과 STOMP heartbeat·재연결 동작은 별개입니다.

## 기여하기

커밋, 브랜치 생성, PR 및 병합 절차는 [CONTRIBUTING.md](./CONTRIBUTING.md)를 따릅니다.

## 개인 준비물

개인 준비물은 `/packing/{roomId}` 직접 주소로 접근합니다. 기존 메뉴에는 진입 항목을 추가하지 않습니다. 목록은 로그인 사용자와 방에 한정되며, 서버의 응답 순서와 내용을 사용합니다. 최초 조회가 `PACKING_LIST_NOT_INITIALIZED`인 경우에만 초기화를 요청하고, 비어 있는 기존 목록은 그대로 유지합니다.

준비물은 REST로만 동기화합니다. 저장은 목록 버전으로 직렬 처리하며, 저장 결과가 불확실하거나 후속 조회가 실패하면 추가 저장을 중단하고 다시 확인할 수 있습니다. 충돌 뒤에는 내용을 확인하여 명시적으로 다시 저장해야 합니다. 메모가 없는 준비물의 삭제는 서버가 발급한 짧은 실행 취소 기한 안에서 복구할 수 있습니다. 초안과 실행 취소 정보는 메모리에만 유지합니다.
