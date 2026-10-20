# 프론트엔드 핵심 원칙

> 토큰·아이콘은 [Design.md](../../Design.md), 조회·갱신 시점과 로딩 표시·분석 이벤트는 [AGENTS.md](../../AGENTS.md)가 정본이다.

## 0. 철학

1. **화면은 상태에서 계산한 결과다.** 최소 상태를 쓰는 곳 가까이 두고, 데이터는 props로 내리고 변경은 콜백으로 올린다. 렌더는 순수하게 두고 effect는 외부 시스템과 맞출 때만 쓴다.
2. **동작은 shadcn, 모양은 디자인 시스템, 화면은 조립.** 부품은 한 번 만들고 반복해서 쓴다. shadcn으로 옮기는 동안 기존 공용 부품과 병행한다(1-1).
3. **구조로 맞추고 숫자로 보정하지 않는다.** 어긋나면 숫자를 바꾸기 전에 그 크기·위치를 정하는 레이아웃을 고친다.
4. **요구사항에 맞는 일을 공식 문서 예시처럼 정석대로 짠다.** 이 문서의 예시가 우리 코드의 정석이다. 요구사항에 없는 것은 더하지 않는다. 정석이 맞지 않는 요구사항이면 다른 방식을 쓰고 이유를 PR 본문에 적는다.

규칙이 다루지 않는 상황은 이 넷으로 판단한다.

## 1. 컴포넌트

### 1-1. 부품은 한 번 만들고 조립한다 (Headless UI)

목표는 동작(포커스 가두기·키보드·aria·포털)은 shadcn(Radix) 프리미티브가, 모양은 디자인 시스템 토큰이 맡는 것이다. 둘을 합친 부품을 `src/components/ui/`에 한 번 두고 화면은 조립만 한다. shadcn은 아직 설치 전이라, 옮기는 동안 기존 공용 부품과 병행한다.

| 상황 | 할 일 |
| :-- | :-- |
| 맞는 공용 부품이 있다(`src/components/<도메인>/`의 `ConfirmDialog`·`SettingsDialog`·`MobileBottomSheet`·`LoadingIndicator`·`SettingsActionButton` 등) | 그대로 쓴다. 같은 역할의 shadcn 부품이 생기면 새로 쓰는 곳만 그쪽을 쓰고 기존 사용처는 둔다 |
| 맞는 공용 부품이 없는 동작 부품(드롭다운·팝오버·탭·셀렉트)이 필요하다 | shadcn으로 만든다. 설치 전이면 만들기 전에 도입할지 묻는다. 미루면 공용 셸에서 동작 처리(portal·포커스 가두기·Escape·aria)만 가져오고, 클래스·토큰·아이콘은 3-6과 Design.md를 따른다 |
| 동작 없는 표시 부품이 필요하다 | Tailwind로 만든다 |
| 기존 공용 부품이나 그 사용처를 shadcn으로 바꾼다 | 기능·버그 작업에 섞지 않고 따로 한다 |

- 변형은 `variant`·`size` 같은 유니온 prop으로 받고, 값은 Figma 컴포넌트 속성 값에 맞춘다.
- 화면은 부품의 색·글자를 덮지 않는다. 바깥에서 주는 `className`은 배치(폭·정렬·위치)에만 쓴다.
- 공용 Button은 사이즈 기획이 끝나지 않아 보류 중이다. 범용 Button 부품을 새로 만들지 않는다.
- shadcn 코드를 받으면 디자인 시스템에 맞춘다.
  - 색·그림자·포커스 클래스(`secondary`·`*-foreground`·`muted`·`accent`·`input`·`ring`·`shadow-*`)는 시맨틱 토큰으로 바꾼다. 이름이 같아도 뜻이 다르고(`secondary`는 라임), 없는 이름은 CSS가 생기지 않는다.
  - 설치 때 shadcn이 `globals.css`에 넣는 색 변수(`:root`·`@theme inline`)는 받지 않는다. 기존 `primary`·`border`·`background` 토큰을 앱 전체에서 덮는다.
  - 아이콘은 `lucide-react` 대신 `@/assets/icons`, `cn`은 `@/lib/utils`의 것을 쓴다.
  - z값은 같은 역할의 공용 셸(대화상자 `SettingsDialog`, 시트 `MobileBottomSheet`)에 맞추고, 그 안에서 여는 팝오버·셀렉트는 셸보다 위에 둔다.

```tsx
// ✗ 화면마다 모달을 직접 만든다. 포커스 가두기·ESC·aria가 빠지고 z값이 제각각이 된다
<div className="fixed inset-0 z-[999] bg-black/50" onClick={close}>…</div>

// ✓ 지금: 공용 셸을 쓴다(포커스 가두기·ESC·aria 포함)
{isInviteOpen && <SettingsDialog title="초대" onClose={closeInvite}>…</SettingsDialog>}

// ✓ shadcn 설치 후: 동작은 shadcn, 모양은 토큰을 입힌 ui 부품
<Dialog>
  <DialogTrigger asChild><button type="button" className="…">초대</button></DialogTrigger>
  <DialogContent>…</DialogContent>
</Dialog>
```

### 1-2. 로직은 화면 훅, 그리기는 컴포넌트 (Custom Hook · Container / Presentational)

로직과 그리기를 나눈다. 컴포넌트를 열면 무엇을 그리는지만, 화면 훅을 열면 무엇을 하는지만 보이게 해서 한쪽을 바꿀 때 다른 쪽을 건드리지 않게 한다.

| 역할 | 맡는 일 | 하지 않는 일 |
| :-- | :-- | :-- |
| 화면 조립(page·layout) | 라우트를 읽고 영역을 배치한다. 서버 컴포넌트로 둔다 | 상호작용 상태 |
| 화면 훅(`use<컴포넌트>`) | 그 화면의 비즈니스 로직. 조회 조합, 변경 호출과 핸들러, 도메인 계산. 상태는 동작마다 따로 내보낸다 | JSX 반환, UI 상태, 여러 변경의 상태 합치기 |
| 기능 컨테이너 | 화면 훅(로직이 없으면 조회 훅)을 부르고 상태별로 분기해 표시 컴포넌트에 데이터와 콜백을 잇는다. UI 상태(열림·hover·입력 중 값)를 가진다 | 비즈니스 로직, 반복되는 행·카드 마크업 |
| 표시 | props와 자기 UI 상태로 그리고, 사용자 행동은 `onX`로 알린다 | 조회·변경 훅, 스토어 구독 |

