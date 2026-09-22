# 의존성 고지

고정한 버전은 `package.json`, `package-lock.json`, Apple의 각 `Podfile.lock`에 기록되어 있습니다. 원문 고지는 `THIRD_PARTY_NOTICES.md`, `licenses/ios-pods.md`, `licenses/macos-pods.md`에 모았습니다.

주요 런타임 패키지인 React, React Native, RN macOS, RN Windows, React Native Web, op-sqlite, react-native-webview, safe-area-context, sql.js, Zod는 설치된 패키지 기준 MIT입니다. SQLite 자체는 public domain입니다. TypeScript는 Apache-2.0이며 개발 도구입니다. 네이티브 빌드에는 RN의 C++·Hermes 의존성과 각 플랫폼 SDK가 추가됩니다.

MIT 의존성의 저작권·허가 고지를 배포물과 함께 유지해야 합니다. Apache-2.0 의존성은 라이선스 및 해당 NOTICE를 유지해야 합니다. BSD 등 전이 의존성의 개별 고지는 원문을 확인합니다. 앱 코드 자체의 공개 라이선스는 임의로 정하지 않았습니다.

`node scripts/collect-notices.cjs`는 현재 lockfile의 설치된 비개발 npm 패키지에서 LICENSE/COPYING/NOTICE를 수집합니다. CocoaPods 고지도 해당 스크립트가 복사합니다. 이 파일은 Android Maven/Windows NuGet/OS SDK의 모든 바이너리를 감사한 보고서가 아닙니다. 실제 배포 타깃의 최종 의존성 목록과 재배포 조건, 제3자 고지 표시 방식을 릴리스 전에 확인해야 합니다.

샘플 이야기·앱 화면 도형은 이번 작업에서 작성했습니다. 외부 소설·이미지·폰트 파일을 포함하지 않았으며 UI 글꼴은 운영체제 기본 글꼴을 사용합니다. 플랫폼 생성기가 넣은 기본 앱 아이콘과 호스트 코드는 해당 React Native 템플릿의 고지를 따릅니다.
