# Creator SDK v1

코드 카드는 템플릿 필드와 독립된 HTML·CSS·JavaScript 소스를 저장합니다. 실행 버튼을 눌러야 시작되며, 저장하거나 카드 목록을 보는 것만으로 실행되지 않습니다.

## 기본 사용

HTML:

```html
<main>
  <h1>작은 세계</h1>
  <p id="answer">첫 장면을 기다립니다.</p>
  <button id="create">다음 장면</button>
</main>
```

JavaScript:

```js
creator.on('click', '#create', async () => {
  creator.text('#answer', '문을 열자 작은 숲이 나타났다.');
});
```

실제 AI 제공자 연결과 이번 실행의 호출 허용을 마친 뒤에는 다음 패턴을 사용할 수 있습니다. 현재 앱에서는 호출 권한 스위치가 비활성화되어 있습니다.

```js
let request;
creator.on('click', '#create', async () => {
  try {
    request = creator.generate('숲에서 만나는 인물의 첫 대사를 써 줘.');
    creator.text('#answer', await request);
  } catch (error) {
    creator.text('#answer', error.message);
  }
});
// 중단할 때: creator.cancel(request.requestId)
```

`creator.on`의 이벤트는 `click`, `input`, `change`이며 콜백은 `{value}`를 받습니다. `creator.text`는 문자열만 삽입합니다. `creator.generate`는 문자열 결과 Promise와 `requestId`를 반환합니다. JS에서 DOM을 직접 조작하는 API는 제공하지 않습니다.

## 허용 범위

HTML은 main/section/article/header/footer/div/p/h1~h4/span/button/label/input/textarea/ul/ol/li/strong/em/small/pre/code/br/hr만 허용합니다. 속성은 id/class/placeholder/type/value/aria-label/disabled만 남깁니다. 입력 타입은 text/number/checkbox/range입니다. script/iframe/form/링크/미디어와 인라인 이벤트 속성은 제거합니다. CSS는 별도 텍스트로 삽입합니다.

웹은 `sandbox="allow-scripts"` iframe, 네이티브는 제한된 WebView로 화면을 표시합니다. 사용자 JS는 별도 Worker에서 실행합니다. CSP는 외부 통신·프레임·폼·베이스 URL을 막고, WebView에서도 탐색·파일 접근을 제한합니다. 앱 전체 DB·파일·네이티브 API와 인증 정보는 SDK에 노출하지 않습니다.

요청은 실행 인스턴스와 SDK 버전에 묶여 있습니다. 호스트가 메시지 형식·ID·권한을 검증하고 같은 실행의 재사용 요청 ID를 거부합니다. AI는 실행당 동시 1개, 분당 6개이며 전역 생성 제한도 함께 적용합니다. 화면 종료 시 실행 권한을 회수하고 진행 중 요청을 취소합니다.

Worker는 200ms 간격으로 응답 확인 신호를 보냅니다. 약 2초 이상 신호가 없으면 중단하며, 실행 수명은 최대 5분입니다. 화면 메시지는 초당 120개를 넘으면 중단됩니다. 소스와 텍스트 길이도 제한합니다.

## 검증과 제한

브라우저에서 버튼 이벤트·텍스트 변경·무한 루프의 자동 중단과 앱의 계속 응답을 확인했습니다. SDK 형식, 인스턴스, 권한, 호출 한도, 재사용 방지, 종료 후 권한 회수는 자동 테스트로 확인했습니다.

네이티브 WebView의 Worker/CSP 및 파일·탐색 경계를 네 플랫폼에서 모두 검증하지 않았습니다. Worker는 OS 수준 메모리 할당량을 제공하지 않으므로 대규모 할당으로 인한 메모리 압박까지 완전히 차단한다고 보장하지 않습니다. 임의의 타인 코드를 배포·실행하는 제품으로 출시하기 전 플랫폼별 검증과 메모리 제한 보완이 필요합니다.

현재 카드 소스는 기기 안에서 작성·저장하는 방식이며 코드 마켓·원격 설치·외부 라이브러리 로딩은 구현하지 않았습니다.