- 비즈니스 로직이 붙으면 화면 훅으로 뺀다. 조회 훅 하나를 그대로 쓰는 컴포넌트는 화면 훅 없이 부른다(넘기기만 하는 층이 된다).
- 화면 훅도 `src/hooks/`에 둔다. 이름은 컴포넌트 이름에 `use`를 붙이고(`MemberPanel` → `useMemberPanel`), 핸들러는 `handleX`로 짓는다. 조회 훅은 `use<Domain><Noun>`, 변경 훅은 `use<Verb><Domain>`, 컴포넌트의 동작 하나만 맡는 훅은 `use<대상><동작>`(`usePlanItineraryReorder`)이다. 기존 훅 이름은 기능 작업 중에 바꾸지 않는다.
- 화면 훅은 상태를 합치지 않는다. 여러 변경의 `isPending`·`error`를 합쳐 내보내는 파사드(`useMemberActions`)와 다르다(2-4).
- 성공·실패 뒤 UI 상태를 바꾸는 반응(닫기·입력 초기화)은 컨테이너가 핸들러에 `onSuccess`로 넘기고, 화면 훅이 그것을 `mutate` 호출부 콜백에 잇는다.
- 행마다 따로 진행되는 동작(행별 승인·거절)이 있으면 행 하나가 컨테이너가 된다. 행이 화면 훅을 부르고, 그리기는 같은 파일의 비공개 표시 컴포넌트가 맡는다.
- 훅은 JSX를 반환하지 않는다. 도메인 계산은 `src/lib/<도메인>/`의 순수 함수로 두고 화면 훅이 부른다. 서버가 계산한 값은 화면에서 다시 계산하지 않는다.
- PC·모바일이 같은 흐름이면 같은 화면 훅을 쓰고 레이아웃만 나눈다(나누는 방법은 3-4).

```tsx
// src/hooks/useMemberPanel.ts — 화면 훅: 비즈니스 로직
export function useMemberPanel() {
  const { roomId } = useCurrentRoomId();
  const membersQuery = useRoomMembers(roomId);
  const { mutate: kick, isPending: isKicking } = useKickMember();
  const handleKick = useCallback(
    (userId: number, { onSuccess }: { onSuccess?: () => void } = {}) => {
      if (!roomId) return;
      kick({ roomId, userId }, { onSuccess, onError: () => toast.error("내보내지 못했어요.") });
    },
    [roomId, kick],
  );
  return { roomId, membersQuery, isKicking, handleKick };
}

// MemberPanel.tsx — 컨테이너: 상태별 분기와 UI 상태
export function MemberPanel() {
  const { roomId, membersQuery, isKicking, handleKick } = useMemberPanel();
  const [kickTargetId, setKickTargetId] = useState<number | null>(null); // UI 상태는 컴포넌트에

  if (!roomId) return null;
  if (membersQuery.data) {
    return (
      <>
        <MemberRows members={membersQuery.data.members} onKick={setKickTargetId} />
        {kickTargetId !== null && (
          <ConfirmDialog
            title="이 멤버를 내보낼까요?"
            isPending={isKicking}
            onConfirm={() => handleKick(kickTargetId, { onSuccess: () => setKickTargetId(null) })}
            onCancel={() => setKickTargetId(null)}
          />
        )}
      </>
    );
  }
  if (membersQuery.error) return <MemberRowsError />;
  return <MemberRowsSkeleton />;
}

// MemberRows.tsx — 표시: props로만 그린다. 강퇴 뒤의 캐시·토스트는 모른다
```

### 1-3. 나누는 기준은 바뀌는 이유 (Thinking in React)

같이 바뀌는 것은 모으고 따로 바뀌는 것은 나눈다. 그래야 변경 하나가 파일 하나에서 끝나고, 나눈 층마다 제 몫이 있다.

- 경계는 Figma 컴포넌트·레이어 이름을 먼저 따른다. 나누는 기준은 줄 수가 아니라 바뀌는 이유다.
- 파일 하나에 export 컴포넌트 하나를 둔다. 그 컴포넌트만 쓰는 하위 컴포넌트·상수는 같은 파일에 비공개로 둔다.
- 컴포넌트는 모듈 최상위에 정의한다. 컴포넌트 안에서 정의하면 렌더마다 새 타입이 되어 하위 상태와 입력 포커스가 사라진다.
- 두 라우트 이상에서 쓰면 `src/components/<도메인>/`으로 올린다. `src/app/**/_components/`는 그 라우트 전용이라 공용 코드와 다른 라우트가 import하지 않는다.
- 추상화는 두 번째 사용처가 생길 때 만든다(화면 훅은 재사용이 아니라 로직을 나누는 것이라 사용처가 하나여도 만든다, 1-2). 넘기기만 하는 층(컴포넌트·훅·파일·폴더)은 만들지 않는다. 판별은 삭제 테스트다. 지웠을 때 복잡도가 다른 곳에 다시 생기지 않으면 넘기기만 하던 층이다.

```tsx
// ✗ 부모가 렌더될 때마다 Row가 새 컴포넌트가 된다
function PlaceList({ places }: PlaceListProps) {
  const Row = ({ place }: { place: Place }) => <li>{place.name}</li>;
  return <ul>{places.map((p) => <Row key={p.id} place={p} />)}</ul>;
}

// ✓ 최상위에 두고 필요한 값은 props로 넘긴다
function PlaceRow({ place }: { place: Place }) {
  return <li>{place.name}</li>;
}
```

### 1-4. 변형은 합성으로 (Composition over Boolean Props)

boolean prop은 하나 늘 때마다 가능한 조합이 두 배가 되고, 그중 일부는 있을 수 없는 상태다. 변형은 이름 있는 값이나 합성으로 드러낸다.

- 구조·동작을 바꾸는 boolean prop 대신 children·slot이나 변형별 컴포넌트를 쓴다. 표시 변형은 boolean 여럿 대신 유니온 prop(`variant`·`size`)으로 받는다(`MobileBottomSheet`의 `variant: "menu" | "form"`).
- renderX prop 대신 children으로 넘긴다.
- 쿼리 상태를 `isPending`·`isError` prop으로 쪼개 넘기지 않는다. 분기는 컨테이너에서 끝낸다(1-2).

```tsx
// ✗ boolean 하나마다 조합이 두 배로 는다
<PlaceCard isCompact showMemo hideActions />

// ✓ 표시 변형은 variant, 바뀌는 내용은 slot
<PlaceCard variant="compact" action={<AddToScheduleButton placeId={place.id} />} />
```

### 1-5. 서버·클라이언트 경계 (Server Components)

클라이언트 컴포넌트도 서버에서 한 번 먼저 그려진다. 클라이언트 경계를 좁게 둬야 번들이 작고, 서버와 브라우저의 첫 결과가 같아야 하이드레이션이 깨지지 않는다.

