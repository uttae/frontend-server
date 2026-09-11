# 사이드바 Figma 원본

- 기준: [Side Bar 1049:2992](https://www.figma.com/design/uJLn6DbZ6MMpWyfuOXr6wu/Uttae?node-id=1049-2992)
- 확인일: 2026-09-11. 기존 초안 811:1211 대신 사용자가 정정한 이 컴포넌트를 규격의 기준으로 사용한다.
- 레일 폭 68px, 모든 메뉴 68×68px, 아이콘 24×24px.
- 아이콘·글자 간격 2px, 상단 패딩 2px, 중앙 정렬.
- 글자 12px / 행간 16px / 자간 -0.24px. 일반 메뉴와 하단 버튼은 Medium(500), 선택 메뉴는 Bold(700).
- 선택된 메뉴는 primary/default 배경과 text/inverse 글자, 원본 선택 아이콘의 primary/subtle(#d6f2ff) 색상, 일반 메뉴는 text/default 글자를 사용한다.
- 북마크 하단 1px 구분선은 메뉴 높이 안에 배치한다. 사이드바 외곽선과 메뉴 사이 추가 여백은 없다.
- 원본 높이는 800px이며 실제 앱에서는 화면 높이에 맞춘다. 하단 피드백·버그 제보 버튼은 아래에 배치하고, 낮은 화면에서는 사이드바를 스크롤한다.
- 읽지 않은 채팅 배지는 아이콘 오른쪽 위에 배치한다. 16px 높이, 최소 16px 폭, 11px Semibold이며 여러 자릿수는 폭을 늘려 표시한다.

SVG는 새 기준 노드의 `get_design_context`가 반환한 24px 에셋을 수정 없이 다운로드했다. 기존과 같은 아이콘 종류이며 `public/icons/sidebar/figma/`의 로컬 파일을 사용한다. 선택 상태의 아이콘 색만 CSS mask와 semantic token으로 적용한다. 모바일 아이콘은 별도로 유지한다.

| 파일 (`public/icons/sidebar/figma/`) | Figma 버튼 노드 |
| --- | --- |
| calendar.svg | 1043:2869 |
| search.svg | 1043:2883 |
| bookmark.svg | 1043:2889 |
| chat.svg | 1043:2895 |
| members.svg | 1043:2901 |
| feedback.svg | 3140:1881 |
| bug.svg | 1049:2942 |

헤더 홈 열도 공통 레일 폭 68px을 사용한다. 새 사이드바 컴포넌트에는 로고가 없으므로 `main`의 공식 `BrandLogo` 파란 심볼을 사용한다. 사용자 요청에 따라 방 목록 로고와 같은 S 크기(`public/brand/Glyph_S.svg`, 23×23px)로 표시한다. 헤더 높이는 하단 테두리를 포함해 56px이며 제목과 날짜는 두 줄로 유지한다.
