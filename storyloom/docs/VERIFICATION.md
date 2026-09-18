# 검증 기록

검증일: 2026-09-18. 실제 AI 호출·OAuth 인증 없이 수행했습니다. 기존 작업이나 메모리를 테스트 데이터로 사용하지 않았습니다.

## 자동 검사

`npm run verify` 성공: TypeScript 검사, Vitest **30개**, Vite 배포 빌드.

| 파일 | 개수 | 확인하는 위험 |
|---|---:|---|
| storage.test.ts | 11 | SQLite 재열기, 마이그레이션·롤백, SQL 바인딩, 수정 충돌, 초안·편집 버퍼, 재시작 복구 |
| generation.test.ts | 11 | 응답 순서, 정상 완료, 부분 응답, 취소, 시간 초과, 중복 호출, 저장 실패, 조사 출처, 컨텍스트·페이지 분리 |
| creator.test.ts | 4 | SDK 형식, 실행별 권한, 요청량, ID 재사용, 실행 종료 후 권한 회수 |
| transport.test.ts | 3 | SSE 분할·CRLF, Grok 스트림 형식·완료·인증 참조, 비정상 종료 |
| workspace.test.ts | 1 | 저장 중 추가 편집 보존, 연속 저장 클릭 중복 억제, 재열기 후 저장 |

저장 테스트는 메모리 객체 대체물이 아닌 Node의 실제 SQLite를 사용합니다. 네이티브 드라이버 전체 동작을 이 테스트로 대신 검증한 것은 아닙니다. AI 테스트는 `tests/helpers.ts`의 fixture와 테스트 전송을 사용하며 앱에는 포함하지 않습니다.

## 플랫폼별 확인

| 대상 | 빌드 | 실행 및 데이터 | 아직 확인하지 않은 부분 |
|---|---|---|---|
| 웹 | Vite production 성공 | 카드·한글 세계관 저장 후 새로고침, 390px 전환 중 AI 요청 입력 보존, 코드 이벤트·무한 루프 중단, 대화 입력의 화면 이동·새로고침 후 보존 | 대량 카드·장시간 스트림, 다른 브라우저 전수 검사 |
| macOS | Release 성공 | 네이티브 서재·편집, 카드 복제·한글 이름 변경·저장·프로세스 종료 후 유지 | 네이티브 코드 실행 경계, 대화 성능, 접근성 전수 검사 |
| iOS | Release Simulator 성공 | iPhone 18 Pro / iOS 27에서 서재·카드 생성·편집 화면 탐색, 생성 카드의 프로세스 재시작 후 유지. UIScene 시작 오류 수정 | 실기기 서명·설치, 텍스트 입력 검증 및 키보드·회전·글꼴 확대 전수 검사, 네이티브 코드 경계 |
| Android | `assembleRelease` 성공 | Pixel 9 API 36의 읽기 전용 에뮬레이터 세션에서 APK 설치·실행, 카드 생성·이름 입력·저장·강제 종료 후 재실행 시 유지 확인 | 실제 기기·OEM별 검증, 네이티브 코드 경계 |
| Windows | Windows 플랫폼 Metro JS 번들 생성 성공 | C++ 호스트와 SQLite 모듈 작성 | Windows 네이티브 컴파일·자동 링크·실행·DB·WebView 모두 미검증 |

iOS·macOS 빌드에서는 RN/Hermes의 전역 변수 선언 및 빌드 스크립트 경고가 발생하지만 컴파일은 성공했습니다. 웹은 번들 약 531kB에 대한 Vite 크기 경고가 있습니다. 이 경고를 오류 없이 통과했다는 사실이 성능 목표를 달성했다는 뜻은 아닙니다.

화면 증거: [iOS 서재](screenshots/ios-library.jpg), [Android 재시작 후 저장 카드](screenshots/android-saved.png). Android 상태 표시줄의 밝은 배경·흰 아이콘 문제를 발견하여 어두운 아이콘으로 수정하고 다시 빌드·설치했습니다. iOS 텍스트 입력 도구는 한글 입력을 지원하지 않았고 영문 입력도 UI 변경을 확실히 입증하지 못해 입력 성공으로 기록하지 않았습니다.

## 로컬 빌드 산출물

- macOS: `build/macos/Build/Products/Release/storyloom.app`
- iOS 시뮬레이터: `build/ios/Build/Products/Release-iphonesimulator/Storyloom.app`
- Android: `android/app/build/outputs/apk/release/app-release.apk`
- Windows JS: `build/windows/index.windows.bundle`
- 웹: `dist/`

Android 패키지는 테스트용 debug 키로 서명되어 있습니다. Apple 앱은 로컬 unsigned/simulator 결과입니다. 스토어 배포·공증은 수행하지 않았습니다. `build/`, `dist/`, `Pods/`, 설치 패키지는 소스 관리에서 제외합니다.

## 다음 연결 단계에서 검증할 사항

1. Grok OAuth의 실제 지원 경로·범위·갱신 방식 확정과 OS 보안 저장소 연결. 현재 OAuth 구현은 없습니다.
2. 실제 AI 스트리밍·취소·시간 초과·네트워크 끊김·비용/모델 입력 한도를 네 플랫폼에서 검사.
3. 실제 검색 제공자와 출처 계약 연결. 현재 검색 결과를 만들어서 표시하지 않습니다.
4. Windows 환경에서 네이티브 빌드·실행 및 SQLite 저장·재시작을 확인한 뒤 버전 조합 확정.
5. 네이티브 WebView의 Worker·CSP·탐색·파일 접근 제한과 과도한 메모리 사용 대응 검증.
6. 큰 글꼴, 스크린 리더, 키보드 포커스·선택·복사, 가상 키보드, 회전·창 크기 변경을 플랫폼별 검증.
7. 긴 실제 대화의 Release 성능·메모리 측정. 현재 자동 테스트는 140개 메시지의 페이지·컨텍스트 무결성을 확인하며 성능 측정값은 없습니다.

이 항목들이 남아 있으므로 기획서 전체의 배포 완료를 주장하지 않습니다.