- page·layout은 서버 컴포넌트로 두고 상호작용은 하위 클라이언트 컴포넌트에 맡긴다. 예: `src/app/(main)/packing/[roomId]/page.tsx`는 지시어 없이 `<PackingPage />`만 렌더하고, `"use client"`는 `PackingPage.tsx`에만 있다.
- `"use client"`는 서버 컴포넌트가 직접 렌더하는 클라이언트 진입 파일에만 붙인다. 훅·`src/lib` 파일에는 붙이지 않는다.
- `useSearchParams`를 쓰는 컴포넌트는 가까이에서 `<Suspense>`로 감싼다. 없으면 개발 서버는 통과하고 프로덕션 빌드만 실패한다.
- 렌더 중 `typeof window`·`localStorage`·`new Date()`로 마크업을 바꾸지 않는다(하이드레이션 불일치). 브라우저에서만 정해지는 값은 `useClientReady()`가 true일 때 그린다.

## 2. 상태·데이터

### 2-1. 최소 상태, 파생은 렌더 중에 (Derived State)

상태에는 계산할 수 없는 값만 둔다. 같은 값을 두 곳에 두면 한쪽만 바뀌어 어긋난다.

- 필터 결과·합계·개수는 렌더 중에 계산한다.
- props를 `useState`에 복사하지 않는다. 초깃값이면 `initialX`로 이름 짓는다(리셋은 2-8).
- 선택·편집 대상은 ID로 저장하고 객체는 최신 목록에서 찾는다.
- 동시에 참일 수 없는 boolean 여럿 대신 유니온 하나를 둔다. 바뀌는 경로가 여러 핸들러에 흩어지면 `useReducer`로 한 곳에 모으고, 액션은 이벤트 이름(`openEdit`·`close`)으로 짓는다.
- 편집 중인 값은 바꾼 것만 상태로 두고 표시값은 `draft ?? serverValue`로 계산한다.

```tsx
// ✗ 서버 값을 복사하고 effect로 따라간다(이 모양은 lint를 통과한다)
const [memo, setMemo] = useState(serverMemo);
useEffect(() => { setMemo(serverMemo); }, [serverMemo]);

// ✓ 바꾼 값만 들고 표시값은 계산한다
const [draft, setDraft] = useState<string | null>(null); // null = 변경 없음
const memo = draft ?? serverMemo;

// ✗ 동시에 참일 수 없는 상태를 따로 든다
const [isEditOpen, setIsEditOpen] = useState(false);
const [isKickConfirmOpen, setIsKickConfirmOpen] = useState(false);
const [targetId, setTargetId] = useState<number | null>(null);

// ✓ 유니온 하나로 둔다. 전이가 많아지면 useReducer로 옮긴다
type Sheet = { mode: "closed" } | { mode: "edit" | "kick"; memberId: number };
const [sheet, setSheet] = useState<Sheet>({ mode: "closed" });
```

### 2-2. 데이터는 내리고 이벤트는 올린다 (Lifting State Up · Colocation)

상태는 그것을 쓰는 곳 가까이 둔다. 가까울수록 데이터가 어디서 와서 어디로 가는지 코드에 보이고, 바뀔 때 다시 그리는 범위도 좁다.

| 상태 | 둘 곳 |
| :-- | :-- |
| 서버 데이터 | TanStack Query 캐시(2-3) |
| 새로고침·공유에 남아야 하는 선택 | URL(경로·`searchParams`) |
| 한 영역 안에서 끝나는 UI 상태(열림·입력값) | 그 상태를 쓰는 가장 가까운 공통 부모의 `useState`(엮이면 유니온, 2-1) |
| 멀리 떨어진 영역(지도와 일정 목록)이나 여러 화면이 함께 쓰는 클라이언트 상태 | Zustand selector(기본). 방·일정 범위면 `Record<roomId, …>`로 나눈다 |
| 같은 때 하위 트리마다 값이 달라야 하는 상태(compound 내부, 요청마다 다른 초기값) | Context + Provider |

중간 컴포넌트는 자기가 쓰는 값만 받는다. 중간이 쓰지 않는 값을 받아 넘기면 개수와 상관없이 아래 순서로 푼다. 같은 파일 안의 비공개 하위 컴포넌트로 넘기는 것은 둔다(함께 바뀐다).

1. 상태를 쓰는 곳 가까이로 내린다.
2. children·slot으로 중간을 비운다.
3. 서버 데이터와 방 ID는 그것이 필요한 컨테이너가 직접 읽는다(화면 훅이 있으면 그 안에서). 표시 컴포넌트는 행동을 `onX`로 올리기만 한다.
4. 그래도 멀리 떨어진 영역이 함께 쓰면 Zustand selector, 하위 트리마다 값이 달라야 하면 Context로 읽는다.

prop은 그리는 데 필요한 값과 사용자 행동을 알리는 `onX`만 받는다. 돌아가게 하려고 prop을 하나씩 더하지 않는다. 새 prop을 더하기 전에 순서대로 본다.

1. 이미 받은 값으로 계산할 수 있으면 계산한다(2-1).
2. 넘기기만 할 값이면 위 순서로 푼다.
3. 모드를 바꾸는 boolean이면 `variant`나 변형 컴포넌트로 바꾼다(1-4).
4. 조회·변경·계산이 따라오면 화면 훅으로 옮긴다(1-2).

Props가 6개를 넘으면 이 순서로 다시 본다.

```tsx
// ✗ DaySection은 roomId·scheduleId를 쓰지 않고 안쪽에 넘기기만 한다
<DaySection roomId={roomId} scheduleId={scheduleId} title={title} />

// ✓ 조립하는 쪽이 안을 채운다(PlanDaySection의 summaryAction·children)
<DaySection title={title} summaryAction={<ExpenseButton scheduleId={scheduleId} />}>
  <Itinerary scheduleId={scheduleId} />
</DaySection>
```

- `(main)` 아래에서 방 ID는 중간을 거쳐 받지 않고, 필요한 화면 훅·컨테이너가 `const { roomId } = useCurrentRoomId()`로 읽는다(`string | null`).
- drilling을 피하려고 한 영역의 UI 상태(열림·입력값)를 Context·스토어로 올리지 않는다.
- Zustand는 selector로 필요한 조각만 구독한다(`useChatPanelStore((s) => s.minimized)`). 객체·배열을 새로 만들어 반환하는 selector는 `useShallow`로 감싼다.
- 렌더 중에 스토어를 채우지 않는다. 서버 렌더에서 요청마다 초기값이 달라야 하는 상태는 모듈 전역 스토어 대신 Provider가 만든 스토어(Context)에 둔다. 전역 스토어는 서버에서 요청끼리 공유된다.
- Provider가 꼭 있어야 하는 Context는 `createContext<T | null>(null)`로 만들고, Provider 밖에서 쓰면 throw하는 `useXxx()`를 export한다(value 메모는 2-7).

