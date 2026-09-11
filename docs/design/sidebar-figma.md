# 사이드바 Figma 원본

- 기준: [사이드바 초안 811:1211](https://www.figma.com/design/uJLn6DbZ6MMpWyfuOXr6wu/Uttae?node-id=811-1211)
- 확인일: 2026-09-11
- 폭 94px, 아이콘 36px, 일반 메뉴 높이 92px(첫 일정 메뉴 90px).
- 선택된 메뉴 전체에 primary/default 배경, icon/inverse 아이콘·텍스트를 적용한다.
- 주요 메뉴는 label/m/emphasis, 하단 피드백·버그제보는 14px Regular를 사용한다.
- 원본 높이 1080px은 화면 높이에 맞춰 늘이거나 줄인다. 하단 버튼은 아래에 배치하고, 낮은 화면에서는 사이드바를 스크롤해 모든 메뉴에 접근한다.

SVG는 `get_design_context`가 반환한 에셋을 수정 없이 다운로드했다. 원본 URL은 만료되므로 로컬 파일을 사용한다. 선택 상태의 색만 CSS mask와 디자인 시스템 semantic token으로 적용한다. 모바일 아이콘은 별도로 유지한다.

| 파일 (`public/icons/sidebar/figma/`) | Figma 노드 |
| --- | --- |
| calendar.svg | 811:1213 |
| search.svg | 811:1217 |
| bookmark.svg | 811:1218 |
| chat.svg | 811:1219 |
| members.svg | 811:1223 |
| feedback.svg | 811:1224 |
| bug.svg | 3011:1083 (`type=default`, 사이드바의 Bug 인스턴스) |

사이드바 프레임 자체에는 로고가 없다. 헤더 홈 링크는 같은 파일의 브랜딩 페이지 [symbol_M 455:1367](https://www.figma.com/design/uJLn6DbZ6MMpWyfuOXr6wu/Uttae?node-id=455-1367)의 원본 검정 심볼을 `public/brand/Symbol_M.svg`로 추출해 45×45px로 사용한다.
