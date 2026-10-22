# AI slop 안티패턴

> `원칙 N-N`은 [핵심 원칙](./principles.md)의 절 번호다. 옆 파일이 이 목록에 걸리면 본보기로 삼지 않는다.

## 구조

### 1. props drilling
- 신호: 중간 컴포넌트가 쓰지 않는 값을 받아 그대로 넘긴다(개수와 상관없이). 이미 정해진 방 ID를 시트·모달까지 내린다. 반대로 drilling을 피하려고 한 화면의 UI 상태를 Context·스토어로 올린다.
- ✗ `<MemberSheet roomId={roomId} />` → `<MemberRow roomId={roomId} />`(MemberSheet는 roomId를 쓰지 않는다)
- ✓ 행은 `onKick(userId)`만 올리고, 방 ID는 화면 훅(없으면 컨테이너)이 `useCurrentRoomId()`로 읽는다. 같은 파일 안 비공개 하위 컴포넌트로 넘기는 것은 걸리지 않는다(원칙 1-2·2-2).

### 2. 얕은 층 쌓기(depth)
- 신호: 받은 것을 그대로 넘기는 컴포넌트·훅·파일, 레이아웃 역할이 없는 래퍼 `div`, 파일 하나씩 든 폴더가 겹쳐 depth만 깊어진다.
- ✗ `function MemberSection({ roomId }) { return <MemberList roomId={roomId} />; }`, 조회 훅을 그대로 돌려주는 화면 훅(`const useRoomSummary = (id) => useRoomDetail(id)`), `member/list/item/MemberItem.tsx`
- ✓ 그 층을 지우고 쓰는 쪽이 바로 부른다(`useRoomDetail(roomId)`를 컴포넌트에서 직접). 지워도 복잡도가 다른 곳에 생기지 않으면 넘기기만 하던 층이다(원칙 1-3).

### 3. 책임이 섞인 컴포넌트
- 신호: 비즈니스 로직(변경 호출·핸들러·도메인 계산)이 컴포넌트 본문에 있다. 한 컴포넌트에 조회·변경·폼 상태·분석 전송·모달·행 마크업이 함께 있어 책임을 한 문장으로 말하지 못한다. 화면 훅이 열림·입력 중 값 같은 UI 상태까지 갖는다. 한 훅 파일에 여러 도메인의 조회·변경 훅이 쌓인다. PC·모바일이 같은 저장 흐름을 따로 구현해 한쪽에만 중복 제출 막기가 있다.
- ✗ 훅이 JSX를 반환한다(`useMemberActions`의 `dialogs`).
- ✓ 비즈니스 로직은 화면 훅(`useMemberPanel`), 분기와 UI 상태는 컨테이너(`MemberPanel`), 그리기는 표시 컴포넌트(`MemberRows`)가 맡는다(원칙 1-2·2-3).

### 4. 무분별한 변수 선언
- 신호: 한 번만 쓰는 별칭·중간 변수, 이름만 바꾼 복사, 같은 값을 두 이름으로 들고 있다.
- ✗
  ```tsx
  const title = room.title;
  const hasTitle = !!title;
  const members = data.members;
  const memberCount = members.length;
  ```