### 2-3. 서버 데이터는 api → 훅 → 컨테이너 (Query Hooks)

서버 데이터는 요청 → 캐시 → 화면의 층으로 흐른다. 같은 데이터는 캐시 한 곳에만 두고, 언제 다시 가져오고 어떻게 고칠지는 훅 안에 숨긴다. 화면은 결과만 받는다.

```text
src/lib/api/<리소스>.ts      요청·응답 보정·에러. 반환 타입을 여기서 정한다(방 리소스는 src/lib/api/rooms/)
src/lib/query-keys.ts 등     키 팩토리. 도메인 키 파일(expenseKeys 등)이 있으면 거기에 더한다
src/hooks/use*.ts            조회 훅(useQuery)·변경 훅(useMutation)·화면 훅(1-2). 조회·변경 훅은 파일 하나에 도메인 하나
기능 컨테이너                훅을 부르고 상태별로 분기한다(2-4)
```

- 서버 데이터는 캐시에만 둔다. `useState`·스토어·Context로 복사하지 않는다. 여러 컴포넌트가 쓰면 각자 같은 조회 훅을 부른다. 같은 키는 요청 하나로 합쳐진다.
- 요청은 `src/lib/api`의 함수로만 보낸다(`apiFetch`가 401 토큰 갱신과 세션 만료를 처리한다). 컴포넌트는 `fetch`도 API 함수도 직접 부르지 않고 훅을 쓴다.
- 실패는 `HttpError`로 던진다. `requestJson`·`requestVoid`에는 `useHttpError: true`를 넘긴다(없으면 `status`가 없는 `Error`가 된다). 화면은 `status`를 직접 비교하지 않고 `src/lib/api/errors.ts`의 판정·문구 함수를 쓴다.
- 키는 팩토리로만 만들고 queryFn이 쓰는 값을 모두 넣는다. 방 데이터 키는 `[세그먼트, roomId, …]` 순서다(강퇴·방 삭제 때 두 번째 자리로 캐시를 지운다). 개인 데이터 키에는 사용자 ID를 넣는다.
- 조회 훅은 키·queryFn·`enabled`와 필요한 `select`·`placeholderData`·`staleTime`만 둔다. 전역 기본값(`createQueryClient`)과 같은 값은 다시 쓰지 않고, 다른 값에는 갱신 사유를 주석으로 단다.
- 브로드캐스트와 본인 수정으로 갱신되는 방 데이터는 `staleTime: Infinity`로 둔다(전역은 60초). 무효화로 갱신받는 쿼리에는 `refetchOnMount: false`를 두지 않는다. 화면 밖에서 무효화된 캐시가 다시 마운트돼도 갱신되지 않는다.
- 변경 훅 하나는 동작 하나다. 캐시 반영과 쓰기 분석 이벤트는 훅에, 토스트·닫기·이동은 호출부 `mutate(vars, { onSuccess, onError })`에 둔다.
- 캐시는 응답으로 `setQueryData`하는 것이 기본이다. 응답으로 확정할 수 없을 때만 필요한 범위를 무효화하고, 그 promise를 반환해 재조회가 끝날 때까지 `isPending`을 유지한다.
- 응답·이벤트로 캐시를 고치는 updater는 캐시가 없으면 `undefined`를 돌려 건너뛴다. `old ?? []`로 한 건짜리 목록을 만들지 않는다.
- 방 ID 같은 범위 값은 mutation 변수로 넘기고 `onSuccess`는 그 변수를 쓴다. 완료 시점에 현재 방을 다시 읽지 않는다. 쓰기 분석 이벤트는 요청 중에 사용자·방·권한이 바뀌었으면 보내지 않는다(방 쓰기는 `trackRoomMutation`이 mutationFn을 감싸 확인한다).
- STOMP는 화면에서 구독하지 않는다. 새 토픽은 `src/lib/stomp`의 파서 → `*-dispatch(queryClient, …)` → `subscribeRoomStompTopics` 등록 순서로 더한다. React 안에서는 `useQueryClient()`를 쓰고, `getQueryClient()`는 인자로 받을 수 없는 모듈 코드에서만 쓴다.

```tsx
// 조회 훅: data 타입은 API 함수의 반환 타입에서 추론된다
export function useRoomDetail(roomId: string | null) {
  const id = typeof roomId === "string" ? roomId.trim() : "";
  return useQuery({
    queryKey: roomDetailQueryKey(id),
    queryFn: () => getRoomDetail(id),
    enabled: id.length > 0,
  });
}

// 변경 훅: 캐시는 훅이 맡는다
export function useKickMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: number }) => kickMember(roomId, userId),
    // 응답이 void라 그 방 멤버 목록만 무효화하고, 재조회가 끝날 때까지 기다린다
    onSuccess: (_, { roomId }) => queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) }),
  });
}

// 호출부(화면 훅의 핸들러): 화면 반응만 둔다
kick({ roomId, userId }, { onError: () => toast.error("내보내지 못했어요.") });
```

### 2-4. 상태 하나에 UI 하나 (State → UI)

상태마다 보여 줄 UI를 하나로 정해 둔다. 그래야 같은 상태가 화면마다 다르게 보이지 않고, 재조회가 실패해도 보이던 내용이 사라지지 않는다.

조회 상태는 `data`가 있으면 1~4행을 함께 적용하고(내용 유지 + 표시 추가), 없으면 5~7행을 위에서부터 판정한다.

| 상태 | 판정 | UI |
| :-- | :-- | :-- |
| 데이터 있음 | `data` | 내용. 결과가 비었으면 빈 상태 |
| 재조회 중 | `data` + `isFetching` | 내용 유지. 필요하면 `aria-busy` |
| 재조회 실패 | `data` + `error` | 내용 유지 + 인라인 알림이나 토스트 |
| 임시 결과 | `data` + `isPlaceholderData` | 이전 결과 유지. 확정 결과가 필요한 동작만 막는다 |
| 최초 실패 | `error` | 그 영역의 오류 안내 + 재시도 |
| 조회 안 함 | `fetchStatus === "idle"`(`enabled: false`) | 곧 채워질 조건(STOMP 연결 등)을 기다리면 스켈레톤. 채워지지 않을 조건(방 미선택)이면 그 이유에 맞는 자리 |
| 최초 로딩 | 그 밖 | 완료 화면과 같은 배치의 스켈레톤. 작은 영역은 `LoadingIndicator` |

