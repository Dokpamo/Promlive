# 구조와 데이터 보존

갱신: 2026-10-04. 현재 화면 구조는 [UI 경계](UI_RESET.md), 작업별 위치는 [기능 지도](FEATURE_MAP.md)를 따른다. 이전 채팅 전용 진입점과 구형 화면·시트는 현재 제품 경로가 아니다.

## 현재 실행 경로

```text
App → src/ui/App
  ├─ SettingsServicesProvider → app/settingsServices → runtime·설정 서비스
  ├─ 모바일 Shell / DesktopShell → ScreenController
  │                            → workspace/commands (공통 데이터 명령)
  └─ WorkspaceMemory → ports/workspace → SQLite / IndexedDB 어댑터
                    → Collection / Room (제한된 화면 조회 범위)
```

`ScreenController`는 독립 인터페이스다. 특정 클래스의 `Pick`이나 전체 Workspace 구현을 화면에 노출하지 않는다. 모바일의 스와이프·겹친 화면과 PC의 목록/상세 열은 각 Shell이 소유한다. 검색·카드 생성·수정·완료 명령, 저장 오류 안내는 공유한다.

`app/settingsServices.ts`는 실제 서비스 조립과 기본 인스턴스 로딩을 담당한다. React Provider는 준비된 서비스를 화면에 공급한다. `GeneralPreferences`는 변경된 키만 쓰고 여러 키는 가능한 저장소에서 한 트랜잭션으로 저장한다. 실패한 값은 남겨 두어 재시도하며, 이전 저장 완료가 새 편집을 지우지 않는다.

## 데이터와 저장 경계

- 현재 카드·로컬 채팅 모델: `features/workspace/model.ts`. 목록용 축약·인덱스: `features/workspace/indexing.ts`.
- 현재 저장 계약: `ports/workspace.ts`. 구현: `adapters/sqlite/SqliteWorkspace.ts`, `adapters/indexeddb/IndexedWorkspace.ts`. 생성은 `app/createWorkspace.*`가 선택한다.
- 스냅샷 이관 계약: `ports/screenStorage.ts`, 구현: `adapters/screen`. 유효성 검사 함수는 호출자가 전달하므로 어댑터가 UI 모델을 import하지 않는다. 화면 경로와 스크롤 복원 데이터는 UI가 검증한다.
- `ports/storage.ts`에는 SQL 계약만 둔다. `adapters/sqlite/SerialDatabase.ts`가 호출과 트랜잭션을 직렬화한다. 커밋 뒤 영속화 실패 시 후속 접근을 중단하는 기존 규칙을 보존한다.
- 네이티브 iOS·Android·macOS는 op-sqlite, Windows는 `PromliveSqlite`를 사용한다. 현재 웹 화면은 IndexedDB의 행 단위 저장소를 사용한다. 기존 AI·설정 서비스의 웹 DB는 sql.js와 IndexedDB다.
- 기존 엔진 DB 버전 5, 현재 workspace 버전 2, 카드/SDK 형식, DB 파일명·키·앱 ID·이관 마커를 바꾸지 않았다. 이관과 원본 백업 보존, 기대 revision에 의한 충돌 검사는 유지한다.

현재 `WorkspaceMemory.sendChat`은 사용자 메시지를 로컬 저장한다. 기존 `CreationService`의 생성·컨텍스트·취소 경로와 모델이 다르므로 이번 구조 정리에서 두 저장소를 합치지 않았다. 장기 기억 설계도 이 작업의 범위가 아니다.

## 화면 수명과 스크롤

`WorkspaceMemory`는 작은 화면 캐시를 먼저 표시하고 저장소의 최신 행으로 보완한다. `Collection`은 메타데이터 페이지, `Room`은 메시지 본문 범위를 소유한다. 기본 목록 24개, 메시지 페이지 최대 16개/16,000자, 보관 64,000자와 개수 상한을 함께 사용한다. 한 메시지가 예산보다 길어도 잘라 저장하거나 영구적으로 숨기지 않는다. 플랫폼별 값과 한계는 [측정 보고서](performance/variable-message-matrix.md)에 있다.

