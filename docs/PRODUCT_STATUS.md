# Product status / 구현 상태

Checked **2026-10-09**. The public application baseline is [`d4054e70eed9b42caa3118a6bee75d1fb2210867`](https://github.com/Dokpamo/Promlive/commit/d4054e70eed9b42caa3118a6bee75d1fb2210867). Documentation updates do not include the newer local application's changes.

한국어 안내: **공개 코드에서 실행되는 기능**, **로컬 개발 빌드에서만 검증한 기능**, **앞으로 할 일**을 구분합니다. 오래된 기획서와 엔진 문서는 현재 화면에 모두 연결되었다는 뜻이 아닙니다.

## Available in the public baseline

| Capability | Evidence in this repository | Scope |
|---|---|---|
| Library and search | [Library](../src/ui/Library.tsx), [workspace commands](../src/ui/workspace/commands.ts) | Local collection search and filters |
| Card editing | [CardEditor](../src/ui/CardEditor.tsx), [cardWorkspace](../src/ui/cardWorkspace.ts) | Drafts and completed local versions; “complete” does not publish a card to an online marketplace |
| Local conversations | [ChatRoom](../src/ui/ChatRoom.tsx), [WorkspaceMemory](../src/ui/workspace/WorkspaceMemory.ts) | Message storage, input drafts, bounded history loading; current screen does not invoke live generation |
| Persistence | [SQLite](../src/adapters/sqlite/SqliteWorkspace.ts), [IndexedDB](../src/adapters/indexeddb/IndexedWorkspace.ts) | Local persistence, not cloud synchronization |
| Profiles and personas | [PeopleSettings](../src/ui/settings/PeopleSettings.tsx) | Profile editing and persona folders |
| Desktop/mobile UI | [desktop shell](../src/ui/desktop/DesktopShell.tsx), [App](../src/ui/App.tsx) | Different shells sharing commands; implementation does not mean every platform has a verified installer |
| Provider settings | [AiSettings](../src/ui/settings/AiSettings.tsx), [selectedProvider](../src/adapters/ai/selectedProvider.ts) | Provider/model selection UI and an older xAI API engine; not all listed providers work end to end |

The current UI starts at `src/ui/App.tsx`. Earlier generation, authoring, and extension engines remain in the repository and have tests, but their presence is not evidence that those features are reachable from the current UI. [Feature map](FEATURE_MAP.md) and [architecture](ARCHITECTURE.md) describe that boundary.

## Verified in a newer local development build

The following were exercised in the native macOS development app. They are **not part of the public baseline above** and are not a release promise. The development checkout is based on `d6ac15f` plus uncommitted application work.

- Conversational card authoring with a switch to direct editing.
- Nested world folders holding character/place/rule prompts and image associations.
- A pocket page beside the conversation with story values and controls.
- Story state changes, character lifecycle/knowledge distinctions, and revision history with restore.
- Memory preparation and live model testing with the app's configured provider.

The original sample shown in the [screenshots](media/README.md) was created through the app's normal UI. Live requests in that capture session used the existing ChatGPT connection, **not Claude**. This documentation does not promise future access to any third-party model or authentication route.

## Planned work

- Review, integrate, and publish the local development changes as an identified source snapshot.
- Validate live provider behavior and failure recovery across each supported route.
- Package reproducible native builds with signing and a platform-specific smoke-test record.
- Verify Windows natively and extend mobile testing to physical devices.
- Complete dependency/asset distribution review and decide the project license.

See [development priorities](ROADMAP.md). Dates, customer counts, commercial adoption, and a general-availability launch are not claimed.

## Verification

### Fresh check: 2026-10-09

An isolated checkout of the public application baseline was installed with `npm ci`, then checked with `npm run verify`:

| Check | Result |
|---|---|
| TypeScript | Passed |
| Vitest | 64 files, 540 tests passed |
| Vite production web build | Passed; existing large-chunk warning remains |
| Native build or install | Not repeated for this documentation-only update |

The [CI workflow](../.github/workflows/verify.yml) runs the same verification on Node.js 22 and 24. A configured workflow is not a substitute for inspecting a particular run.

### Historical native evidence

The [2026-10-04 verification record](VERIFICATION.md) reports macOS and iOS Simulator Release builds and UI checks, plus Android and Windows JavaScript bundle checks. It explicitly excludes Android native verification for that change and Windows native execution. Earlier [performance experiments](performance/variable-message-matrix.md) used synthetic large datasets on macOS and mobile emulators; those results are not a zero-lag guarantee or a physical-device benchmark.

No public GitHub release or verified download is provided by this documentation update. [Packaging status](RELEASE_READINESS.md).
