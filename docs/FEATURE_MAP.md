# 작업별 기능 지도

전체 파일 목록 대신 해당 행의 진입점·계약·테스트부터 읽습니다. 관련된 규칙이 바뀔 때만 다음 경계로 이동합니다.

| 작업 | 먼저 읽을 파일 | 상태의 주인 / 검증 |
|---|---|---|
| 초안·전송·중단 | [ChatSession](../src/features/chat/ChatSession.ts), [저장 계약](../src/features/chat/sessionStore.ts) | 대화별 세션. [세션 회귀 검사](../tests/chat-session.test.ts), [방 이동·화면 검사](../tests/chat-screen.test.tsx) |
| 메시지 표시·이전 기록 | [ChatScreen](../src/features/chat/ChatScreen.tsx), [MessageHistory](../src/features/chat/messageHistory.ts) | 화면 조회 범위. [페이지 검사](../tests/message-history.test.ts) |
| 입력창 크기·키보드·제스처 | [ChatComposer](../src/features/chat/ChatComposer.tsx), [composerGeometry](../src/features/chat/composerGeometry.ts) | 표시만 담당, 전송 정책은 세션. [편집기 유지 검사](../tests/composer-motion.test.tsx) |
| 개인 요약 플러그인 | [작은 프로그램 계약](../src/extensions/summaryProgram.ts), [실행·버전 수명](../src/extensions/SummaryExtensions.ts) | 앱 소스를 바꾸지 않는 독립 문서. [권한·복원·실행 검사](../tests/summary-extensions.test.ts) |
| 카드 편집·저장·초안 적용 | [CardEditor](../src/features/cards/CardEditor.ts), [카드 저장 계약](../src/features/cards/store.ts), [editorState](../src/features/cards/editorState.ts) | 편집 세션·복구 버퍼·AI 편집 폼. [소유자 검사](../tests/feature-owners.test.ts), [편집 UI 검사](../tests/card-editor-ui.test.tsx), [편집 경합 검사](../tests/workspace-regressions.test.ts) |
| 채팅내역·고정·이름 변경·삭제 | [ConversationList](../src/features/chat/ConversationList.ts), [대화 저장 계약](../src/features/chat/store.ts), [CardConversationPanel](../src/features/chat/CardConversationPanel.tsx) | 조회 세대·선택 ID·삭제 후 선택. [대화 관리 검사](../tests/conversation-management.test.ts), [선택 UI 검사](../tests/history-selection.test.tsx) |
| 이름 변경 입력 팝업 | [HistoryRenameSheet](../src/features/chat/HistoryRenameSheet.tsx), [SwipeBackModal](../src/layout/SwipeBackModal.tsx) | 팝업은 편집 중인 이름만 소유하며 확인 시 `ConversationList.rename` 호출. [취소·저장·실패·닫기 검사](../tests/history-rename.test.tsx) |
| 안내·오류·자동 닫기 | [Notifications](../src/app/Notifications.ts), [NotificationToast](../src/app/NotificationToast.tsx) | 알림 ID로 오래된 타이머를 무효화. [소유자 검사](../tests/feature-owners.test.ts) |
| 화면 이동·기능 연결 | [Workspace](../src/app/workspace.ts), [WorkspaceChat](../src/app/WorkspaceChat.tsx) | 화면 이동 순서, 카드 목록, 기능 연결만 담당. 늦은 요청이 새 선택을 덮지 않는 [회귀 검사](../tests/workspace-regressions.test.ts) |
| 행·버튼 눌림과 공통 치수 | [RowPressable](../src/layout/RowPressable.tsx), [PressSurface](../src/layout/PressSurface.tsx), [panelGeometry](../src/layout/panelGeometry.ts), [metrics](../src/layout/metrics.ts) | 설정·카드 목록·채팅내역이 같은 눌림·곡률·비율을 사용 |
| 팝업·뒤로가기·드래그 인계 | [SwipeBackModal](../src/layout/SwipeBackModal.tsx), [sheetMotion](../src/layout/sheetMotion.ts), [panelAnimation](../src/layout/panelAnimation.ts) | 공통 방향 판정·저항·스프링. [제스처 경합 검사](../tests/gesture-interruption.test.tsx), [방향 검사](../tests/sheet-motion.test.ts) |
| AI 연결·스트리밍 | [SelectedProvider](../src/adapters/ai/selectedProvider.ts), [GenerationCoordinator](../src/features/chat/generation.ts) | 호스트만 인증·주소 보유. [전송 검사](../tests/transport.test.ts), [생성 수명 검사](../tests/generation.test.ts) |

초안 버그를 고칠 때는 `ChatSession`과 `sessionStore` 및 관련 테스트가 우선입니다. 메시지 삽입·수락의 원자성을 바꾸는 경우에만 [SQLite 구현](../src/adapters/sqlite/chatSessionStore.ts)을 추가로 읽습니다. UI 수명이나 전체 `Workspace`를 초안의 기준으로 삼지 않습니다.

앱 안 AI에 제공하는 내용은 `summaryContract`와 현재 확장 문서, 사용자 요청뿐입니다. 기능을 만들기 위해 프로젝트 경로나 전체 SDK를 보내지 않습니다. 실제로 읽는 파일·문자 수가 줄어드는지는 대표 수정 작업으로 측정하며 절감 비율을 미리 보장하지 않습니다.

## 저장 경계를 고칠 때

`StoryRepository`는 앱 조립과 SQLite 구현에서만 사용하는 합성 계약입니다. 기능 코드는 카드 편집에는 `CardEditorStore`, 대화 관리에는 `ConversationStore`의 필요한 메서드, 메시지 조회에는 `MessageReader`, 생성에는 `CreationStore`, 설정에는 `SettingsStore`를 받습니다. 요약 확장은 메시지 읽기와 자신의 저장소만 받습니다. 조회 화면의 타입에는 메시지 삭제나 설정 쓰기 메서드를 함께 노출하지 않습니다. 이 내부 타입 경계 자체가 런타임 보안 격리를 제공하는 것은 아닙니다.

카드 편집 화면은 `CardEditor`, 채팅내역 화면은 `ConversationList`, 안내 화면은 `Notifications`를 직접 구독합니다. 한 곳의 편집/알림 변경을 모든 화면에 전달하는 `Workspace.emit()`에 의존하지 않습니다. 공통 눌림·제스처 수치를 바꿀 때는 `layout`의 한 구현을 고치며 설정 또는 채팅 구현을 따로 복제하지 않습니다. 각 기능만의 목록 구성과 스크롤 정책은 해당 기능 안에 남깁니다.
