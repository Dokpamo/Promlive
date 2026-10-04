# 작업별 기능 지도

갱신: 2026-10-04. 현재 UI는 `src/ui`이며, 구형 화면은 제거했다. 현재 화면과 보존한 엔진의 책임을 구분한다.

| 작업 | 진입점·상태 | 검증 |
|---|---|---|
| 모바일 탭·스와이프 | `ui/App`, `TabPages`, `ScreenLayer`, `swipeNavigation` | `ui-shell`, `ui-swipe-*`, `ui-tab-*` |
| PC 아이콘 레일·오른쪽 페이지 | `ui/desktop/DesktopShell`, `DesktopPages`, `DesktopSettingsNavigator` | `ui-desktop` |
| 공통 데이터 명령·오류 | `ui/workspace/commands`, `StorageIssueBanner`, `ScreenController` | 현재 모바일·PC 통합 테스트 |
| 서재·생성·채팅 목록 | `ui/workspace/Collection`, `hooks`, `features/workspace/indexing` | `workspace-storage`, `workspace-ui`, `list-scroll-restoration` |
| 본문 제한·캐시·초안 | `ui/workspace/WorkspaceMemory`, `Room`, `tuning*` | `workspace-memory`, `workspace-regressions` |
| 채팅 표시·기준점·이전 기록 | `ui/ChatRoom`, `chat/MessageList`, `chat/useMessageViewport`, `ScrollEventEpoch` | `workspace-ui`, `scroll-event-epoch`, 성능 러너 |
| 입력바·키보드·전송 동작 | `ui/chat-input`, `useMessageSendMotion`, `useChatChrome` | `ui-chat-input`, `ui-message-send`, Android 키보드 단위 테스트 |
| 카드 편집·공개 상태 | `ui/CardEditor`, `cardWorkspace`, `features/workspace/model` | `ui-card-editor`, `ui-card-workspace` |
| 설정 조립·일반 설정 저장 | `app/settingsServices`, `features/settings/generalPreferences`, `ui/settings/SettingsServices` | `general-preferences`, `runtime-settings-integration` |
| AI 연결·모델 선택·목록 변경 | `ui/settings/AiSettings`, `AnimatedModelRows`, `features/settings` | `ui-settings`, `ai-*`, `provider-catalog` |
| 사용자·페르소나·사진 | `ui/settings/PeopleSettings`, `ProfilePhotoEditor`, `features/profile`, `features/personas` | `ui-settings`, `ui-profile-photo-editor`, `user-profile`, `personas`, `photo-crop` |
| 테마·규격·SVG·호버 | `ui/Theme`, `tokens`, `icons`, `desktop/DesktopFeedback` | 현재 화면·탭 테스트 |
| SQLite·IndexedDB 저장 | `ports/workspace`, `adapters/sqlite/SqliteWorkspace`, `adapters/indexeddb/IndexedWorkspace` | `workspace-storage`, `storage` |
| 구형 스냅샷 이관·복구 | `ports/screenStorage`, `adapters/screen`, `ui/screenState` | `screen-storage-*`, `ui-screen-memory`, `workspace-memory` |
| 플랫폼 의존성 경계 | `app/createWorkspace.*`, `metro.config`, `tests/source-graph` | `ui-boundary` (다섯 플랫폼), 네이티브 빌드 |
| 기존 AI 채팅·편집 엔진 | `features/chat/ChatSession`, `service`, `generation`, `features/cards/CardEditor` | `chat-session`, `generation`, `feature-owners`, `card-management` |
| 기존 Authoring·Creator·요약 엔진 | `features/authoring`, `creator-sdk`, `extensions/SummaryExtensions` | `authoring`, `creator`, `summary-extensions` |
| 기존 폴더·대화 관리 | `features/library/FolderLibrary`, `features/chat/ConversationList`, `app/workspace` | `library-folders`, `conversation-management`, `workspace` |

위 테스트 이름은 `tests/` 안의 파일 접두사다. 기존 엔진을 새 화면에 연결하는 일은 구조 정리와 별도 작업이다. 새 채팅의 현재 로컬 저장 경로를 기존 생성 서비스와 동일한 것으로 취급하지 않는다.

이전 렌더러·전용 제스처·시안의 삭제 근거와 검증 범위는 [정리 기록](UI_MAINTENANCE.md)에 있다. 이전 구현은 `cd2ff04`와 그 앞의 Git 이력에서 확인할 수 있다.
