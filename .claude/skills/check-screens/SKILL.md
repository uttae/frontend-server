---
name: check-screens
description: 바뀐 화면을 PC 크롬·PC 사파리(WebKit)·안드로이드(크롬 기기 에뮬레이션)·아이폰 시뮬레이터 Safari에서 스크린샷으로 찍어 깨짐을 확인한다. "화면 확인", "스크린샷 찍어줘", "기기별로 봐줘" 같은 요청이나 /check-screens, /open-pr 검증 단계에서 사용한다.
argument-hint: [경로...] [before|after]
---

# 화면 확인

인자: $ARGUMENTS (경로와 라벨이 들어올 수 있다)

어떤 변경에 어떤 환경을 볼지는 [CONTRIBUTING.md](../../../CONTRIBUTING.md)의 `화면 확인 기준` 표가 정본이다. 스크린샷은 `scripts/check-screens.mjs`(`npm run screens`)가 찍는다.

## 0. 처음 한 번 준비

스크립트가 로그인 화면으로 이동됐다고 하거나 브라우저가 없다고 하면 아래를 안내하고 멈춘다.

- PC 크롬·사파리·안드로이드 로그인: `npm run screens -- login`을 실행하면 크롬 창이 열린다. 구글 로그인을 끝내면 `~/.cache/uttae/check-screens/`에 저장되고 세 환경이 함께 쓴다.
- 아이폰 로그인: 시뮬레이터 Safari에서 `http://localhost:3000/login`을 열어 한 번 로그인한다. 시뮬레이터는 쿠키를 따로 쓴다.
- 브라우저: `npx playwright install chromium webkit`
- 시뮬레이터: Xcode가 있어야 한다. 기본 기기는 `iPhone 17`이고 `--iphone "<기기 이름>"`으로 바꾼다.

## 1. 환경 고르기

CONTRIBUTING.md 표를 기준으로 `--targets`를 정한다. 값은 `pc-chrome`, `pc-safari`, `android`, `iphone`이다.

- PC 화면을 바꾸면서 아래 중 하나를 건드렸으면 `pc-safari`를 넣는다: `fixed`·`sticky`, `h-screen`·`dvh`·`svh`, `safe-area`, `backdrop-blur`·`backdrop-filter`, 날짜·시간 input, 스크롤 동작(`overflow`, `scroll-snap`), 16px 미만 글자의 input
- 판단이 어려우면 4개를 모두 찍는다.

## 2. 경로 고르기

- 인자로 경로를 받았으면 그대로 쓴다.
- 없으면 `git diff --name-only origin/dev...HEAD`와 작업 트리 변경에서 화면을 찾는다.
  - `src/app/**/page.tsx`는 경로로 바꾼다. `(main)` 같은 괄호 그룹은 빼고, `[roomId]` 같은 동적 값은 실제 값이 필요하다.
  - 컴포넌트는 사용처를 검색해 그 컴포넌트가 보이는 페이지를 찾는다.
- 동적 값(방 ID 등)이나 화면에 들어가는 방법을 모르면 사용자에게 예시 URL을 묻는다. 대화 안에서 받은 값은 다시 묻지 않는다.
- 한 번에 1~4개 경로만 찍는다.

## 3. dev 서버

스크립트는 3000번 dev 서버가 지금 폴더의 코드인지 검사한다. 백엔드 CORS와 구글 로그인이 3000번만 허용하므로 다른 포트는 쓰지 않는다.

- 서버가 없으면 이 폴더에서 `npm run dev`를 백그라운드로 띄우고, 응답할 때까지 기다린다.
- 다른 폴더(다른 worktree)의 서버가 3000번을 쓰고 있으면 멈추고 사용자에게 알린다. 그 서버를 임의로 끄지 않는다.

## 4. 찍기

```bash
npm run screens -- --path <경로> [--path <경로>] --targets <대상,...> --label <라벨>
```

- 라벨: 작업 시작 전에는 `before`, PR 전에는 `after`. 노션 전후 비교에 그대로 쓴다. 생략하면 시간이 붙는다.
- 긴 화면은 `--full`, 안드로이드 기기를 바꾸려면 `--android-device "Galaxy Z Fold 7"`처럼 Playwright 기기 이름을 넘긴다.
- 지도처럼 늦게 그려지는 화면은 `--wait 4000`, 아이폰은 `--iphone-wait 6000`으로 늘린다.

## 5. 확인

찍은 이미지를 직접 열어 본다. 출력 표와 `.screens/<라벨>/results.json`도 확인한다.

- 로그인 화면이 찍혔으면(아이폰은 이미지로 판단) 0단계 로그인을 안내하고 멈춘다.
- 콘솔 에러가 있으면 `results.json`의 메시지를 요약한다.
- 넘침, 잘림, 겹침, 가로 스크롤, 빈 화면, 끝나지 않는 스켈레톤을 찾는다.
- Figma 링크가 있는 디자인 작업이면 Figma 노드와 px 단위로 비교한다. PC 스크린샷은 1배율이라 이미지 px이 CSS px과 같다. 안드로이드·아이폰은 3배율이다.
- 터치, 드래그, 키보드, 포커스는 스크린샷으로 확인할 수 없다. 해당 변경이면 사람이 직접 눌러 볼 항목을 구체적으로 적는다.

## 6. 보고

- 환경별 결과를 한 줄씩 적는다(이상 없음 / 문제 요약).
- 이미지 폴더 경로(`.screens/<라벨>/`)를 알린다.
- 사람이 직접 확인할 조작 항목이 있으면 목록으로 남긴다.
