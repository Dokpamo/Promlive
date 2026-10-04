# 대용량 화면 벤치마크

AI 호출 없이 카드·채팅 더미를 만들고 실제 UI 경로를 측정한다. 결과 해석과 선택한 값은 [측정 보고서](../../docs/performance/variable-message-matrix.md)에 있다. 프레임이 비지 않는 것, 로딩 경계에서 기다리지 않는 것, 프레임 마감을 지키는 것은 서로 다른 지표다.

## 준비

- 프로젝트 의존성 설치 후 `npm run verify`.
- Node 22.13 이상(`node:sqlite`), Python 3, ffmpeg/ffprobe. 영상 분석에는 numpy가 필요하다.
- 네이티브는 Release로 실행한다. 실제 앱과 벤치마크를 동시에 측정하지 않는다.
- 실행 이름을 매번 다르게 준다. 서버는 `127.0.0.1:8785`, 웹 시안은 `127.0.0.1:8786`이다.
- 저장소와 번들/패키지 식별자를 아래처럼 분리한다. 사용자 데이터 DB 위에 fixture를 복사하지 않는다. 기존 벤치마크 DB를 교체할 때도 앱을 종료하고 이전 파일을 보존한다.

```sh
npx esbuild scripts/performance/generate.ts --bundle --platform=node --format=cjs --outfile=/tmp/promlive-generate-workspace.cjs
node /tmp/promlive-generate-workspace.cjs /tmp/promlive-benchmark/matrix.sqlite --matrix
python3 scripts/performance/server.py /tmp/promlive-benchmark
```

서버는 별도 터미널에서 유지한다. `--matrix`를 빼면 예전의 10,000자 고정 길이 데이터가 만들어진다. DB 생성 후 함께 출력되는 `.sqlite.json`에 실제 개수·길이 범위가 기록된다.

| `--case` | 내용 | 방 ID |
| --- | --- | --- |
| 0 | 모두 10,000자 | `perf-00000` |
| 1 | 짧은 메시지 | `perf-00001` |
| 2 | 모두 1,000자 | `perf-00002` |
| 3 | 사용자와 AI의 길이가 다른 혼합 | `perf-00003` |
| 4 | 짧은 문장 사이에 50,000자 | `perf-00004` |

`native-entry.js`는 `config.json`을 읽고 `promlive-performance-matrix`라는 별도 DB를 연다. 메서드 호출 시간·메시지 개수·길이·위치만 보고하며 본문 전문이나 API 키를 서버로 보내지 않는다. 일반 앱 진입점에는 이 코드를 import하지 않는다.

## macOS

별도 DerivedData와 번들 ID로 빌드한다. 빌드 산출물을 `/tmp/PromliveBenchmark.app`에 복사하면 러너 기본값을 그대로 쓸 수 있다. 이 빌드는 일반 앱 배포용이 아니다.

```sh
xcodebuild -workspace macos/Promlive.xcworkspace -scheme Promlive -configuration Release -destination 'platform=macOS' -derivedDataPath /tmp/promlive-benchmark-macos ENTRY_FILE=scripts/performance/native-entry.js PRODUCT_BUNDLE_IDENTIFIER=com.promlive.benchmark CODE_SIGNING_ALLOWED=NO build
ditto /tmp/promlive-benchmark-macos/Build/Products/Release/Promlive.app /tmp/PromliveBenchmark.app
cp /tmp/promlive-benchmark/matrix.sqlite ~/Library/promlive-performance-matrix.sqlite
swiftc scripts/performance/window-info.swift -o /tmp/promlive-window-info
swiftc scripts/performance/record-window.swift -o /tmp/promlive-record-window
python3 scripts/performance/macos-run.py mac-short-01 --root /tmp/promlive-benchmark --case 1 --record
python3 scripts/performance/macos-run.py mac-cards-01 --root /tmp/promlive-benchmark --screen library --record
python3 scripts/performance/macos-run.py mac-chats-01 --root /tmp/promlive-benchmark --screen chats --record
```

macOS 녹화 도구는 ScreenCaptureKit으로 해당 앱 창만 캡처한다. macOS의 화면 기록 권한이 필요하다. 샌드박스 설정을 바꾼 빌드에서는 컨테이너의 실제 Library 위치를 먼저 확인한다. 기본 프로젝트의 비샌드박스 구성에서는 위 `~/Library` 경로를 사용한다.

