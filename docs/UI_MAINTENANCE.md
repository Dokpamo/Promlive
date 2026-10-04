# UI·저장 구조 정리 기록

2026-10-04. 정리 전 기준: `cd2ff041`. 사용자와 합의한 순서대로 경계·검증 보강, 설정 저장 및 계약 분리, 구형 UI 제거, 공통 데이터 명령 추출, 채팅·저장 책임 분리를 진행했다.

## 1. 삭제 근거와 범위

`tests/source-graph.ts`로 `index.js`와 `web/main.tsx`부터 Android·iOS·macOS·Windows·웹의 참조를 각각 추적했다. 네이티브는 설치된 Metro resolver와 프로젝트 설정, 웹은 Vite의 확장자 우선순위를 사용한다. 정적 import/export, 타입 참조, 문자열 dynamic import와 require를 포함한다. 대소문자도 정확히 확인한다. 변수로 조합한 import는 조용히 무시하지 않고 실패시킨다.

제품 그래프와 테스트 참조를 구분한 뒤 다음을 제거했다.

| 대상 | 수량 | 근거 |
|---|---:|---|
| 구형 화면·렌더링 부품 | 106개 `.tsx` | 다섯 제품 진입점에서 도달하지 않음 |
| 구형 UI 전용 헬퍼·디자인·레이아웃 | 35개 `.ts` | 위 화면과 그 전용 테스트만 소비 |
| 구형 렌더러·시트·제스처 전용 테스트 | 32개 파일 | 제거한 구현의 동작을 검사하던 테스트 |
| 구형 모델 목록 시안 | 3개 파일 | `web/previews/model-arrival.*`; 제거한 구형 시트만 사용 |

삭제된 소스는 합계 141개다. 저장 어댑터·포트의 경로 이동은 이 삭제 수에 포함하지 않는다. 파일별 목록과 원문은 이 변경의 Git diff 및 정리 전 커밋에서 복원할 수 있다. 외부 패키지 내부와 네이티브 등록을 이 그래프만으로 증명하지 않으므로 실제 번들과 빌드도 확인했다. 패키지 의존성과 네이티브 브리지는 이번에 제거하지 않았다.

기존 `runtime`, `workspace`, `CardEditor`, `ConversationList`, `ChatSession`, `MessageHistory`, Authoring·Creator·Summary 엔진과 그 데이터 테스트를 보존했다. 현재 화면에 연결되지 않은 엔진은 [기능 지도](FEATURE_MAP.md)에 별도로 표시했다. 구형 UI 테스트를 없앤 것이 새 UI의 모든 기능 연결이 끝났다는 뜻은 아니다.

## 2. 설정 저장과 화면 계약

- `features/settings/generalPreferences.ts`: 같은 값은 무시하고 변경된 키만 저장한다. 여러 키는 `Repository.setSettings()`의 한 트랜잭션으로 쓴다. 일반 설정 하나 변경 시 기존 세 번 쓰기가 한 번 쓰기로 줄어든다.
- 저장 실패, 재시도, 저장 중 추가 편집, 초기 읽기 중 편집을 검사했다. 초기 읽기가 실패해도 사용자가 입력한 값과 아직 읽지 못한 다른 설정을 분리하여 보존한다.
- `app/settingsServices.ts`: 기존 런타임과 설정 서비스 조립을 소유한다. React Context 파일에는 화면 공급만 남겼다.
- `ui/ScreenController.ts`: 구체 클래스에서 `Pick`한 타입을 독립 인터페이스로 바꿨다. 목록·채팅 접근도 `CollectionView`·`RoomView` 계약만 노출한다.
- 기존 `ScreenMemory`는 호환 구현 및 테스트 주입용으로 남겨 뒀다. 제품 기본 경로는 `WorkspaceMemory`이며 기존 스냅샷 검증·이관은 계속 사용한다.

런타임의 기능별 지연 초기화는 이번에 바꾸지 않았다. 실제 AI 설정 인스턴스 공유와 미완료 작업 복구 순서를 유지했다. 화면과 서비스 조립을 분리한 것만으로 시작 시간이 개선됐다고 주장하지 않는다.

## 3. 같은 데이터 동작만 공유

모바일과 PC Shell의 검색 상태 변경, 카드 생성·수정·갤러리·완료 명령은 `ui/workspace/commands.ts`에서 공유한다. 화면을 쌓거나 오른쪽 열을 여는 정책은 각 Shell에 남겨 뒀다.