- `isPending`·`isLoading` 하나로 로딩을 판정하지 않는다. `enabled: false`면 `isPending`이 계속 true이고, `isLoading`은 오프라인으로 멈춘 첫 조회(`fetchStatus === "paused"`)를 놓친다.
- 조회가 여럿이면 영역마다 따로 분기한다. 로딩을 합쳐(`a.isLoading || b.isLoading`) 화면 전체를 바꾸지 않는다.

```tsx
export function RoomSummary() {
  const { roomId } = useCurrentRoomId();
  const { data: room, error, fetchStatus, isFetching, refetch } = useRoomDetail(roomId);
  if (room) {
    return (
      <section aria-busy={isFetching}>
        {error ? <RefetchFailedNotice onRetry={() => void refetch()} /> : null}
        <RoomSummaryView room={room} />
      </section>
    );
  }
  if (error) return <RoomSummaryError onRetry={() => void refetch()} />;
  if (fetchStatus === "idle") return <RoomNotSelected />;
  return <RoomSummarySkeleton />;
}
```

변경의 진행·실패 표시는 그 동작의 자리에만 둔다.

| 상태 | 판정 | UI |
| :-- | :-- | :-- |
| 진행 중 | `isPending` | 그 버튼만 비활성 + 버튼 안 진행 표시 |
| 행별 진행 중 | `isPending` + `variables`의 행 ID | 그 행에 진행 표시. 한 훅을 여러 행이 함께 쓰면 진행 중에는 모든 행을 막는다 |
| 실패 | 호출부 `onError` | 토스트 하나 또는 그 자리의 문구 하나 |
| 성공 | 호출부 `onSuccess` | 닫기·이동·입력 초기화 |

- 결과는 동작 이름으로 구조분해한다: `const { mutate: approve, isPending: isApproving } = useApproveJoinRequest()`.
- 여러 변경의 `isPending`·`error`를 합치지 않는다(`useMemberActions` 같은 파사드 포함). 합치면 어느 동작이 진행 중이고 어느 동작이 실패했는지 사라진다.
- 서로 배타적인 동작만 이유가 드러나는 이름으로 합쳐 비활성화에만 쓴다(`const isDeciding = isApproving || isRejecting`). 진행 표시는 누른 버튼에만 둔다.
- 요청 둘이 함께 성공해야 하는 동작은 변경 훅 하나의 `mutationFn`에서 차례로 보낸다. 여러 변경을 잇는 순서는 이벤트 핸들러에서 정한다.
- 호출부 콜백·`isPending`·`variables`는 그 훅의 마지막 호출만 따르고, 호출부 콜백은 컴포넌트가 마운트돼 있을 때만 실행된다. 여러 행을 동시에 실행하려면 행 단위 컨테이너가 각자 화면 훅을 부르거나(1-2), `mutationKey`와 `useMutationState`로 진행 중인 행을 읽는다. 응답 전에 사라지는 컴포넌트는 남는 상위에서 `mutate`하거나 `mutateAsync`를 `try/catch`로 감싼다.
- 연타로 두 번 실행되면 안 되는 동작은 변경 훅의 `useRef` 락으로 막고 `onSettled`에서 푼다. `isPending`은 다음 렌더에야 바뀐다.

### 2-5. 낙관적 갱신은 되돌릴 수 있을 때만 (Optimistic Updates)

낙관적 갱신은 응답 전에 결과를 보여 준다. 실패하면 보였던 값이 거짓이 되므로, 실패가 드물고 되돌릴 수 있는 곳에만 쓴다.

- 실패 가능성이 낮고 즉시 반응이 필요한 곳(체크·순서 바꾸기)에만 쓴다. 그 밖에는 진행 중임을 보이고 응답으로 반영한다.
- 결과가 한 곳에만 보이면 캐시를 고치지 않고 `variables`·`isPending`으로 그 자리만 그린다.
- 여러 곳에 보이면 `onMutate`에서 `cancelQueries` → 스냅샷 → `setQueryData` 순서로 고친다. 실패하면 스냅샷으로 되돌리고 그 범위를 다시 조회한다(그사이 들어온 다른 사람의 변경도 스냅샷이 지운다).
- 연속 입력은 디바운스해 한 요청으로 보낸다. 스냅샷은 첫 입력 때 잡는다(보낼 때 잡으면 이미 고친 값이 잡힌다). 언마운트 때 대기분을 입력 당시의 방 ID로 보내고, 사용자가 바뀌었으면 버린다.
- 준비물·가계부는 자체 저장 방식(직렬 저장·충돌 복구)이 있어 이 패턴을 쓰지 않는다.

```ts
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: key });
  const prev = queryClient.getQueryData(key);
  queryClient.setQueryData(key, (old) => applyChange(old, vars));
  return { prev };
},
onError: (_error, _vars, context) => {
  queryClient.setQueryData(key, context?.prev);
  void queryClient.invalidateQueries({ queryKey: key });
},
```

### 2-6. effect는 외부 시스템과 맞출 때만 (Synchronizing with Effects)

effect는 렌더가 끝난 뒤 실행돼 화면을 한 번 더 그리게 하고, 원인(사용자 행동)과 결과를 떨어뜨린다. 그래서 React 밖의 시스템과 맞출 때만 쓴다.

| 하고 싶은 것 | effect 대신 |
| :-- | :-- |
| props·state로 계산되는 값 | 렌더 중 계산 |
| 엔터티가 바뀔 때 상태 초기화 | `key`(2-8) |
| 값이 바뀔 때 다른 상태도 함께 | 그 변경을 일으킨 이벤트 핸들러 |
| 제출·토스트·이동·부모에 알리기 | 이벤트 핸들러·mutation 콜백 |
| 서버 데이터 조회 | 조회 훅(2-3) |
| 브라우저 값·외부 저장소 구독 | `useSyncExternalStore` |

- effect는 지도 SDK·DOM 측정·타이머·브라우저 이벤트·데이터가 표시된 시점의 조회 분석 이벤트에만 쓴다(STOMP는 2-3).
- 조회 분석 이벤트는 마지막으로 보낸 대상 ID를 ref에 두고 같으면 건너뛴다(`PlanPageView`의 `lastTrackedPlanIdRef`). 재조회·브로드캐스트로 `data`가 바뀌어도 다시 보내지 않는다.
- effect 하나에 동기화 하나를 두고, 구독·리스너·타이머는 cleanup에서 푼다.
- 두 번 실행돼도 결과가 같게 쓴다. `reactStrictMode: false`라 개발 중에 드러나지 않을 뿐 재마운트는 일어난다.
- `exhaustive-deps` 경고는 끄지 않고 구조를 바꾼다. 정적 값은 컴포넌트 밖, effect에서만 쓰는 값은 effect 안으로 옮기고 이전 값 기반 갱신은 updater 함수로 쓴다.