자동 스크롤은 6초 이전 방향 → 4초 반전 → 6초 이전 방향이며 기본 2,500px/s다. `--tuning '{"messagePage":16,"renderWindow":5,"renderBatch":4}'`로 비교 값을 바꿀 수 있다. `--profile`은 macOS `sample`을 같이 기록하며, 프로파일러가 없는 실행과 시간 결과를 섞지 않는다.

실제 휠은 아래 설정 후 벤치마크 앱을 열어 본문에 직접 입력한다. 자동 이동은 꺼져 있다. 수동 실행의 분석 구간을 정확히 지정하려면 `<run>-run.json`에 `gestureStart`·`gestureEnd`를 Unix epoch 밀리초로 기록한다.

```sh
python3 scripts/performance/configure-run.py /tmp/promlive-benchmark mac-wheel-01 --case 1 --manual
open -n /tmp/PromliveBenchmark.app
```

## iOS Simulator

벤치마크 식별자는 `com.promlive.benchmark`다. 기본 빌드에서 일반 앱과 같은 bundle ID를 사용하지 않는다. XcodeBuildMCP를 사용할 때에도 별도 bundle ID와 `ENTRY_FILE`을 동일하게 지정한다.

```sh
xcrun simctl list devices booted
xcodebuild -workspace ios/Promlive.xcworkspace -scheme Promlive -configuration Release -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath /tmp/promlive-benchmark-ios ENTRY_FILE=scripts/performance/native-entry.js PRODUCT_BUNDLE_IDENTIFIER=com.promlive.benchmark CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=15.1 build
xcrun simctl install booted /tmp/promlive-benchmark-ios/Build/Products/Release-iphonesimulator/Promlive.app
xcrun simctl get_app_container booted com.promlive.benchmark data
```

마지막 명령으로 얻은 **벤치마크 컨테이너**의 `Library/promlive-performance-matrix.sqlite`로 fixture를 복사한다. 설치를 다시 하면 컨테이너 경로가 바뀔 수 있다. 하나의 부팅된 시뮬레이터만 있을 때 `booted`를 사용하며 여러 개라면 정확한 UDID를 지정한다.

```sh
python3 scripts/performance/configure-run.py /tmp/promlive-benchmark ios-short-01 --case 1
xcrun simctl launch booted com.promlive.benchmark
python3 scripts/performance/wait-run.py /tmp/promlive-benchmark/ios-short-01.jsonl
```

녹화는 다른 터미널에서 시작하고 끝난 뒤 Ctrl-C로 저장한다. 네이티브 스와이프를 비교할 때는 `configure-run.py`에 `--manual`을 지정하고 동일한 방향·거리·시간의 제스처를 사용한다. 앱 재실행 전에는 벤치마크 앱만 종료한다.

```sh
xcrun simctl io booted recordVideo --codec=h264 /tmp/promlive-benchmark/ios-short-01.mp4
xcrun simctl terminate booted com.promlive.benchmark
```

이번 SDK에서는 일부 Pod의 오래된 타깃 버전이 거부돼 앱의 최소 버전과 같은 15.1을 빌드 인자로 주었다. 프로젝트의 지원 OS를 바꾼 것은 아니다.

## Android

패키지 `com.storyloom.benchmark`와 앱 내부 DB를 사용한다. `JAVA_HOME`·`ANDROID_HOME`·`PATH`는 설치 환경에 맞춘다. 스크립트의 대상은 현재 `emulator-5554`로 고정돼 있다. 다른 장치를 사용할 때는 스크립트의 `serial`을 명시적으로 바꾼다.

```sh
./android/gradlew -p android :app:assembleRelease -PperformanceBuild -PreactNativeArchitectures=arm64-v8a
adb -s emulator-5554 install -r android/app/build/outputs/apk/release/app-release.apk
adb -s emulator-5554 shell run-as com.storyloom.benchmark mkdir -p databases
adb -s emulator-5554 push /tmp/promlive-benchmark/matrix.sqlite /data/local/tmp/promlive-performance-matrix.sqlite
adb -s emulator-5554 shell run-as com.storyloom.benchmark cp /data/local/tmp/promlive-performance-matrix.sqlite databases/promlive-performance-matrix.sqlite
adb -s emulator-5554 shell rm /data/local/tmp/promlive-performance-matrix.sqlite
python3 scripts/performance/android-run.py /tmp/promlive-benchmark android-short-01 --case 1 --anchor 10000 --fast --count 36 --reverse --trace
```

