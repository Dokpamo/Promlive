# 여백 · Storyloom

세계관과 등장인물을 만들고, 그 설정으로 대화를 이어가는 로컬 창작 앱입니다. 제공된 **「로컬 AI 채팅 앱 기획서」만 제품 기준으로 사용**하여 이 폴더에 새로 구현했습니다. 기존 작업 코드와 메모리는 사용하지 않았습니다.

현재 버전은 **직접 작성·저장·코드 실행을 사용할 수 있는 0.1.0**입니다. 사용자 요청에 따라 인증 연결을 보류했으며, 앱은 외부 AI에 요청하지 않습니다. Grok OAuth 로그인, 실제 생성·조사 검증은 후속 연결 단계에 남아 있습니다.

## 바로 실행

```sh
cd /Users/codexer/Promlive/storyloom
npm ci
npm run web
```

브라우저: <http://127.0.0.1:5178>. `npm run web`은 이 컴퓨터에서만 접근할 수 있는 미리보기를 엽니다. Node.js 22.13 이상을 권장합니다. 검증 환경은 Node.js 26.0.0입니다.

이미 빌드한 macOS 앱은 다음 명령으로 실행할 수 있습니다.

```sh
open build/macos/Build/Products/Release/storyloom.app
```

웹과 각 네이티브 앱의 데이터는 **각자의 저장소**에 보관됩니다. 웹은 SQLite 파일을 IndexedDB에 저장하며, 브라우저 저장소를 지우면 데이터가 사라집니다.

## 사용할 수 있는 기능

- 서재: 카드 검색, 템플릿·코드 필터, 즐겨찾기, 복제, 보관·복원.
- 템플릿 편집: 세계관, 장소, 규칙, 등장인물, 성격·말투, 관계, 시작 장면, 대화 지침.
- 카드 저장: SQLite, 편집 초안 자동 보관, 수정 번호, 변경 충돌 감지. 직접 편집과 AI 초안이 서로 덮어쓰지 않도록 처리합니다.
- AI 작업 UI와 처리 계층: 작성·조사 구분, 초안 검토·수정·적용, 출처 표시, 생성 상태·취소·부분 결과 저장·재시작 복구. 실제 제공자 연결 전에는 요청 버튼이 비활성화됩니다.
- 대화: 카드별 대화, 시작 장면, 작성 중 메시지 보관, 구간 조회와 가상 목록. 준비된 생성 계층은 렌더링 빈도와 저장 빈도를 분리합니다.
- 코드 카드: HTML·CSS·JavaScript 편집, 격리된 실행 화면, 제한된 `creator` SDK, 응답 없는 Worker 중단.
- 반응형 화면: 실제 창 너비와 글꼴 배율에 따른 서재·편집·AI 도우미 배치, 모바일 안전 영역과 키보드 대응.

처음 열면 오리지널 샘플 카드 3개가 생성됩니다. 샘플은 AI 응답이나 조사 자료로 표시하지 않습니다.

## 검증 상태

2026-09-18 기준. 상세 절차와 제한은 [검증 기록](docs/VERIFICATION.md)에 있습니다.

| 대상 | 확인한 결과 |
|---|---|
| 공통 코드 | strict TypeScript 통과, 자동 테스트 30개 통과 |
| 웹 | 배포 빌드, 저장·재열기, 화면 크기 변경, 코드 이벤트·무한 루프 중단 확인 |
| macOS | Release 빌드, 네이티브 실행, 한글 입력·저장·앱 재시작 후 복구 확인 |
| iOS | Release 시뮬레이터 빌드, iOS 27 실행, 생성한 카드의 프로세스 재시작 후 유지 확인 |
| Android | Release APK 빌드, API 36 에뮬레이터에서 생성·입력·저장·프로세스 재시작 후 유지 확인 |
| Windows | 실행 프로젝트·SQLite 모듈 작성, Windows용 JS 번들 생성 통과. **네이티브 빌드·실행 미검증** |

네 플랫폼 호환성을 모두 입증한 릴리스가 아닙니다. Windows 네이티브 검증, 플랫폼별 코드 실행 경계, 실제 AI 통신 및 접근성·성능 측정은 남아 있습니다. 스토어 서명·공증·업로드는 하지 않았습니다.

