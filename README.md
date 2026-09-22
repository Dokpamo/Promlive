# Promlive

세계관과 등장인물을 만들고, 그 설정으로 대화를 이어가는 로컬 창작 앱입니다. 제공된 **「로컬 AI 채팅 앱 기획서」만 제품 기준으로 사용**하여 이 폴더에 새로 구현했습니다. 기존 작업 코드와 메모리는 사용하지 않았습니다.

단일 앱 프로젝트로, `App.tsx`, `src/`, `assets/`와 플랫폼 폴더를 저장소 루트에 직접 둡니다.
아래 명령은 모두 이 루트에서 실행합니다. 앱 이름과 기존 데이터 식별자의 관계는 [브랜드 안내](docs/BRAND.md)에 정리했습니다.

현재 UI는 후속 요청에 따라 **채팅 시작 화면 + 왼쪽 채팅 내역**으로 단순화했습니다. 입력바는 제공된 S25 사진의 비율에 맞춰 위로 확장됩니다. 설정에서 xAI API 키와 모델을 선택하면 실제 생성 경로를 사용하고, 연결 전에는 전송한 문장을 기기에만 저장합니다. 첫 개인 확장인 대화 요약은 설정 → 플러그인에서 만들 수 있습니다. Grok OAuth 로그인과 출처가 있는 조사는 아직 구현하지 않았습니다.

**같이 보면서 수정하기:** 이 컴퓨터의 `Promlive_S25_API36` 에뮬레이터에 Debug 앱과 Metro를 연결했습니다. [S25 실행 안내와 치수](docs/S25_UI.md)를 참고하세요.

## 바로 실행

```sh
cd /Users/codexer/Promlive
npm ci
npm run web
```

브라우저: <http://127.0.0.1:5178>. `npm run web`은 이 컴퓨터에서만 접근할 수 있는 미리보기를 엽니다. Node.js 22.13 이상을 권장합니다. 검증 환경은 Node.js 26.0.0입니다.

macOS 앱을 빌드한 뒤에는 다음 명령으로 실행할 수 있습니다.

```sh
open build/macos/Build/Products/Release/Promlive.app
```

웹과 각 네이티브 앱의 데이터는 **각자의 저장소**에 보관됩니다. 웹은 SQLite 파일을 IndexedDB에 저장하며, 브라우저 저장소를 지우면 데이터가 사라집니다.

## 사용할 수 있는 기능

- 어두운 채팅 시작 화면, 하단 입력바, 왼쪽 Promlive 이름·검색·채팅방 목록·하단 사용자 이름과 설정 버튼.
- 채팅방 목록은 원형 아이콘, 제목, 마지막 메시지 미리보기, 시간을 표시합니다. 사용자 이름은 현재 `사용자`이며 설정은 버튼 UI만 준비했습니다.
- 빈 입력바, 한 줄·여러 줄에 맞춘 높이 변경, 최대 높이 이후 내부 스크롤, 전체 입력창 확대·접기.
- SQLite 메시지·작성 중 입력 저장, 대화 전환·재시작 후 복구, 최근 메시지 구간 조회.
- 미연결 상태에서 사용자 문장만 로컬에 저장하고 이를 표시합니다. AI 응답은 만들지 않습니다.
- 첨부·음성 버튼은 모양만 준비했으며 누르면 미연결 안내를 표시합니다.

서재·편집·설정·코드 카드 화면은 현재 탐색에서 제외했습니다. 저장 데이터와 관련 모듈은 유지하며, 신규 설치에는 샘플 카드를 만들지 않습니다. 일반 채팅은 내부 기본 카드 하나를 사용합니다.

## 검증 상태

2026-09-18 기준. 새 UI는 Android S25 규격 에뮬레이터와 웹에서 검증했습니다. 아래 Apple·Windows 항목은 이전 UI 검증 기록입니다. 상세 절차와 제한은 [검증 기록](docs/VERIFICATION.md)에 있습니다.

| 대상 | 확인한 결과 |
|---|---|
| 공통 코드 | strict TypeScript 통과, 자동 테스트 32개 통과 |
| 웹 | 배포 빌드, 412px 한글 입력 높이·내역 전환 검증 |
| macOS | Release 빌드, 네이티브 실행, 한글 입력·저장·앱 재시작 후 복구 확인 |
| iOS | Release 시뮬레이터 빌드, iOS 27 실행, 생성한 카드의 프로세스 재시작 후 유지 확인 |
| Android | S25 규격 API 36 Debug 앱에서 입력바·키보드·확대·내역·저장·재시작 확인 |
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
xcodebuild -workspace ios/Promlive.xcworkspace -scheme Promlive \
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
xcodebuild -workspace macos/promlive.xcworkspace -scheme promlive-macOS \
  -configuration Release -derivedDataPath build/macos CODE_SIGNING_ALLOWED=NO
```

### Windows

Windows의 Visual Studio C++/Windows SDK 환경에서 실행합니다. 이 Mac에서는 C++ 프로젝트를 컴파일하지 않았습니다.

```sh
npm ci
npm run windows -- --release
```

`windows/Promlive.sln`은 RN Windows 0.81의 C++ Win32 호스트입니다. SQLite는 Windows의 `winsqlite3`를 사용하는 네이티브 모듈로 분리했습니다. 자동 링크·WebView·최소 OS 버전의 실제 호환성은 Windows 환경에서 확인해야 합니다. 구성상 Desktop 최소 버전은 10.0.17763이며, 지원을 확정한 값은 아닙니다.

## AI 연결과 첫 개인 플러그인

설정 → AI에서 **xAI · API 키 · 대화 모델**을 선택하면 해당 연결로 대화와 개인 요약 플러그인을 실행합니다. 키는 기존 기기 인증 저장소에 보관하고 앱 DB·확장 문서에는 포함하지 않습니다. 연결이 없으면 채팅은 로컬 저장으로 동작합니다.

설정 → 플러그인에서 원하는 요약 방식을 적고 **AI로 만들기 → 예제 대화로 미리보기 → 권한 허용하고 적용**을 진행하면 채팅 상단에 버튼이 나타납니다. 결과는 해당 방에 별도로 저장되며, 플러그인을 끄거나 이전 버전으로 복원할 수 있습니다. [허용 범위와 버전 관리](docs/SUMMARY_EXTENSION.md)를 참고하세요.

이번 실제 생성 경로는 xAI API입니다. 다른 제공자·OAuth·검색 도구·모델별 고급 매개변수 연결은 아직 준비 중이며 설정 UI와 구분합니다. **Bearer 인증은 OAuth 로그인을 뜻하지 않습니다.** 문자 수 기반 입력 제한은 토큰 계산을 대체하지 않습니다.

## 개발 문서

- [원본 제품 기획서](docs/PRODUCT_SPEC.md)
- [작업별 기능 지도](docs/FEATURE_MAP.md)
- [구조와 데이터 보존](docs/ARCHITECTURE.md)
- [코드 카드 SDK와 권한](docs/CREATOR_SDK.md)
- [검증 기록과 남은 항목](docs/VERIFICATION.md)
- [배포 시 의존성 고지](docs/LICENSES.md)

```sh
npm run verify        # 타입 검사 + 테스트 + 웹 배포 빌드
```