- ✓ 원래 식을 그대로 쓰고(`{room.title}`, `{data.members.length}명`), 뜻을 더하는 이름만 남긴다(`const isOverBudget = total > budget`).
- 계산되는 값을 state로 들고 effect로 맞추는 모양은 9번이다.
- 출처: Martin Fowler [Inline Variable](https://refactoring.com/catalog/inlineVariable.html)·[Extract Variable](https://refactoring.com/catalog/extractVariable.html)

### 5. props 늘리기
- 신호: 작업할 때마다 Props 타입에 prop이 하나씩 는다. 모드를 바꾸는 `isCompact`·`showFooter`·`hideIcon`, prop이 있느냐 없느냐로 구현을 갈아 끼우기, 같은 값을 다른 이름으로 또 받기(`member`와 `memberName`), 받은 값으로 계산할 수 있는 prop, 쿼리 상태를 `isPending`·`isError`로 쪼개 넘기기. Props가 6개를 넘었는데 또 더한다(이미 넘은 기존 컴포넌트를 줄이는 일은 따로 한다).
- ✓ prop을 더하기 전에 계산 → slot → `variant` → 화면 훅 순서로 본다. `<PlaceCard variant="compact" action={<AddToScheduleButton placeId={place.id} />} />`(원칙 2-2·1-4)

### 6. 있는 부품 다시 만들기
- 신호: 새 `fixed inset-0` 모달·바텀시트·로딩 표시, `SettingsActionButton`·`alertDialogButtonClass`가 맞는 자리에 복붙한 버튼 클래스, 새로 만든 범용 Button, `lucide-react`·새 아이콘 패키지
- ✓ `ConfirmDialog`·`SettingsDialog`·`MobileBottomSheet`·`LoadingIndicator`를 먼저 쓴다. 버튼은 `SettingsActionButton`·`alertDialogButtonClass`가 맞으면 쓰고, 아니면 그 자리 `<button>`에 토큰 클래스로 쓴다(범용 Button은 보류). 아이콘은 `@/assets/icons`(원칙 1-1, Design.md 2장).

### 7. 미리 만든 추상화
- 신호: 사용처가 하나인 래퍼·옵션 객체·범용 컴포넌트, `useMount`·`useUpdateEffect` 같은 생명주기 훅, 쓰는 곳 없는 설정 레이어. 로직을 나누는 화면 훅은 사용처가 하나여도 걸리지 않는다.
- ✓ 쓰는 자리에 바로 쓰고, 두 번째 사용처가 생길 때 뺀다(원칙 1-3).

### 8. `"use client"` 끌어올리기
- 신호: page·layout·훅·`src/lib` 파일에 `"use client"`를 붙인다. 훅 에러를 피하려고 지시어를 상위 파일로 올린다.
- ✓ page는 서버 컴포넌트로 두고, 지시어는 상호작용이 시작되는 진입 파일 하나에만 붙인다(`PackingPage.tsx`, 원칙 1-5).

## 상태·데이터

### 9. effect로 상태 맞추기
- 신호: `useEffect(() => { setX(f(prop)); }, [prop])`처럼 props·쿼리 `data`를 `useState`로 옮겨 담는다. `saved` 같은 플래그를 지켜보는 effect에서 저장·토스트·이동을 한다. 두 모양 모두 lint를 통과한다.
- ✓ 파생값은 렌더 중에 계산하고(`draft ?? serverValue`), 행동의 결과는 그 핸들러나 `mutate` 콜백에서 처리한다(원칙 2-1·2-6).

### 10. 서버 데이터를 손으로 관리하기
- 신호: `useEffect`와 `useState`로 API를 부르고 loading·error를 직접 관리한다. 응답을 Zustand·Context·`useState`에 보관한다. 핸들러가 API 함수를 직접 부르고 `isSaving`을 `useState`로 둔다. 쿼리 키를 리터럴로 쓴다. 무효화로 갱신받는 쿼리에 `refetchOnMount: false`를 둔다. 빈 캐시에 `old ?? []`로 한 건짜리 목록을 만든다. 변경 뒤 `refetch()`·`location.reload()`로 화면을 맞추거나, 낙관적 갱신에 되돌리기가 없다. 화면에서 STOMP를 직접 구독한다.
- ✓ 조회는 조회 훅(`useRoomDetail`), 쓰기는 변경 훅이 응답으로 `setQueryData`하고, 실시간 반영은 STOMP dispatch가 맡는다. 키는 팩토리(`roomMembersQueryKey(roomId)`), 빈 캐시 updater는 `undefined`를 돌려 건너뛰고, 낙관적 갱신은 `onError`에서 스냅샷을 되돌린다(원칙 2-3·2-5).

### 11. 상태 합치기
- 신호: 배타적이지 않은 동작의 `a.isPending || b.isPending`, 합친 값을 `isPending` 같은 일반 이름으로 두기, `a.error ?? b.error`, 여러 변경 상태를 합쳐 내보내는 파사드(`useMemberActions`), 한 동작의 진행으로 화면 전체를 덮기. 여러 조회의 로딩을 합쳐 전체를 스켈레톤으로 바꾼다. `isPending` 하나로 로딩을 판정하거나, `error`를 `data`보다 먼저 봐서 재조회가 실패하면 보이던 내용이 사라진다.
- ✓ 동작마다 따로 꺼내 그 버튼에만 잇는다(`const { mutate: approve, isPending: isApproving } = useApproveJoinRequest()`). 배타적 동작을 비활성화에만 쓰는 `isDeciding`은 허용한다. 조회는 영역마다 `data` → `error` → `fetchStatus` 순으로 분기해, `data`가 있으면 재조회 중·실패에도 내용을 둔다(원칙 2-4).

### 12. 이유 없는 메모
- 신호: 원시값 계산·모든 핸들러를 `useMemo`·`useCallback`으로 감싼다. Context value를 인라인 객체(`value={{ … }}`)로 넘긴다.
- ✓ 단순 계산은 그대로 두고, 훅·Context가 내보내는 값과 함수, 의존성으로 쓰는 값만 메모한다(원칙 2-7).

### 13. 렌더를 더럽히기
- 신호: 렌더 중 `new Date()`·`typeof window`·`localStorage`로 바뀌는 마크업, props·쿼리 `data`의 `.sort()`·`.push()`, 편집·재정렬 목록의 `key={index}`, 확인 없는 인덱스 접근(`items[0].id`), cleanup 없는 구독·리스너·타이머. 모두 lint를 통과한다.
- ✓ `[...data.places].sort(byOrder)`, `key={item.id}`, `items[0]?.id`, 브라우저 값은 `useClientReady()` 뒤에 그리고 구독은 cleanup에서 푼다(원칙 1-5·2-6·2-8).

## 퍼블리싱

### 14. 숫자로 보정하기
- 신호: 음수 margin(누르는 영역 확장·의도한 겹침 제외), `translate-y-[1px]`, `right-[312px]`처럼 다른 요소의 치수로 자리 맞추기, `z-[999]`·`z-50`, `!important`·`p-4!`, 넘침을 `overflow-hidden`으로 가리기, `setTimeout(…, 100)`으로 타이밍 맞추기
- ✓ 크기·위치는 그것을 정하는 레이아웃을 고친다(원칙 3-1·3-2·3-5). `!important`는 이기는 쪽을 고친다. 레이어 밖 CSS는 `@layer base`로, 부품의 색·글자는 variant로, 겹친 클래스는 `cn()`으로 정리한다. `setTimeout` 대신 끝나는 시점(`transitionend`·`requestAnimationFrame`)을 기다린다.

### 15. 상한 없는 고정 크기
- 신호: 글자를 담는 버튼·행의 `h-10`, 높이를 두 번 지정한 `h-[52px] py-3.5`, 상한 없는 `w-[305px]`·`min-w-[630px]`, `min-h-screen`·`85vh`, 여러 단계 내린 `h-full`, `flex-1`과 height를 함께 준다.
- 시안 크기를 맞추는 고정은 문제가 아니다. 글자가 커지거나 화면이 좁아질 때 늘어나거나 줄어들 길이 막힌 고정만 걸린다.
- ✓ `min-h-10`, 흐름 안은 `w-[305px] max-w-full`, 띄운 패널은 `w-[min(305px,calc(100vw-2rem))]`, `min-h-svh`, 남은 높이는 `flex-1 min-h-0`(원칙 3-2).

### 16. 자식이 간격을 갖기
- 신호: 재사용 컴포넌트 루트의 `mt-4`, 형제 간격을 `space-y-*`나 자식 margin으로 준다, 부모 padding을 `-mb-[9px]`로 상쇄한다.
- ✓ 컴포넌트는 바깥 간격 없이 두고 배치하는 부모가 `flex flex-col gap-3`으로 정한다(원칙 3-1).

### 17. 토큰 우회
- 신호: 토큰에 있는 값을 `text-[16px] leading-6`·`rounded-[8px]`·`#333`으로 쓴다. `bg-gray-800`·`shadow-md`(Tailwind 기본값), `dark-gray`(레거시 별칭), `text-body-s`(없는 토큰 이름), 타이포 토큰에 붙인 `font-semibold`, 템플릿 리터럴 className, 조립한 클래스 이름(`` `bg-${tone}` ``)
- ✓ `text-body-m-regular`, `rounded-md`, `text-text`, 클래스는 `cn("…", TONE_CLASS[tone], className)`(원칙 3-6).

### 18. div 버튼과 지운 포커스
- 신호: `<div onClick>`, 단순 이동을 `router.push` 버튼으로 만든다. 아이콘 버튼에 `aria-label`이 없다. placeholder만 있는 입력, `outline-none`으로 지운 포커스 표시
- ✓ `<button type="button" aria-label="삭제" className="-m-2.5 grid size-11 place-items-center">`, 이동은 `<Link>`, 포커스는 `focus-visible:outline-2 focus-visible:outline-primary`(원칙 3-7).

## 공통

### 19. 덮어서 통과시키기
- 신호: `as`·`as unknown as`·`!`로 타입 오류를 없앤다. 사유 없는 `eslint-disable`·`@ts-ignore`, lint·tsconfig 완화, `catch {}`·`.catch(() => {})`·`?? []`로 숨긴 실패, 구현에 맞춰 고친 테스트 기대값·`it.skip`
- ✓ 원인을 고친다. 꼭 남겨야 하면 한 줄 범위로 끄고 이유를 단다(`// eslint-disable-next-line <규칙> -- 이유`).

### 20. 옛 API
- 신호: Next 16에서 `params`·`searchParams`를 `await` 없이 읽는다. `middleware.ts`(Next 16은 `proxy.ts`), TanStack Query v5에 없는 `cacheTime`·`useQuery`의 `onSuccess`, React 19에서 새로 쓴 `forwardRef`, 없는 훅·옵션·클래스
- ✓ `package.json` 버전의 타입·문서로 확인한다(`const { roomId } = await params`, `gcTime`, ref는 일반 prop).

### 21. 범위 넘기기
- 신호: 버그 수정 diff에 import 정렬·파일 이름 변경(`MemberList.tsx` → `MemberListView.tsx`)을 섞는다. 요청하지 않은 기능·옵션, 시안에 없는 장식(그림자·그라디언트·애니메이션)을 넣는다. 범위 밖 기존 코드를 고친다. 기능 작업 중에 기존 공용 부품을 shadcn으로 갈아 끼운다. 묻지 않고 의존성을 추가하거나 lint·tsconfig·Tailwind 설정을 바꾼다. `pnpm-lock.yaml`·`yarn.lock`을 만든다.
- ✓ 요청한 변경만 한다. 범위 밖 기존 문제는 알리기만 한다. 의존성·설정 변경은 먼저 묻고 의존성은 npm으로만 추가한다.

### 22. 코드를 되읽는 주석과 죽은 코드
- 신호: `// 상태를 업데이트한다` 같은 주석, 주석 처리한 코드, 쓰지 않는 export·props, 변경 이력 주석
- ✓ 지운다. 주석에는 이유(제약·외부 사정·의도한 예외)만 쓴다. 규칙을 따를 수 없는 곳은 이유와 범위를 그 자리 주석과 PR 본문에 남긴다.

### 23. 확인 없이 완료
- 신호: lint·빌드·화면 확인 없이 완료를 선언한다. 데스크톱 한 화면만 본다. 실행하지 않은 명령의 결과를 쓴다.
- ✓ `npm run lint` → `npm run build` → 화면 확인(PC·모바일 기기 에뮬레이션, Figma와 px 비교, 로딩·오류·빈 상태, 긴 텍스트·좁은 폭). 작업 중에는 vitest를 돌리지 않고 PR 직전에 한 번 돌린다. 완료 보고에 실행한 명령·결과·확인한 화면·남긴 예외를 적는다.