`StorageIssueBanner`에서 손상·미지원 버전·충돌·읽기·쓰기 실패를 함께 표현한다. PC도 모바일과 같은 정확한 오류 안내와 재시도 경로를 사용한다. 팔레트 역할, SVG·크기, 헤더·설정 프레임, 탐색·키보드 애니메이션은 새로 통합하지 않았다.

## 4. 저장과 채팅 경계

| 책임 | 현재 위치 |
|---|---|
| 카드·메시지 데이터 타입, 목록 축약·인덱스 | `features/workspace/model.ts`, `indexing.ts` |
| 저장 계약 | `ports/workspace.ts`, `ports/screenStorage.ts`, `ports/storage.ts` |
| SQL·IndexedDB·구형 스냅샷 저장 구현 | `adapters/sqlite`, `adapters/indexeddb`, `adapters/screen` |
| 플랫폼별 저장소 조립 | `app/createWorkspace.*` |
| 화면 선택·이동·스크롤 복원 | `ui/screenState`, `ui/workspace/WorkspaceMemory` |
| 채팅 화면 조립 | `ui/ChatRoom.tsx` |
| 메시지 렌더링·말풍선 | `ui/chat/MessageList.tsx`, `MessageBubble.tsx` |
| 보이는 메시지 기준점·이전/다음 조회 | `ui/chat/useMessageViewport.ts` |

저장소는 화면 경로·스크롤 값을 불투명 데이터로 보존하며 UI가 검증한다. 이관 후 검증에서 큰 메시지 본문 전체를 다시 직렬화하지 않는다. `SerialDatabase`의 실행 큐·트랜잭션·영속화 실패 처리도 구현 위치만 옮겼다.

iOS의 제한된 ScrollView와 Android 네이티브 기준점, PC 수동 위치 보정 및 macOS의 오래된 스크롤 이벤트 차단을 보존했다. 목록의 ref는 실제 제공하는 스크롤 메서드만 선언하여 전체 FlatList로 가장하던 캐스팅을 제거했다. 메시지 예산·보관 상한·prefetch 값과 가상 목록 패치는 바꾸지 않았다.

DB 스키마·버전·키·파일명·앱 ID, 메시지·카드 형식, 이관 마커, 원본 백업 및 revision 충돌 검사는 유지했다. AI 생성 연결과 장기 기억 설계는 별도 작업이다.

## 5. 검증

- TypeScript 통과, 전체 **64파일·540개 테스트 통과**. 구형 UI 테스트 감소와 새 검사 추가를 포함한 결과이며 정리 전 796개와 동일한 테스트 묶음은 아니다.
- 현재 모바일·PC UI를 실제 `WorkspaceMemory`와 IndexedDB에 연결한 통합 검사: 긴 카드 본문 검색·상세 읽기, 제한된 채팅 본문 유지, 추가 기록 조회 없이 초안 저장.
- 실제 SQLite를 사용한 런타임 초기화·설정 서비스 인스턴스 공유·일반 설정 저장 검사. 외부 AI 요청과 실제 인증 정보는 사용하지 않았다.
- 저장 계약·충돌·이관·복구·초안·스크롤·전송·키보드·설정 선택 등 남겨야 할 회귀 검사 통과. 다섯 플랫폼의 서비스·저장 참조에서 UI 구현으로 역참조하지 않는 것도 검사한다.
- 웹 Vite build, Windows·Android Release용 Metro JS 번들 통과.
- macOS Release 네이티브 빌드, iPhone 17 Pro / iOS 26.5 Simulator Release 빌드·설치·실행 통과. 실제 화면에서 채팅 목록·방·입력바를 확인했다.
- Android 네이티브 검증은 SDK가 있던 외장 볼륨이 연결되지 않아 완료하지 못했다. 남아 있던 emulator/netsimd 프로세스의 CPU 과점유로 UI 테스트 1개가 처음 시간 초과했으며, 해당 프로세스를 종료한 뒤 테스트 코드·시간 제한 변경 없이 통과했다.
- Windows 네이티브 실행은 이번에 하지 않았다. 플랫폼 참조 검사와 JS 번들 통과를 네이티브 실행 성공으로 간주하지 않는다.

이번 정리는 새 성능 튜닝 실험이 아니다. 이전 대량 더미 데이터 프레임 분석은 [성능 보고서](performance/variable-message-matrix.md)를 따른다. 삭제된 파일 대부분은 원래 제품 번들에서 제외되어 있었으므로 제거한 줄 수만큼 실행 속도나 메모리가 좋아졌다고 해석하지 않는다.
