# Design.md

> 값의 원천은 코드다. 이 문서는 값을 갖지 않고, 어디를 봐야 하는지와 무엇을 하면 안 되는지만 정한다.

## 1. 공통 원칙

### 1-1. 토큰 우선순위
1. 시맨틱 토큰 — `primary`, `surface`, `border`, `danger` …
2. 원시 토큰 — `blue-100` 등. 1에 마땅한 게 없을 때만
3. 임의값 — `text-[17px]`, `#3B82F6`

- 값의 정의는 전부 `tailwind.config.js`(+ `src/app/globals.css`)에 있다. 이 문서에 값을 적지 않는다.
- 위에서부터 가능한 단계를 쓴다.

### 1-2. 임의값 사용 규칙
디자인 파일을 우선시하며, 토큰과 임의값의 사용은 디자인파일의 구현을 따른다.
예를들어서 피그마 페이지에 폰트가 17px이고 시멘틱 토큰과 css변수가 없다면 임의값을 사용한다.

### 1-3. 컴포넌트
- 공통 컴포넌트는 `src/components/<도메인>/`(`layout`, `place`, `map`, `settings` …)에 있다. 있으면 쓴다
- 특정 페이지 전용 컴포넌트는 `src/app/**/_components/`에 둔다
- 없으면 Tailwind로 직접 작업한다

---

## 2. 아이콘의 사용
- 아이콘은 [Figma 디자인 시스템 Icon](https://www.figma.com/design/uJLn6DbZ6MMpWyfuOXr6wu/Uttae_%ED%86%B5%ED%95%A9?node-id=201-12969)을 우선 사용한다
  - 필요한 아이콘이 Figma에 없으면 임의로 만들거나 다른 라이브러리에서 가져오지 말고, 디자이너/개발자에게 추가를 요청한다
- SVGR로 SVG를 React 컴포넌트로 만들어 쓴다. `<img src>`·`next/image`·CSS `mask`로 SVG를 직접 쓰지 않는다
- 크기 규격: Figma 권장 사이즈(12 / 16 / 20 / 24 / 28 / 32)를 따른다
- stroke는 1.8로 고정한다. 아이콘 크기를 줄여도 선 굵기는 1.8px로 유지된다(`createIcon`이 처리)
- 기존 `lucide-react`, `src/components/icons/`, `public/icons/`의 SVG는 Figma 아이콘 컴포넌트로 점진적으로 전환한다. 신규 코드에서 새로 추가하지 않는다

### 2-1. 아이콘 추가
1. Figma에서 SVG를 받는다
   - 인스턴스가 아니라 **디자인 시스템의 원본 컴포넌트(24×24)** 를 받는다. 16·20 크기로 쓰인 인스턴스를 받으면 viewBox가 달라진다
2. `src/assets/icons/`에 넣는다
   - 파일명은 kebab-case로, Figma 이름을 따른다. variant가 있으면 `<컴포넌트 세트>-<type>` (예: `chevron-left.svg`, `calendar-add.svg`, `reaction-star.svg`). `type=default`는 붙이지 않는다 (`close.svg`)
3. 파일 값을 3가지 수정한다
   ```html
   <!-- Figma에서 받은 원본 -->
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
     <path d="M6 9L12 15L18 9" stroke="#3B3F4E" stroke-width="1.8" .../>
   </svg>

   <!-- 수정 후 -->
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
     <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.8" .../>
   </svg>
   ```
   - `width`, `height` 삭제 (`viewBox`는 반드시 남긴다)
   - `stroke="#3B3F4E"` → `stroke="currentColor"`. 색이 `fill`에 있는 아이콘이면 `fill="currentColor"`
   - `viewBox`가 `0 0 24 24`인지 확인한다
4. `src/assets/icons/index.tsx`에 추가한다
   ```tsx
   import MapPinSvg from "@/assets/icons/map-pin.svg";            // 위쪽 import 구역

   export const MapPinIcon = createIcon(MapPinSvg, "MapPinIcon");  // 아래쪽 export 구역
   ```

### 2-2. 아이콘 사용
```tsx
import { MapPinIcon } from "@/assets/icons";

<MapPinIcon />                                  // 24px, 색은 부모 글자색
<MapPinIcon size={16} className="text-primary" />
```
- 크기는 `size`(기본 24), 색은 `text-*` 토큰으로 준다 (`currentColor`)
- 장식용이라 기본으로 `aria-hidden`이다. 아이콘만 있는 버튼은 버튼에 `aria-label`을 단다
- SVGR 설정은 `next.config.ts`의 `turbopack.rules`에 있고, `src/assets/icons/` 안의 SVG에만 적용된다
- 테스트(Vitest)에서는 `vitest.config.ts`의 `vite-plugin-svgr`가 같은 폴더를 같은 방식으로 변환한다


---

## 3. 프론트

### 3-1. 상태
- 서버 상태 → TanStack Query
- 클라이언트 상태 → Zustand
- 서버에서 온 데이터를 Zustand에 복사해두지 않는다

### 3-2. 필수 상태 처리
데이터를 다루는 화면은 다음을 빠짐없이:
- loading
- error
- empty

### 3-3. 이벤트 피드백
- 사용자 액션에는 결과 피드백이 있어야 한다
- 현재 alert 는 toast를 사용하고, confirm은 시스템confirm 과 dialog가 혼용되고 있는 상태이다. 새로 작성하는 코드는 dialog를 우선시하되 요구조건에 맞춰서 해라
- 비동기 동작 중 중복 실행 방지


---

## 4. 체크리스트

작업 완료 후 자가 점검:

- [ ] Design Token이 있는데 인라인 tailwind를 사용한 값이 없는지
- [ ] 이벤트 피드백/실패처리가 없는 이벤트는 없는지

---

## 5. 부록
- 다크모드: 사용하지 않음
