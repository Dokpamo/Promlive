# Promlive 앱 아이콘과 시작 화면

확정된 P01 심벌의 원본은 `assets/brand/promlive-mark.svg`다. 기존 브랜드 작업 사본에서
가져왔으며 세 조각의 좌표·비율·곡률과 기본 앱 아이콘은 원본 그대로 유지한다.

- 심벌: 144 × 144. 왼쪽 32 × 144 기둥, 오른쪽 위 96 × 96, 오른쪽 아래 96 × 32.
- 앱 아이콘: 검정 바탕 + 흰 심벌. 기본 SVG는 216 × 216, 심벌 144, 사방 여백 36.
- Android adaptive icon: 108 dp 레이어의 중앙에 48 dp 심벌. API 33 이상은 단색 테마 아이콘도 제공한다.
- Android 스플래시: 288 dp 투명 캔버스 중앙에 108 dp 심벌. 라이트는 흰 바탕·검정 심벌,
  다크는 검정 바탕·흰 심벌이며 안드로이드의 중앙 마스크 안전 영역 안에 배치한다.

```sh
npm run build:brand
```

Android SVG/XML 및 크기별 PNG는 원본에서 생성한다. `scripts/generate-android-brand.cjs`를 사용하며
생성 파일을 따로 수정하지 않는다. Sharp는 생성 도구에만 쓰는 개발 의존성이다.

시작 화면에는 AndroidX `core-splashscreen`을 사용한다. 앱 설정·저장소·입력 초안 복원과 채팅 배치가 끝난 화면 또는
오류 화면이 준비되면 해제하며 표시 시간을 늘리는 대기는 없다. JS가 시작되지 못한 경우에만
10초 후 기본 화면을 노출해 실행 화면에 갇히지 않도록 한다.
앱의 라이트·다크·시스템 선택은 네이티브에도 보관해 다음 실행의 첫 화면에 반영한다.

참고: [Android 스플래시](https://developer.android.com/develop/ui/views/launch/splash-screen),
[앱별 다크 모드](https://developer.android.com/develop/ui/views/theming/darktheme).