```tsx
// ✗ 플래그를 지켜보는 effect에서 토스트·이동을 한다(이 모양은 lint를 통과한다)
useEffect(() => {
  if (saved) { toast.success("저장했어요."); router.push("/plan"); }
}, [saved, router]);

// ✓ 그 동작의 호출부 콜백에서 처리한다
save(vars, { onSuccess: () => { toast.success("저장했어요."); router.push("/plan"); } });
```

### 2-7. 메모는 이유가 있을 때만 (When to Memo)

메모는 의존성 배열을 늘리고, 막아 주는 다시 그리기가 없으면 비용만 남는다. React Compiler를 쓰지 않으므로 직접 판단한다. 메모보다 먼저 바뀌는 상태를 쓰는 곳으로 내리고 바뀌지 않는 부분은 children으로 받는다. `useMemo`·`useCallback`은 아래에만 쓴다.

- 커스텀 훅·Context가 내보내는 값과 함수(Context value는 항상)
- effect·다른 훅의 의존성으로 쓰는 값
- `memo()` 컴포넌트에 넘기는 props
- 측정해서 비싼 계산

```tsx
// ✗ 원시값을 돌려주는 단순 계산까지 감싼다
const selectedCount = useMemo(() => places.filter((p) => p.selected).length, [places]);

// ✓ 렌더 중에 그대로 계산한다
const selectedCount = places.filter((p) => p.selected).length;
```

### 2-8. 렌더는 순수하게, key는 안정 ID (Pure Render)

렌더는 같은 입력에 같은 결과를 내는 계산이다. React는 렌더를 다시 하거나 버리기도 하므로, 렌더 중의 부수효과와 값 변경은 화면을 어긋나게 한다.

- 렌더 중에 요청·분석 전송·`ref.current` 읽기를 하지 않는다.
- props·state·쿼리 `data`를 제자리에서 바꾸지 않는다. 정렬·추가는 복사본으로 하고 `setQueryData` updater도 새 객체를 반환한다.
- 목록 `key`는 데이터의 안정 ID다. 편집·재정렬·삽입되는 목록에 index를 쓰지 않는다.
- 같은 자리의 컴포넌트가 다른 엔터티를 보여주면 엔터티 ID를 `key`로 줘서 리셋한다(`ChatPanel`의 `<ChatMessageList key={rid || "no-room"}>`).
- 에러 경계(`error.tsx`)가 없어 렌더 중 예외 하나가 화면 전체를 깨뜨린다. 배열 인덱스·Record 접근은 타입에 `undefined`가 없으니 `items[0]?.id`처럼 읽는다.

```tsx
// ✗ 쿼리 data를 제자리에서 정렬한다. 같은 키를 쓰는 모든 화면이 함께 바뀐다
const sorted = data.places.sort(byOrder);

// ✓ 복사본을 정렬한다
const sorted = [...data.places].sort(byOrder);
```

## 3. 퍼블리싱

### 3-1. Auto Layout을 그대로 옮긴다 (Layout First)

시안의 Auto Layout이 곧 레이아웃 구조다. 구조를 그대로 옮기면 숫자로 맞출 일이 없다. 순서는 영역과 시맨틱 태그 → 레이아웃 방식 → 늘어나는 곳과 고정인 곳 → 간격 → 토큰 값이다.

- Figma Auto Layout은 방향 = flex 축, 간격 = 부모 `gap`, 안쪽 여백 = padding, Hug = 폭 없이 내용 크기, Fill = 부모 방향 축이면 `flex-1 min-w-0`·교차 축이면 `self-stretch`, Fixed = 3-2대로 옮긴다. 가로 행의 Fixed·Hug 형제에는 `shrink-0`을 준다. Hug·Fill 레이어에 Dev Mode가 보여 주는 W·H 수치와 절대 좌표는 옮기지 않는다.
- 한 축 나열은 flex, 행·열을 함께 맞추면 grid, 문서 본문은 flow, 겹침만 `absolute`(기준 부모에 `relative`)로 둔다.
- `space-y-*`와 재사용 컴포넌트 루트의 바깥 margin을 쓰지 않는다.
- margin은 auto 정렬(`mx-auto`·`ms-auto`), 의도한 블리드·겹침, 누르는 영역을 넓히고 되돌리는 음수 margin(3-7), flow 본문(약관·Markdown의 요소별 margin)에만 쓴다.
- 상단 헤더는 `fixed`와 보정 padding 대신 `sticky`로 둔다.

```tsx
// ✗ 제목 컴포넌트가 바깥 간격을 들고 다닌다
function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 text-title-m text-text">{title}</h2>;
}

// ✓ 컴포넌트는 간격 없이 두고, 배치하는 부모가 gap으로 정한다
<section className="flex flex-col gap-3">
  <SectionTitle title="예산" />
  <BudgetSummary />
</section>
```

### 3-2. 시안 크기는 지키고, 커져도 깨지지 않게 (Defensive CSS)

크기를 다루는 목적은 둘이다. 디자이너가 정한 크기를 그대로 맞추고, 사용자가 글자를 키우거나 화면이 좁아져도 내용이 잘리거나 넘치지 않게 한다(접근성). 그래서 시안 값은 평소 크기로 그대로 쓰고, 늘어나거나 줄어들어야 하는 쪽만 막지 않는다.

- 글자를 담는 요소의 높이는 시안 값을 `min-h-*`로 쓴다. 평소엔 시안과 같고, 글자가 커지거나 두 줄이 될 때만 늘어난다.
- 고정 폭은 시안 값을 쓰되 부모보다 넓어지지 않게 `w-[<폭>] max-w-full`로 쓴다. `%`는 화면이 아니라 부모 기준이라, 띄운 패널(absolute·fixed)은 `w-[min(<폭>,calc(100vw-<여백>))]`로 화면에 상한을 건다. 최소 폭은 부모 폭이 정해진 곳에서만 `min-w-[min(<폭>,100%)]`로 쓴다.
- 채우되 최대 폭이 있으면(Fill) 가로 행에서는 `flex-1 min-w-0 max-w-[<폭>]`, 세로로 쌓을 때는 `w-full max-w-[<폭>]`로 쓴다.
- 카드처럼 글자와 함께 커져야 하는 크기는 rem으로 쓴다(3-3). 아이콘·아바타·미디어는 고정 크기 그대로 둔다.
- 좁아질 때 줄어들 수 있게 flex·grid 자식에는 `min-w-0`(grid 트랙은 `minmax(0,1fr)`), 스크롤 영역까지 이어지는 래퍼에는 `min-h-0`을 준다.
- 화면 높이는 `h-dvh`·`min-h-svh`로 쓴다. `100vh`는 모바일에서 주소창 밑으로 내용이 빠진다.

