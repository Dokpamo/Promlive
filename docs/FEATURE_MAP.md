# 작업별 기능 지도

전체 파일 목록 대신 해당 행의 진입점·계약·테스트부터 읽습니다. 관련된 규칙이 바뀔 때만 다음 경계로 이동합니다.

| 작업 | 먼저 읽을 파일 | 상태의 주인 / 검증 |
|---|---|---|
| 초안·전송·중단 | [ChatSession](../src/features/chat/ChatSession.ts), [저장 계약](../src/features/chat/sessionStore.ts) | 대화별 세션. [세션 회귀 검사](../tests/chat-session.test.ts), [방 이동·화면 검사](../tests/chat-screen.test.tsx) |
| 메시지 표시·이전 기록 | [ChatScreen](../src/features/chat/ChatScreen.tsx), [MessageHistory](../src/features/chat/messageHistory.ts) | 화면 조회 범위. [페이지 검사](../tests/message-history.test.ts) |
| 입력창 크기·키보드·제스처 | [ChatComposer](../src/features/chat/ChatComposer.tsx), [composerGeometry](../src/features/chat/composerGeometry.ts) | 표시만 담당, 전송 정책은 세션. [편집기 유지 검사](../tests/composer-motion.test.tsx) |
| 개인 요약 플러그인 | [작은 프로그램 계약](../src/extensions/summaryProgram.ts), [실행·버전 수명](../src/extensions/SummaryExtensions.ts) | 앱 소스를 바꾸지 않는 독립 문서. [권한·복원·실행 검사](../tests/summary-extensions.test.ts) |
| 카드 편집·대화 목록 | [Workspace](../src/app/workspace.ts), [editorState](../src/app/editorState.ts) | 카드 편집 버퍼, 대화 선택. [편집 경합 검사](../tests/workspace-regressions.test.ts), [대화 관리 검사](../tests/conversation-management.test.ts) |
| AI 연결·스트리밍 | [SelectedProvider](../src/adapters/ai/selectedProvider.ts), [GenerationCoordinator](../src/features/chat/generation.ts) | 호스트만 인증·주소 보유. [전송 검사](../tests/transport.test.ts), [생성 수명 검사](../tests/generation.test.ts) |

초안 버그를 고칠 때는 `ChatSession`과 `sessionStore` 및 관련 테스트가 우선입니다. 메시지 삽입·수락의 원자성을 바꾸는 경우에만 [SQLite 구현](../src/adapters/sqlite/chatSessionStore.ts)을 추가로 읽습니다. UI 수명이나 전체 `Workspace`를 초안의 기준으로 삼지 않습니다.

앱 안 AI에 제공하는 내용은 `summaryContract`와 현재 확장 문서, 사용자 요청뿐입니다. 기능을 만들기 위해 프로젝트 경로나 전체 SDK를 보내지 않습니다. 실제로 읽는 파일·문자 수가 줄어드는지는 대표 수정 작업으로 측정하며 절감 비율을 미리 보장하지 않습니다.