`ChatRoom`은 화면·입력·메뉴를 조립한다. `chat/useMessageViewport`가 이전/다음 페이지 조회·보이는 메시지 기준점·위치 복원을, `chat/MessageList`가 플랫폼별 렌더러를, `chat/MessageBubble`이 말풍선을 맡는다. iOS는 제한된 본문 범위를 실제 ScrollView 자식으로 유지하여 UIKit의 기준점을 보존한다. Android는 네이티브 기준점, PC는 수동 보정과 macOS의 오래된 스크롤 이벤트 차단을 유지한다. 입력바·키보드·전송 애니메이션은 기존 전용 제어기를 사용한다.

## 보존한 기존 서비스

구형 React 화면을 제거해도 `app/workspace.ts`, `CardEditor`, `ConversationList`, `ChatSession`, `MessageHistory`, `Notifications`, Authoring·Creator·Summary 엔진은 유지한다. 현재 일부는 직접 연결되지 않았지만 이후 기능 연결에 필요한 검증된 로직이다. 서비스의 데이터 무결성 테스트도 유지한다.

`ChatSession`은 방별 초안 수정 버전과 접수·생성·취소 상태를 소유한다. `sessionStore`는 메시지 삽입·전송 ID·초안 수락을 한 트랜잭션으로 처리한다. 같은 ID/내용의 재접수는 기존 메시지를 반환하고, 늦은 초안 저장이 이미 전송한 내용을 복구하지 못하게 한다. `CardEditor`는 저장 도중의 편집과 복구 버퍼를 보존하고 이전 편집 세션의 완료가 현재 카드를 바꾸지 못하게 한다.

## 생성과 채팅

`GenerationCoordinator`가 작성·조사·채팅·Creator 요청을 공통 처리합니다. 동시 2개, 기본 120초, 응답 30,000자, 출처 30개를 제한합니다. 자동 재시도는 없고 요청 ID를 재사용하지 않습니다. 채팅 전송 ID는 DB에서 멱등 처리하고 서로 다른 내용으로 재사용하면 거부합니다.

제공자의 명시적 `done` 이벤트만 정상 완료로 간주합니다. EOF·오류·취소는 부분 결과와 해당 상태를 남깁니다. 종료된 작업은 AbortSignal을 통해 연결을 정리하며, 앱 재시작 시 미완료 작업을 중단 상태로 전환합니다.

`CreationService`는 UI 수명과 독립적입니다. 중간 응답은 최대 약 20회/초로 화면에 게시하고 약 700ms마다 저장합니다. 종료 상태는 즉시 저장합니다. 저장 실패를 완료로 표시하지 않습니다. AI 초안은 생성 시작 시점의 카드 수정 번호를 보유합니다.

기존 엔진의 `MessageHistory`는 40개 단위 조회를 지원합니다. 현재 UI의 `WorkspaceRoom`은 별도 저장 경로에서 메시지 수·문자 수 예산을 함께 적용합니다. AI 컨텍스트는 기존 엔진에서 최근 최대 200개를 조회해 문자 수 예산으로 자릅니다. 이 제한은 화면에 보관하는 메시지 범위와 독립적이며, 오래된 기록은 DB에 남습니다.

작성 중 메시지는 생성이 수락되어 DB에 기록된 뒤 비워집니다. 응답을 기다리며 작성한 다음 메시지는 기존 요청이 끝나도 지우지 않습니다.

제공자가 연결되지 않으면 같은 접수 계약으로 사용자 문장만 로컬 저장합니다. 이때도 전송 ID와 초안 버전 보장을 유지하며, 응답 행이나 네트워크 요청은 만들지 않습니다.

## 제공자와 인증

