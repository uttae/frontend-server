---
name: open-pr
description: 작업 브랜치에 최신 대상 브랜치를 반영하고 lint·test·build를 통과시킨 뒤, PR 템플릿을 채워 확인을 받고 gh로 PR을 연다. "PR 올려줘", "PR 만들어줘", "작업 마무리하고 PR" 같은 요청이나 /open-pr에서 사용한다. 병합은 하지 않는다.
argument-hint: [노션 링크]
---

# PR 올리기

인자: $ARGUMENTS (노션 링크가 들어올 수 있다)

규칙의 정본은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)와 [PR 템플릿](../../../.github/pull_request_template.md)이다.

병합은 리뷰어가 확인하고 직접 한다. 이 스킬은 PR을 여는 데까지만 하고 `gh pr merge`를 실행하지 않는다.

## 0. 준비

- `gh auth status`가 실패하면 멈추고 `! gh auth login` 실행을 안내한다.
- 현재 브랜치가 `main`이나 `dev`면 멈춘다.
- 브랜치 접두사로 PR 대상과 제목 타입을 정한다. 표에 없는 접두사면 대상 브랜치를 묻는다.

  | 접두사 | PR 대상 | 제목 타입 |
  | :-- | :-- | :-- |
  | `feature/` | `dev` | `feat` |
  | `fix/` | `dev` | `fix` |
  | `refactor/` | `dev` | `refactor` |
  | `chore/` | `dev` | `chore` |
  | `docs/` | `dev` | `docs` |
  | `hotfix/` | `main` | `fix` |

- `gh pr view --json url,state`로 이 브랜치의 열린 PR이 있는지 확인한다. 이미 있으면 새로 만들지 않고, 1~3단계 후 push만 하고 기존 PR 주소를 알린다.

## 1. 커밋하지 않은 변경

`git status --short`에 변경이 있으면 요약해 보여 주고 이번 PR에 넣을지 묻는다. 넣기로 한 변경만 AGENTS.md의 커밋 메시지 규칙으로 커밋한다.

## 2. 최신 대상 브랜치 반영

```bash
git fetch origin --prune
git rev-list --count HEAD..origin/<대상>
```

0보다 크면 `git merge --no-edit origin/<대상>`으로 반영한다. rebase나 force-push는 하지 않는다. PR은 squash 병합되므로 작업 브랜치 안의 merge commit은 대상 브랜치에 남지 않는다.

충돌이 나면 충돌 파일과 양쪽 변경 요지를 보여 주고 멈춘다. 어느 쪽을 살릴지 사용자와 정한 뒤 해결한다. 그만두려면 `git merge --abort`로 되돌릴 수 있다고 알린다.

## 3. 검증

`git diff --name-only origin/<대상>...HEAD`가 문서(`*.md`)·`.claude/`·`.github/`뿐이면 검증을 생략하고 테스트 칸에 생략했다고 쓴다.

그 외에는 순서대로 실행하고, 실패하면 다음 명령으로 넘어가지 않는다.

1. `npm run lint`
2. `npm test`
3. `npm run build`

실패하면 PR을 열지 않는다. 실패한 명령, 파일·테스트 이름, 핵심 에러 몇 줄만 보여 준다. 이번 변경 때문인지 판단해 알리고, 고칠지 묻는다. 이번 변경과 무관해 보이면 근거(변경 파일과 실패 위치의 관계)를 들어 그대로 PR을 열지 묻는다. 열기로 하면 테스트 칸에 실패 항목과 사유를 적는다.

## 4. 본문 작성

- 제목: `<타입>(<scope>): <한국어 요약>`. scope는 커밋들의 대표 scope 하나이며, 없으면 생략한다.
- 본문은 PR 템플릿의 섹션 순서와 제목을 그대로 쓰고, HTML 주석은 지운다.
  - `노션`: 인자나 대화에 링크가 있으면 넣는다. 없으면 5단계에서 묻는다. 링크가 없으면 섹션을 통째로 지운다.
  - `변경 내용`: `git log origin/<대상>..HEAD`와 diff를 보고 리뷰어가 확인할 핵심만 3~5줄로 쓴다. 파일 목록을 나열하지 않는다.
  - `변경 이유`: 1~2줄. 배경은 노션에 있으니 길게 쓰지 않는다.
  - `테스트`: 3단계에서 통과한 명령만 `[x]`로 체크한다. 화면 확인 같은 수동 검증은 실제로 한 것만 적고, 하지 않은 항목은 지운다.

## 5. 확인

PR을 열면 디스코드 알림이 자동으로 나가므로, 확인받기 전에는 push하거나 PR을 열지 않는다.

대상 브랜치, 제목, 본문을 보여 주고 한 번에 묻는다.

- 노션 링크(링크가 아직 없을 때만): "없음" 또는 직접 입력
- 이대로 올릴지: 올리기 / 수정

## 6. PR 열기

본문은 저장소 밖 임시 파일(스크래치 디렉터리가 있으면 그곳, 없으면 `mktemp`)에 쓴다.

```bash
git push -u origin <브랜치>
gh pr create --base <대상> --head <브랜치> --title "<제목>" --body-file <임시 파일>
```

PR 주소를 알린다. `hotfix/`였다면 "병합 후 main → dev 백머지 PR이 필요합니다"를 한 줄 덧붙인다.
