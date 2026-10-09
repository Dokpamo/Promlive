# Run and develop Promlive / 실행 안내

The commands below apply to the public source. Read [product status](PRODUCT_STATUS.md) first: the current public chat UI stores local messages; newer AI authoring screenshots show a separate local development build.

## Web preview

Prerequisites: Git, npm, Node.js **22.13+**. CI tests Node.js 22 and 24. Run commands from the repository root.

```sh
git clone https://github.com/Dokpamo/Promlive.git
cd Promlive
npm ci
npm run web
```

Open [http://127.0.0.1:5178](http://127.0.0.1:5178). Vite binds to loopback. If port 5178 is occupied, stop the other development server or run `npm run web -- --port 5180`; changing the origin gives the browser a separate local workspace.

Try Library → a card → a conversation, or Creation → `+` → edit a draft. Completing a card creates a local version in the library. Settings contains profile, persona, appearance, and AI configuration pages. It does not make every listed AI provider available in the current public chat UI.

현재 웹 작업공간은 IndexedDB에 저장됩니다. 브라우저 저장소를 지우거나 다른 포트·브라우저로 접속하면 같은 자료가 보이지 않을 수 있습니다. 네이티브 앱과 웹의 데이터는 자동으로 동기화되지 않습니다.

## Verification

```sh
npm run typecheck
npm test
npm run build:web
# All three:
npm run verify
```

Use the lockfile and keep the dependency patches in `patches/`; `npm ci` applies them through `postinstall`. The production web output is `dist/`, but this repository does not provide a hosted product deployment through these commands.

## macOS

Requires macOS, Xcode, and CocoaPods. The project targets macOS 14.0 or later; a deployment target alone is not a full compatibility guarantee.

```sh
pod install --project-directory=macos
npm run macos
```

For a local Release build:

```sh
xcodebuild -workspace macos/promlive.xcworkspace -scheme promlive-macOS \
  -configuration Release -derivedDataPath build/macos CODE_SIGNING_ALLOWED=NO
open build/macos/Build/Products/Release/Promlive.app
```

This command disables distribution signing. It does not produce a notarized installer. Do not treat a locally built `.app` as a validated public download.

## iOS

Requires macOS, Xcode, CocoaPods, and a Simulator runtime. Install pods with the repository's prebuilt React Native configuration:

```sh
RCT_USE_RN_DEP=1 RCT_USE_PREBUILT_RNCORE=1 pod install --project-directory=ios
npm run ios
```

Simulator Release build:

```sh
xcodebuild -workspace ios/Promlive.xcworkspace -scheme Promlive \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO
```

Physical-device signing and App Store distribution are separate tasks.

## Android

Requires JDK 17, Android SDK 36 and build tools, plus an emulator or device. The configured minimum SDK is 24. Set `JAVA_HOME` and the Android SDK location for your machine; do not copy another developer's absolute paths.

```sh
npm run android
# Local Release APK:
./android/gradlew -p android assembleRelease
```

The current Release configuration uses the debug signing key for local testing. Distribution needs an appropriate release signing configuration. Debug sessions use Metro (`npm run start` if it is not already running).

## Windows

Use a Windows development machine with Visual Studio's C++ tooling and the Windows SDK for the checked-in RN Windows project:

```sh
npm ci
npm run windows -- --release
```

`windows/Promlive.sln` contains the native host and SQLite module. Windows JavaScript bundling has been checked; a successful native build, launch, and installer have **not** been verified. Do not interpret this setup section as a Windows release announcement.

## Data and credentials

- Native workspace data uses SQLite; current web workspace data uses IndexedDB. Older settings/generation services have their own storage path.
- Preserve local data before experimenting with migrations. Do not remove data files to hide a storage failure.
- Never commit API keys, OAuth material, local databases, or private chat screenshots.
- Provider model names in settings are configuration data, not a guarantee of account access or a working generation route.

For source ownership, use [FEATURE_MAP.md](FEATURE_MAP.md). For historical validation, use [VERIFICATION.md](VERIFICATION.md).