```tsx
// ✗ 라벨이 길어지거나 글자가 커지면 잘린다
<button type="button" className="h-10 px-4 text-label-m-emphasis">저장</button>

// ✓ 평소엔 같고 내용이 커질 때만 늘어난다
<button type="button" className="inline-flex min-h-10 items-center px-4 py-2 text-label-m-emphasis">저장</button>
```

### 3-3. 글자를 따라 커져야 하면 rem (px vs rem)

목적은 3-2와 같다. rem은 기본 글자 크기(16px)에서 px와 같아서 시안과 똑같이 보이고, 사용자가 기본 글자 크기를 키우면 함께 커진다. 그래서 글자를 따라 커져야 하는 값은 rem, 아니면 px로 쓴다. 줌은 px까지 키우지만 기본 글자 크기 설정은 rem만 키운다.

| 값 | 쓸 것 |
| :-- | :-- |
| 글자 크기·줄 높이 | 타이포 토큰(3-6) |
| 간격·gap·padding | Tailwind 간격 스케일(rem). Figma px ÷ 4: 16px → `p-4`, 18px → `p-4.5`. 제목↔본문 간격도 글자를 따라 커져야 읽힌다 |
| 테두리·구분선 | px(`border`) |
| 카드 최소 폭 | rem과 상한: `grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))]` |

- 타이포 토큰은 아직 px다. 그래도 버튼·헤더 padding은 간격 스케일을 쓰고, 타이포를 rem으로 옮길 때 단위를 다시 정한다.

### 3-4. 반응형은 세 축으로 나눈다 (Device · Viewport · Container)

화면이 바뀌는 이유가 기기인지, 화면 폭인지, 놓인 영역의 폭인지로 축을 고른다. 이유에 맞는 축 하나만 써야 어느 값이 정본인지 분명하다.

| 무엇이 다른가 | 쓸 것 |
| :-- | :-- |
| 기기(터치·바텀시트·하단 탭바) | `mobile:` variant. 구조가 다르면 `useMobileView()`로 컴포넌트를 고른다 |
| 뷰포트 폭(랜딩·홈 목록 열 수) | 테마 브레이크포인트(`sm:`·`lg:`·`landing-sm:`) |
| 놓인 영역의 폭(크기가 바뀌는 패널) | 이름 있는 컨테이너 쿼리(`@container/plan`) |

- `mobile:`은 UA로 판별해 `html`에 붙인 클래스를 본다. 창을 줄여도 나오지 않으므로 기기 에뮬레이션이나 실기기로 확인한다.
- 같은 속성을 두 축으로 중복하지 않는다. 새 브레이크포인트를 더하지 않는다.
- px 기준(`s1`·`s2`·`landing-*`)과 rem 기준(`sm`·`md`·`lg`)을 한 요소에 섞지 않는다. px 기준이 먼저 출력돼 더 넓은 `landing-lg:`가 `sm:`에 진다. 글자 크기 설정을 따르는 것은 rem 기준뿐이다.
- 쿼리보다 내재적 방식(`flex-wrap`, `auto-fill`과 `minmax`, `min()`·`clamp()`)이 먼저다. 쿼리는 구조가 바뀌는 지점에만 쓴다.
- 카드 그리드는 시안의 열 수와 카드 폭을 맞추고, 화면이 넓어져 남는 폭은 여백으로 둔다(`lg:grid-cols-[repeat(3,minmax(0,20rem))] justify-center`). 글자가 커질 때 열이 줄어야 하면 `auto-fill`과 rem 최소 폭을 쓴다(3-3).
- 문서형 화면은 `mx-auto w-full max-w-[…] px-…`로 만든다. 가운데는 최대 폭만, 좌우는 최소 여백만 정한다.
- `hover:`는 터치 기기에서 적용되지 않는다. hover로만 드러나는 정보를 만들지 않는다.

```tsx
// ✗ 같은 값을 두 축에 겹쳐 준다
<div className="px-6 mobile:px-5 max-sm:px-5">…</div>

// ✓ 차이를 만드는 축 하나만 쓴다(기기 차이면 mobile:)
<div className="px-6 mobile:px-5">…</div>
```

### 3-5. 겹침은 스태킹 컨텍스트부터 (Stacking Context)

z-index는 같은 스태킹 컨텍스트 안에서만 비교된다. 그래서 숫자를 올리기 전에 그 요소가 어느 컨텍스트에 있는지부터 본다.

1. 컨텍스트를 만드는 것을 찾는다. z가 있는 `relative`·`absolute`·flex·grid 자식, `fixed`·`sticky`, `@container`, `opacity` 1 미만, `transform`·`translate-*`, `filter`·`backdrop-blur-*`가 컨텍스트를 만든다.
2. 컴포넌트 안 겹침은 루트에 `isolate`를 주고, 위치를 준 자식에 `z-0`·`z-10` 같은 작은 값을 쓴다.
3. 부모 밖으로 떠야 하면 portal로 렌더한다.
4. 화면 전체를 덮으면 공용 셸을 쓴다(1-1).

새 z값으로 다른 레이어를 이기려 하지 않는다.

```tsx
// ✗ 가려지니 숫자를 올린다. 부모가 컨텍스트를 만들었으면 올려도 나오지 못한다
<div className="absolute z-[9999]">…</div>

// ✓ 컴포넌트 안 겹침은 루트에서 가둔다
<div className="relative isolate">
  <Avatar />
  <span className="absolute end-0 top-0 z-10 size-2 rounded-full bg-status-negative" />
</div>
```

### 3-6. 값은 토큰, 클래스는 완성된 문자열 (Design Tokens)

값은 디자인 시스템 토큰에서 가져온다. 그래야 디자인이 바뀔 때 한 곳만 고치면 된다. 클래스는 Tailwind가 소스에서 읽을 수 있는 완성된 문자열로 쓴다.

