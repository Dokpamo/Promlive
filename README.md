# Promlive

세계관과 등장인물을 만들고 그 설정으로 대화하는 로컬 AI 채팅 앱 프로젝트입니다.

현재 화면은 **채팅을 시작 화면으로 사용하는 간단한 UI**입니다. 왼쪽 메뉴에서 채팅 내역을 열며, 입력바는 제공된 S25 사진의 치수를 기준으로 구현했습니다.

앱 소스와 플랫폼별 실행 프로젝트는 [`storyloom/`](storyloom/)에 있습니다.

```sh
cd storyloom
npm ci
npm run web
```

- [앱 실행 안내](storyloom/README.md)
- [S25 실시간 미리보기와 입력바 치수](storyloom/docs/S25_UI.md)
- [검증 결과와 남은 항목](storyloom/docs/VERIFICATION.md)
- [제품 기획서](storyloom/docs/PRODUCT_SPEC.md)

인증 연결은 후속 단계로 보류되어 있습니다. 현재 앱에서 실제 AI 호출은 실행하지 않습니다.
