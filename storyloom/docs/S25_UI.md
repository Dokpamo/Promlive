# Promlive S25 화면

2026-09-18. 제공된 입력바 사진 4장과 후속 왼쪽 페이지 사진 2장을 기준으로 만들었습니다. 시작 화면은 채팅이며 왼쪽 페이지는 Promlive 이름, 둥근 검색바, 채팅방 목록, 하단 사용자 이름·설정 버튼 순서입니다. 배너·탭·카메라·새 채팅 버튼 등 요청에 없는 추가 요소는 표시하지 않습니다.

채팅방에는 원형 아이콘, 제목, 마지막으로 저장된 메시지, 시간을 표시합니다. 검색은 제목과 마지막 메시지 미리보기를 대상으로 동작합니다. 하단 영역은 목록 스크롤과 분리해 고정했습니다. 실제 프로필은 아직 연결하지 않아 이름은 `사용자`이며 설정 버튼도 화면 연결 전 상태입니다.

## 함께 보면서 수정하기

현재 Mac에 `Promlive_S25_API36`이라는 별도 Android 에뮬레이터를 만들었습니다. 표시 이름은 **Promlive S25**, 해상도는 1080 × 2340, 밀도는 420dpi, OS는 Google APIs Android 16 / API 36입니다. Android Debug 앱과 Metro를 연결하여 소스 수정 시 Fast Refresh를 사용할 수 있습니다.

실제 Samsung One UI 이미지가 아닙니다. 420dpi는 이 미리보기의 설정이며 S25 실기기의 디스플레이 확대·글꼴 설정을 확인한 값은 아닙니다. 사진은 상태 표시줄·내비게이션 영역이 잘려 있고 JPEG로 압축되어 있어 폰트·키보드·안전 영역까지 한 픽셀의 오차도 없다고 보장할 수 없습니다. 실기기의 마지막 확인은 남아 있습니다.

이 컴퓨터에서 다시 실행할 때, 터미널별로 다음을 실행합니다. 이미 실행 중인 Metro와 에뮬레이터는 그대로 사용하면 됩니다.

```sh
cd /Users/codexer/Promlive/storyloom
npm start -- --port 8081
```

```sh
/Users/codexer/Library/Android/sdk/emulator/emulator \
  -avd Promlive_S25_API36 -port 5564 -no-snapshot
```

```sh
cd /Users/codexer/Promlive/storyloom
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/Users/codexer/Library/Android/sdk \
./android/gradlew -p android assembleDebug --console=plain
/Users/codexer/Library/Android/sdk/platform-tools/adb -s emulator-5564 install -r android/app/build/outputs/apk/debug/app-debug.apk
/Users/codexer/Library/Android/sdk/platform-tools/adb -s emulator-5564 reverse tcp:8081 tcp:8081
/Users/codexer/Library/Android/sdk/platform-tools/adb -s emulator-5564 shell am start -n com.storyloom/.MainActivity
```

프로필 등록은 `~/.android/avd/Promlive_S25_API36.ini`, 에뮬레이터 데이터는 `build/s25.avd`에 있습니다. 이 기기의 로컬 미리보기 설정이므로 Git에 포함하지 않습니다. 앱의 내부 패키지 ID `com.storyloom`은 저장 데이터의 연속성을 위해 유지했습니다.

## 입력바 치수

원본 사진의 너비 618을 기준으로 `화면 논리 너비 / 618` 배율을 적용합니다. 수치는 `src/features/chat/chatAppearance.ts`에 모았습니다. 하단 위치는 OS 안전 영역 위에 고정하며 입력이 길어지면 위로 늘어납니다.

| 항목 | 참고 사진 px | 1080px 에뮬레이터에서 확인 |
|---|---:|---:|
| 좌우 여백 | 20 | 각각 35px |
| 하단 여백 | 20 | 안전 영역 위 35px |
| 기본 높이 | 111 | 194px |
| 한 줄 입력 높이 | 171 | 299px |
| 두 줄 입력 높이 | 208 | 364px |
| 최대 높이 | 265 | 463px |
| 버튼 지름 | 70 | 약 122px |

최대 높이 이후에는 입력 내용이 내부에서 스크롤되고 확대 버튼으로 전체 입력창을 열 수 있습니다. 큰 시스템 글꼴에서는 읽을 수 있도록 높이가 달라질 수 있습니다. 웹과 모바일은 동일한 입력바·내역 컴포넌트를 공유하고, 실제 텍스트 입력만 각 플랫폼에 맞게 렌더링합니다.

## 확인한 동작

- Android에서 빈 입력·한 줄·두 줄·최대 높이의 레이아웃과 위로 확장되는 동작.
- 키보드 열기·닫기 후 입력바 위치 복귀, 최대 높이 내부 스크롤.
- 전체 입력창에서 수정 후 접기, 짧아진 내용에 맞춘 축소.
- 전송 후 기본 높이 복귀, 새 채팅, 내역에서 이전 대화 열기.
- 작성 중 내용의 프로세스 재시작 후 복구.
- 웹 412 × 853 미리보기에서 한글 줄바꿈, 높이 제한, 내역 검색·재열기.

AI 인증·응답, 첨부, 음성 입력은 연결하지 않았습니다. 전송 버튼은 사용자 문장만 SQLite에 저장하며 화면에 `기기에만 저장됨`을 표시합니다. 첨부·음성 버튼은 미연결 안내를 표시합니다.

실행 화면: [채팅 시작 화면](screenshots/android-s25-chat.png), [왼쪽 채팅 내역](screenshots/android-s25-history.png).

관련 문서: [React Native Fast Refresh](https://reactnative.dev/docs/fast-refresh), [Samsung S25 사양](https://www.samsung.com/sec/smartphones/galaxy-s25/specs/).