- 토큰 이름은 `tailwind.config.js`에서 고른다. 색 우선순위와 원시 색 쓰는 법은 Design.md 1-1을 따른다. 레거시 별칭(`dark-gray`·`gray-border` 등)은 쓰지 않는다.
- 타이포는 토큰 하나로 쓴다. display·heading·title은 `text-<역할>-<크기>`(`text-title-m`), body·label·caption은 굵기까지 붙인다(`text-body-s-regular`). `text-body-s`처럼 없는 이름은 CSS가 생기지 않는다.
- 타이포 토큰에 `font-*`·`leading-*`·`tracking-*`·`/N`을 덧붙이지 않는다(토큰 값을 덮거나 굵기·자간이 빠진다). 맞는 토큰이 없으면 Figma 값대로 크기·줄 높이·굵기를 함께 임의값으로 쓰고(`text-[17px]/[24px] font-semibold`) 근거 주석을 단다(Design.md 1-2).
- radius는 재정의된 토큰을 쓴다(`rounded-md` = 8px, Tailwind 기본과 다르다). 그림자 토큰은 아직 없다. `shadow-sm` 같은 Tailwind 기본값 대신 Figma 값을 임의값과 근거 주석으로 쓴다. 같은 임의값이 반복되면 토큰 추가를 요청한다.
- 클래스는 `cn()`으로만 합친다. 템플릿 리터럴은 겹친 클래스(`px-2`와 바깥 `px-4`)를 정리하지 못하고, 조립한 이름(`` `bg-${tone}` ``)은 Tailwind가 소스에서 찾지 못한다. 변형은 `as const` 클래스 맵에 모은다.
- 상태 스타일은 aria 속성을 variant로 읽는다(`aria-expanded:bg-fill`, `aria-current="page"`는 `aria-[current=page]:`). aria가 없는 상태만 `data-*`로 둔다. 여러 하위가 함께 따르는 루트 상태(채팅 최소화·밀도)는 하위마다 prop으로 내리지 않고, 루트의 `data-minimized`를 하위가 `group-data-minimized/chat:`처럼 읽는다.
- 전역 요소 스타일은 `@layer base`에 둔다. 레이어 밖 CSS는 모든 유틸리티를 이긴다.

```tsx
// ✗ 문자열 결합과 조립한 클래스 이름
<span className={`rounded-full px-2 ${className} bg-${tone}`}>{label}</span>

// ✓ 완성된 클래스 맵과 cn
const TONE_CLASS = {
  neutral: "bg-fill text-text",
  brand: "bg-primary-subtle text-primary",
} as const;
<span className={cn("rounded-full px-2", TONE_CLASS[tone], className)}>{label}</span>
```

### 3-7. 시맨틱 마크업과 접근성 (Semantic HTML)

키보드와 스크린리더로도 같은 일을 할 수 있어야 한다. 브라우저 기본 요소(`button`·`Link`·`label`)를 쓰면 그 동작이 대부분 따라온다.

- 동작은 `button`(form 제출이 아니면 `type="button"`), 이동은 `Link`로 만든다. `div`·`li`에 `onClick`을 달지 않는다.
- 아이콘만 있는 버튼에는 `aria-label`을 단다. 입력은 `label`과 연결한다(placeholder는 라벨이 아니다). 필드 오류는 `aria-invalid`와 `aria-describedby`로 알린다.
- 포커스 표시는 `focus-visible:outline-2 focus-visible:outline-primary`로 둔다. 같은 요소에 `outline-none`·`outline-hidden`을 함께 두지 않는다(v4에서 윤곽선이 사라진다). 입력은 `focus:outline-hidden`과 감싸는 필드의 `focus-within:border-primary`로 표시한다.
- 모바일에서 누르는 영역은 44×44px 이상으로 둔다. 시각 크기는 Figma대로 두고 영역만 `size-*`·padding으로 키운 뒤 음수 margin으로 되돌린다.
- 모바일 입력 글자는 16px 이상으로 둔다(iOS가 확대한다). viewport 설정으로 확대를 막지 않는다. 움직이는 애니메이션은 `motion-safe:`·`motion-reduce:`로 감싼다.

```tsx
// ✗ 키보드로 닿지 않고 스크린리더가 버튼으로 읽지 않는다
<div onClick={onDelete}><TrashIcon /></div>

// ✓ 시각 크기는 24px, 누르는 영역은 44px
<button type="button" aria-label="삭제" onClick={onDelete} className="-m-2.5 grid size-11 place-items-center">
  <TrashIcon />
</button>
```

## 출처

| 원칙 | 출처 |
| :-- | :-- |
| 0 | React [Thinking in React](https://react.dev/learn/thinking-in-react)·[Keeping Components Pure](https://react.dev/learn/keeping-components-pure), Josh Comeau [Understanding Layout Algorithms](https://www.joshwcomeau.com/css/understanding-layout-algorithms/) |
| 1-1 | [shadcn/ui](https://ui.shadcn.com/docs) |
| 1-3 | React [Thinking in React](https://react.dev/learn/thinking-in-react), Matt Pocock [codebase-design](https://github.com/mattpocock/skills)(삭제 테스트) |
| 1-4 | Vercel [composition-patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) `architecture-avoid-boolean-props`·`patterns-explicit-variants`·`patterns-children-over-render-props` |
| 2-1 | React [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure), Vercel [react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) `rerender-derived-state-no-effect` |
| 2-2 | React [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)·[Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context), Kent C. Dodds [Colocation](https://kentcdodds.com/blog/colocation) |
| 2-3 | TkDodo [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)·[Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query) |
| 2-4 | TkDodo [Status Checks in React Query](https://tkdodo.eu/blog/status-checks-in-react-query) |
| 2-5 | TanStack Query [Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) |
| 2-6 | React [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)·[Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects), Vercel react-best-practices `rerender-move-effect-to-event` |
| 2-7 | Vercel react-best-practices `rerender-simple-expression-in-memo`, React [useMemo](https://react.dev/reference/react/useMemo), Dan Abramov [Before You memo()](https://overreacted.io/before-you-memo/) |
| 2-8 | React [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)·[Rendering Lists](https://react.dev/learn/rendering-lists) |
| 3-1 | Max Stoiber [Margin considered harmful](https://mxstbr.com/thoughts/margin) |
| 3-2 | Josh Comeau [The Height Enigma](https://www.joshwcomeau.com/css/height-enigma/), [Defensive CSS](https://defensivecss.dev/), web.dev [Viewport units](https://web.dev/blog/viewport-units) |
| 3-3 | Josh Comeau [The Surprising Truth About Pixels and Accessibility](https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/) |
| 3-5 | Josh Comeau [What The Heck, z-index??](https://www.joshwcomeau.com/css/stacking-contexts/) |
| 3-6 | Tailwind [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files) |