앱의 `SelectedProvider`는 설정에 저장한 xAI API 연결과 대화 모델을 `GrokProvider`에 연결합니다. 모델과 키는 요청 시작 시 캡처하고 주소는 호스트의 공식 xAI 주소로 고정합니다. 키 저장을 기다린 뒤 저장된 값과 일치하는지 확인하므로 저장 실패 시 예전 키로 요청하지 않습니다. 제공자의 오류 본문은 인증·한도·모델 오류 분류에만 쓰고, 화면과 로그에는 로컬 안내문만 노출합니다. 다른 제공자의 실제 생성 어댑터, OAuth 로그인·갱신, 검색 도구, 모델별 세부 API 매개변수 연결은 후속 범위입니다. 설정 UI에 나타난다는 것만으로 해당 생성 기능이 구현되었다는 뜻은 아닙니다.

`AiSettingsPreferences`는 비밀값을 제외한 설정과 `CredentialStore`의 API 키를 합쳐 설정 화면에 제공합니다. 키는 프로바이더·연결 방식별로 분리하고, 입력·수정·삭제를 순서대로 저장하며 다음 실행에 복원합니다. 일반 설정 DB·모델 캐시·코드 카드에는 키를 전달하지 않습니다. 네이티브는 OS 인증 저장소, 웹은 별도 IndexedDB의 AES-GCM 암호문과 추출 불가능한 로컬 CryptoKey를 사용합니다. 웹 저장소는 같은 출처에서 실행되는 앱 코드가 접근할 수 있으며 OS 키체인과 동일한 보호를 제공하지 않습니다. 참고한 [xAI 추론 API 문서](https://docs.x.ai/developers/rest-api-reference/inference)는 API 키 기반 Bearer 인증을 설명하며 사용자 OAuth 지원 여부를 대신 입증하지 않습니다.

## 첫 개인 확장

`SummaryExtensions`는 대화 요약 한 종류만 실행합니다. AI에는 `summaryProgram`의 작은 JSON 계약과 이전 확장 문서만 보내고 앱 소스·대화·키를 보내지 않습니다. 읽기 → 생성 → 자체 저장의 세 단계만 허용하며 임의 JavaScript, 네트워크 주소, DB 질의, 메시지 수정은 표현할 수 없습니다. 기존 `CreatorHost`와 생성 제한을 재사용합니다. 범용 SDK·렌더러·레이아웃 교체 지점은 아직 공개하지 않습니다.

새 버전은 불변 문서로 저장하며 초안/활성 포인터를 분리합니다. 권한을 확인하고 적용한 확장만 실행할 수 있습니다. 기존 요약 전용 화면은 정리했으며, 새 채팅 화면의 요약 버튼 연결은 별도 기능 작업입니다. 실행 범위는 클릭한 대화 ID에 고정하고, 비활성화·복원 시 실행 권한을 회수하고 진행 중 호출을 취소합니다. 실행 리비전을 결과 저장 트랜잭션에서도 확인하므로 늦은 결과를 저장하지 않습니다. 새 초안을 만드는 것만으로 기존 활성 실행의 권한을 회수하지는 않습니다.

요약 결과는 방별 별도 테이블에 저장합니다. 코드 복원은 이미 저장한 요약을 삭제하지 않으며, 대화를 삭제하면 해당 방 요약만 함께 지웁니다. 자세한 제한과 흐름은 [요약 확장](SUMMARY_EXTENSION.md)에 있습니다.

## 플랫폼과 빌드

Metro는 플랫폼별로 React Native 구현체를 선택합니다. Vite 미리보기는 React Native Web과 웹 저장 어댑터를 사용합니다. iOS는 [Apple의 Scene 수명 주기 지침](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)에 따라 SceneDelegate에서 화면을 시작합니다.

이 구조가 네 플랫폼에서 동일하게 검증된 것은 아닙니다. 정확한 확인 범위는 `VERIFICATION.md`에 기록합니다.
