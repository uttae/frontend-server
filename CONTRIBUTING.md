# 기여 가이드

이 문서는 커밋, 브랜치 생성, Pull Request(PR), 병합 정책의 상세 기준입니다.

## 작업하고 PR 올리기

커밋 제목은 Conventional Commits 형식으로 한국어로 작성합니다.

```
feat: 일정 공유 기능 추가
fix: 장소 검색 오류 수정
docs: 개발자 온보딩 보완
```

- `main`은 배포 기준 브랜치입니다. 직접 push하지 않고 모든 변경을 PR로 병합합니다.
- `dev`는 기능을 통합하고 릴리스 전에 함께 검증하는 브랜치입니다.
- 작업 브랜치는 아래 `브랜치 종류` 표의 기준 브랜치 최신 상태에서 만들고, 같은 표의 PR 대상으로 PR을 엽니다.
- 브랜치는 하나의 작업 단위로 짧게 유지하며, squash 병합이 끝난 브랜치는 다시 사용하지 않습니다.

## 브랜치 종류

| 브랜치 | 용도 | 기준 브랜치 | PR 대상 | 커밋·PR 타입 |
| :-- | :-- | :-- | :-- | :-- |
| `feature/<topic>` | 새 기능, 화면·디자인 변경 | `dev` | `dev` | `feat` |
| `fix/<topic>` | 다음 배포에 함께 나가도 되는 버그 수정 | `dev` | `dev` | `fix` |
| `refactor/<topic>` | 동작이 바뀌지 않는 구조 개선 | `dev` | `dev` | `refactor` |
| `chore/<topic>` | 빌드·설정·의존성·개발 도구 | `dev` | `dev` | `chore` |
| `docs/<topic>` | 문서만 변경 | `dev` | `dev` | `docs` |
| `hotfix/<topic>` | 운영 장애처럼 바로 배포해야 하는 수정 | `main` | `main` | `fix` |

- `<topic>`은 영어 소문자 kebab-case로 짧게 씁니다. 예: `feature/calendar-design`, `fix/logout-session`
- 표에 없는 접두사(`feat/`, `codex/` 등)로 새 브랜치를 만들지 않습니다.

## 공통 브랜치 흐름

브랜치 병합에는 다음 공통 흐름을 적용합니다.

| 병합 방향 | 방식 |
| :-- | :-- |
| `feature/*`, `fix/*`, `refactor/*`, `chore/*`, `docs/*` → `dev` | Squash and merge |
| `dev` → `main` | Create a merge commit |
| `hotfix/*` → `main` | Squash and merge |
| `main` → `dev` 백머지 | Create a merge commit |

- hotfix나 revert가 `main`에 먼저 반영되면 최신 `main`의 정확한 HEAD를 merge commit으로 `dev`에 백머지합니다. cherry-pick, re-squash 또는 동일한 패치를 다시 적용하는 방식으로 전달하지 않습니다.
- 백머지 충돌을 해결하고 결과를 검증하기 전에는 다음 `dev` → `main` 릴리스를 병합하지 않습니다.
- Rebase merge는 사용하지 않습니다.
- 공유 중인 `main`과 `dev`의 이력을 재작성하거나 force-push하지 않습니다.
- 정책 도입 전의 기존 이력과 merge commit은 역사적 예외로 그대로 보존합니다. 토폴로지를 정리할 목적만으로 revert하거나 이력을 재작성하지 않습니다.

## Pull Request Rules
- PR 제목은 커밋 컨벤션과 동일한 형식(feat: ...)을 따른다.
- main으로 직접 merge 전 최소 1명의 리뷰가 필요하다.
- PR 본문은 .github/pull_request_template.md 형식을 그대로 따른다.
- PR 본문에 변경 이유와 테스트 방법을 간략히 적는다.
- PR을 열기 전에 대상 브랜치의 최신 상태를 작업 브랜치에 merge로 반영한다. 이미 push한 작업 브랜치는 rebase하거나 force-push하지 않는다.
- 병합은 리뷰어가 확인한 뒤 위 `공통 브랜치 흐름`의 방식으로 한다.

## PR 전 검증

- 작업 중에는 전체 테스트를 돌리지 않는다. 필요한 확인만 한다.
- PR을 열기 전에 `npm run lint` → `npm test` → `npm run build`를 한 번 실행하고, 결과를 PR 본문 테스트 칸에 체크한다.
- 문서(`*.md`)·`.claude/`·`.github/`만 바뀐 PR은 생략할 수 있다. 생략하면 테스트 칸에 생략했다고 적는다.
- 화면이 바뀌면 아래 기준으로 환경을 골라 스크린샷을 확인한다.

### 화면 확인 기준

| 변경 종류 | PC 크롬 | PC 사파리 | 안드로이드 (크롬 에뮬레이션) | 아이폰 (시뮬레이터) |
| :-- | :-: | :-: | :-: | :-: |
| 로직·데이터만 (화면 변화 없음) | ✓ | | | |
| PC 레이아웃·스타일 | ✓ | 사파리 주의 CSS일 때 | | |
| 모바일 레이아웃 | | | ✓ | ✓ |
| 터치·드래그·키보드·포커스·바텀시트 | | | ✓ + 직접 조작 | ✓ + 직접 조작 |
| `dev` → `main` 배포 | ✓ | ✓ | ✓ | ✓ |

- 사파리 주의 CSS: `fixed`·`sticky`, `h-screen`·`dvh`·`svh`, `safe-area`, `backdrop-filter`, 날짜·시간 input, 스크롤 동작, 16px 미만 글자의 input
- 앱은 User-Agent로 모바일 화면을 판단한다. 크롬 창 크기만 줄이면 모바일 화면이 나오지 않으므로 기기 에뮬레이션을 쓴다.
- `npm run screens -- --path /home --targets pc-chrome,android --label after`로 찍으면 `.screens/after/`에 저장된다. 처음에는 `npm run screens -- login`으로 로그인 상태를 저장하고, 아이폰 시뮬레이터 Safari에서도 한 번 로그인한다.
- 백엔드 CORS와 구글 로그인이 `localhost:3000`만 허용하므로, 여러 worktree를 쓸 때도 확인할 폴더의 dev 서버 하나만 3000번으로 띄운다.

## 작업 공유

| 위치 | 내용 |
| :-- | :-- |
| 노션 작업 페이지 | 작업 배경(왜 시작했는지), 논의 내용, 전후 스크린샷, 개발 메모 |
| PR | 변경 내용, 짧은 변경 이유, 테스트 결과, 노션 페이지 링크 |
| 디스코드 | PR을 열면 GitHub Actions가 자동으로 알린다. 작업 내역을 따로 보내지 않는다. |

- 노션 페이지가 없는 작은 작업은 PR 본문의 `노션` 칸을 지운다.

## Claude Code 스킬

저장소의 `.claude/skills/`에 위 규칙을 따르는 스킬이 있다. 사용하려면 [GitHub CLI](https://cli.github.com/)를 설치하고 `gh auth login`으로 로그인한다.

| 명령 | 하는 일 |
| :-- | :-- |
| `/start-work <작업 설명>` | 브랜치 종류·이름을 정하고 최신 기준 브랜치에서 브랜치를 만든다. |
| `/check-screens [경로...] [before\|after]` | 위 `화면 확인 기준`대로 환경을 골라 스크린샷을 찍고 깨짐을 확인한다. |
| `/open-pr [노션 링크]` | 대상 브랜치 반영 → lint·test·build·화면 확인 → 템플릿 작성 → 확인 후 PR을 연다. 병합은 하지 않는다. |
