# 교체 전 진입점 기록

사용자 요청으로 UI를 별도 폴더에서 다시 시작하기 직전의 `App.tsx`와 웹 스타일을 보관한다. `.snapshot` 파일은 소스나 실행 가능한 이전 모드가 아니며, 앱·웹의 빌드 경로에 포함하지 않는다.

현재 진입점은 저장소 루트 `App.tsx` → `src/ui/App.tsx` 하나다. 과거 `src/app`, `src/features`, `src/layout`, `src/design` 화면 파일들은 새 UI에서 불러오지 않는다. 기존 데이터·서비스 코드를 다시 연결할 때도 과거 전체 화면을 가져오지 않고, [UI 구조](../../docs/UI_STRUCTURE.md)에 따라 새 화면을 먼저 만든다.
