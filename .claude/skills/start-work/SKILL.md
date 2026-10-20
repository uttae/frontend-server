---
name: start-work
description: 새 작업 브랜치를 CONTRIBUTING.md 규칙대로 최신 기준 브랜치(dev, hotfix는 main)에서 만든다. "작업 시작", "브랜치 따줘", "새 작업 들어가자" 같은 요청이나 /start-work에서 사용한다.
argument-hint: <작업 설명>
---

# 작업 시작

작업 설명: $ARGUMENTS

브랜치 종류·기준 브랜치의 정본은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)의 `브랜치 종류` 표다. 이 문서와 다르면 CONTRIBUTING.md를 따른다.

## 1. 브랜치 종류와 이름

- 작업 설명이 비어 있으면 무슨 작업인지 묻는다.
- 설명을 보고 `feature` / `fix` / `refactor` / `chore` / `docs` / `hotfix` 중 하나를 고른다.
- 버그 수정인데 "운영 장애", "바로 배포" 같은 단서가 없으면 `fix`와 `hotfix` 중 무엇인지 묻는다. `hotfix`는 기준 브랜치가 `main`이라 잘못 고르면 되돌리기 번거롭다.
- 이름은 `<종류>/<영어 소문자 kebab-case 2~4단어>`로 짓는다. 예: `feature/calendar-design`
- 같은 이름이 로컬(`git branch --list`)이나 origin(`git ls-remote --heads origin <브랜치>`)에 있으면 다른 이름을 고른다. squash 병합이 끝난 브랜치는 다시 쓰지 않는다.

종류가 분명하면 묻지 않고 바로 진행한다.

## 2. 현재 작업 상태

`git status --short`로 커밋하지 않은 변경을 확인한다.

- 변경이 없으면 3단계로 간다.
- 변경이 있으면 멈추고 어떻게 할지 묻는다. stash·reset·checkout으로 임의로 치우지 않는다.
  - 새 작업에 가져갈 변경: 그대로 새 브랜치를 만든다. `git switch -c`는 작업 트리 변경을 유지한다.
  - 이전 작업의 변경: 사용자가 먼저 커밋하거나, 새 작업을 worktree(`.worktrees/<topic>`)에서 시작한다.

## 3. 최신 기준 브랜치에서 만들기

기준 브랜치는 `hotfix`면 `main`, 나머지는 `dev`다.

```bash
git fetch origin --prune
git switch --no-track -c <브랜치> origin/<기준>
```

worktree에서 시작하기로 했다면:

```bash
git fetch origin --prune
git worktree add --no-track -b <브랜치> .worktrees/<topic> origin/<기준>
```

worktree에는 `node_modules`와 `.env.local`이 없다. worktree에서 `npm ci`로 설치하고, `.env.local`은 원래 저장소에서 복사한다. `node_modules`를 심볼릭 링크로 연결하면 Turbopack 빌드가 "points out of the filesystem root"로 실패한다.

`--no-track`은 새 브랜치가 `origin/dev`를 upstream으로 잡지 않게 한다. upstream은 처음 push할 때 `-u`로 자기 원격 브랜치에 연결한다.

## 4. 보고

- 만든 브랜치 이름과 기준 커밋(`git log --oneline -1`)을 알린다.
- 화면이 바뀌는 작업이면 "노션에 넣을 작업 전 스크린샷을 지금 찍어 두세요"를 한 줄 덧붙인다.
- 작업 중에는 전체 테스트를 돌리지 않는다. lint·test·build는 PR 직전에 `/open-pr`에서 한 번 실행한다.