## 네이티브 개발

고정 버전: React 19.1.4 / RN 0.81.6 / RN macOS 0.81.9 / RN Windows 0.81.35. 다른 버전으로 임의 치환하지 않고 lockfile을 사용합니다.

### iOS

macOS, Xcode, CocoaPods가 필요합니다. 프로젝트의 최소 iOS 버전은 RN이 정한 15.1입니다.

```sh
RCT_USE_RN_DEP=1 RCT_USE_PREBUILT_RNCORE=1 pod install --project-directory=ios
npm run ios
```

Release 시뮬레이터 빌드 예시:

```sh
xcodebuild -workspace ios/Storyloom.xcworkspace -scheme Storyloom \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO
```

최신 iOS 실행 환경을 위해 `UIScene` 수명 주기를 적용했습니다. 실기기 설치에는 개발자 서명이 필요합니다.

### Android

JDK 17, Android SDK 36, SDK 도구가 필요합니다. 최소 SDK는 24입니다.

```sh
npm run android
./android/gradlew -p android assembleRelease
```

이 컴퓨터의 검증 명령:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/codexer/Library/Android/sdk \
./android/gradlew -p android assembleRelease --console=plain
```

결과: `android/app/build/outputs/apk/release/app-release.apk`. 현재 Release는 **로컬 검증용 debug 서명**을 사용합니다. 배포 전 서명을 별도로 구성해야 합니다.

### macOS

최소 macOS 14.0. Xcode와 CocoaPods가 필요합니다.

```sh
pod install --project-directory=macos
npm run macos
xcodebuild -workspace macos/storyloom.xcworkspace -scheme storyloom-macOS \
  -configuration Release -derivedDataPath build/macos CODE_SIGNING_ALLOWED=NO
```

### Windows

Windows의 Visual Studio C++/Windows SDK 환경에서 실행합니다. 이 Mac에서는 C++ 프로젝트를 컴파일하지 않았습니다.

```sh
npm ci
npm run windows -- --release
```

`windows/Storyloom.sln`은 RN Windows 0.81의 C++ Win32 호스트입니다. SQLite는 Windows의 `winsqlite3`를 사용하는 네이티브 모듈로 분리했습니다. 자동 링크·WebView·최소 OS 버전의 실제 호환성은 Windows 환경에서 확인해야 합니다. 구성상 Desktop 최소 버전은 10.0.17763이며, 지원을 확정한 값은 아닙니다.

## AI 연결은 나중에

`src/app/runtime.ts`는 `DisconnectedProvider`만 연결합니다. API 키, OAuth 토큰, 기존 환경의 비밀값을 읽거나 저장하지 않습니다. 테스트용 응답은 `tests/`에만 존재합니다.

`GrokProvider`에는 호스트가 보관한 Bearer 인증 정보와 선택한 모델을 주입할 수 있는 스트림 어댑터가 준비되어 있습니다. **Bearer 헤더 구현은 OAuth 로그인 구현을 뜻하지 않습니다.** OAuth 지원 경로·권한·토큰 갱신을 확인한 뒤 OS 보안 저장소 어댑터를 연결해야 합니다. 검색 제공자도 아직 연결하지 않았습니다.

연결 시 모델의 실제 입력 한도와 비용, 설정·대화의 전송 범위를 확인하고, 네 플랫폼에서 스트림·취소·시간 초과·네트워크 단절을 검증해야 합니다. 현재 문자 수 기반 컨텍스트 예산은 토큰 수 계산을 대체하지 않습니다.

## 개발 문서

- [원본 제품 기획서](docs/PRODUCT_SPEC.md)
- [구조와 데이터 보존](docs/ARCHITECTURE.md)
- [코드 카드 SDK와 권한](docs/CREATOR_SDK.md)
- [검증 기록과 남은 항목](docs/VERIFICATION.md)
- [배포 시 의존성 고지](docs/LICENSES.md)

```sh
npm run verify        # 타입 검사 + 테스트 + 웹 배포 빌드
```
