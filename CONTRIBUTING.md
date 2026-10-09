# Contributing to Promlive

Promlive is in active development. Start with [product status](docs/PRODUCT_STATUS.md), [setup](docs/GETTING_STARTED.md), and the [source map](docs/FEATURE_MAP.md). Historical designs may describe functionality that is not connected to the current UI.

## Before making a change

- Reproduce the problem with synthetic data. Describe the platform, source commit, steps, and expected result.
- Keep the scope small and preserve existing user data, drafts, and migration behavior.
- Reuse the current `src/ui` components and shared workspace commands. Desktop and mobile shells should agree on data behavior.
- Keep native platform imports behind their existing platform-specific boundaries.

## Validation

```sh
npm ci
npm run verify
```

Add a regression test when fixing data loss, cancellation, ordering, or migration behavior. For native input, layout, or keyboard changes, also reproduce the flow on the affected platform; JavaScript tests alone do not establish native correctness. State untested platforms in the change description.

## Pull requests

Explain the user-visible problem, resulting behavior, and checks performed. Include original synthetic screenshots when they make a UI change easier to review. Exclude credentials, local databases, account information, private messages, and assets you do not have permission to share.

There is currently no project-wide license declaration. This guide does not introduce a contributor license agreement or grant additional reuse rights. Questions: [contact@promlive.com](mailto:contact@promlive.com).

## 한국어 안내

문제를 재현할 수 있는 작은 변경을 권장합니다. 저장·이관·취소·복구를 수정할 때는 사용자 자료와 초안을 보존하고 회귀 테스트로 확인해 주세요. 화면 변경은 영향받는 플랫폼에서 직접 확인하고, 검증하지 않은 플랫폼은 명시합니다. 계정 정보나 개인 대화, 공개 권한이 없는 이미지 대신 자체 예시 자료를 사용해 주세요.