러너는 UI 트리에서 본문 영역을 읽고 그 안에서 제스처를 보낸다. `--trace`는 Perfetto의 FrameTimeline·스케줄링·뷰 작업을 함께 기록한다. 녹화 중지를 포함해 중간 실패가 있었다면 해당 실행의 녹화·추적 프로세스를 확인하고 종료한 뒤 새 이름으로 다시 실행한다.

다음 두 실행은 원인을 분리하기 위한 대조군이다. 정상·지연·녹화 유무 실행은 각각 따로 수행한다.

```sh
python3 scripts/performance/android-run.py /tmp/promlive-benchmark android-no-video-01 --case 1 --anchor 10000 --fast --count 36 --reverse --trace --no-video
python3 scripts/performance/android-run.py /tmp/promlive-benchmark android-slow-read-01 --case 1 --anchor 10000 --fast --count 36 --reverse --delay 1000
```

## Windows — 실행 환경에서 검증 필요

이 경로는 이번 Mac 호스트에서 빌드하거나 실행하지 못했다. Visual Studio의 프로젝트 요구 워크로드와 Windows SDK가 있는 Developer PowerShell에서 실행한다. 솔루션의 대상 아키텍처에 맞춰 `x64`를 바꾼다.

```powershell
msbuild windows/Promlive.sln /restore /p:Configuration=Release /p:Platform=x64 /p:PromlivePerformanceBuild=true
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA/PromliveBenchmark"
Copy-Item C:/promlive-benchmark/matrix.sqlite "$env:LOCALAPPDATA/PromliveBenchmark/storyloom.sqlite"
python scripts/performance/server.py C:/promlive-benchmark
```

서버를 유지하고 별도 터미널에서 실제 빌드된 `PromliveBenchmark.exe` 경로를 지정한다.

```powershell
./scripts/performance/windows-run.ps1 -App C:/path/to/PromliveBenchmark.exe -Root C:/promlive-benchmark -Run windows-short-01 -Case 1
```

`PromlivePerformanceBuild=true`는 별도 실행 파일 이름, 벤치마크 진입점, `%LOCALAPPDATA%/PromliveBenchmark` 저장소를 선택한다. 일반 `Storyloom` 폴더를 사용하지 않는다. 러너는 JS·저장소 관측과 CPU/메모리 표본만 수집하므로, Windows에서도 원본 녹화와 PresentMon/ETW 등 실제 프레임 자료를 추가해야 완료로 볼 수 있다.

## 분석

```sh
python3 scripts/performance/analyze-run.py /tmp/promlive-benchmark/android-short-01.jsonl
python3 scripts/performance/analyze-video.py /tmp/promlive-benchmark/android-short-01.mp4
python3 scripts/performance/analyze-video.py /tmp/promlive-benchmark/mac-short-01.mp4 --roi .35,.16,.98,.78
```

`--roi`는 창에서 본문만 포함하는 영역이다. 영상 크기·창 배치가 다르면 새로 확인한다. 진입 장면을 제외할 때 `--start`를 쓰고 값을 결과에 남긴다. 기본 밝기 판정은 라이트 모드의 전체 공백 검출용이며 다크 모드에는 그대로 쓰지 않는다.

`analyze-run.py`의 `uncoveredSamples`는 행 위치 측정이 잠깐 오래된 경우도 포함한다. 영상의 실제 공백과 같다고 해석하지 않는다. `boundaryLoadingSamples`는 읽은 범위 끝에서 조회 중인 표본으로, 로딩 대기를 찾는 데 사용한다. JS tick 간격은 화면 FPS가 아니다.

Perfetto에서는 앱 프레임과 SurfaceFlinger 프레임을 분리하고, `App Deadline Missed`·`SurfaceFlinger CPU Deadline Missed`·`Prediction Error`·버퍼 적체를 구분한다. 긴 프레임의 스레드가 실행 중인지 대기 중인지도 함께 확인한다. 실물 기기 없이 에뮬레이터 영향의 비율을 확정하지 않는다.

실행이 끝나면 벤치마크 앱·녹화·테스트 서버만 종료하고, 일반 Release 산출물을 다시 만들거나 별도 DerivedData를 유지한다. 더미 DB와 영상은 Git에 추가하지 않는다.
