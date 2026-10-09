# Development priorities / 다음 개발 과제

Updated 2026-10-09. These are engineering priorities, not scheduled releases.

## 1. Publish a coherent AI creation workflow

Review the newer local implementation of conversational authoring, shared drafts, world folders, pocket state, and restore. Land it as an identifiable source snapshot with tests before presenting it as part of the public clone.

Relevant public boundaries: [workspace commands](../src/ui/workspace/commands.ts), [workspace model](../src/features/workspace/model.ts), [storage contract](../src/ports/workspace.ts), and [generation coordination](../src/features/chat/generation.ts).

Acceptance evidence: create a synthetic story through the UI, edit it directly, complete it, start a conversation, reopen the app, and verify that the saved draft and active version remain distinct.

## 2. Keep long stories consistent and recoverable

Test state changes and revision restore against existing conversation history. Character lifecycle, who knows a fact, and currently active rules must remain separate. Restoring a world revision must not be silently undone by an older conversation summary.

Local development files (not yet in the public baseline): `src/features/world/model.ts`, `src/features/memory/NarrativeService.ts`, `src/features/workspace/CreationService.ts`, and their regression tests.

Acceptance evidence: synthetic change/restore/replay scenarios, including a character's recorded death and a restore to an earlier living state; inspect both stored state and the next generated response.

## 3. Make storage and streaming failures explicit

Extend tests for interrupted streams, partial results, cancellation, stale callbacks, failed persistence, and schema migrations. Keep UI state aligned with committed storage rather than displaying a successful save prematurely.

Relevant public files: [generation.ts](../src/features/chat/generation.ts), [SqliteWorkspace.ts](../src/adapters/sqlite/SqliteWorkspace.ts), [IndexedWorkspace.ts](../src/adapters/indexeddb/IndexedWorkspace.ts), and [WorkspaceMemory.ts](../src/ui/workspace/WorkspaceMemory.ts).

Acceptance evidence: deterministic fault injection and regression tests, followed by native restart/recovery checks. Provider-specific behavior must be tested independently.

## 4. Validate distributable desktop and mobile builds

Measure native input, scrolling, image loading, and layout with synthetic short, long, and mixed-length conversations. Establish Windows runtime evidence and physical mobile-device checks. Package builds only when their source, signing, and validation can be identified.

Relevant files: [message viewport](../src/ui/chat/useMessageViewport.ts), [message list](../src/ui/chat/MessageList.tsx), [desktop shell](../src/ui/desktop/DesktopShell.tsx), platform projects, and [performance records](performance/variable-message-matrix.md).

Acceptance evidence: exact source revision, reproducible build command, artifact checksum, platform smoke test, and frame/latency measurements. Simulator or emulator behavior should be separated from storage and rendering costs.

## Planned internal use of Claude / Claude Code

Claude and Claude Code are intended as **internal development tools** for the work above: trace cross-file state and persistence bugs, propose focused changes, write meaningful regression tests, and compare native performance evidence. Human review and the project's automated/native checks remain the acceptance criteria.

This is a development plan, not a claim of current Claude-powered product inference, an Anthropic partnership, or program acceptance.

한국어: Claude·Claude Code는 내부 개발에서 사용할 계획입니다. 구체적으로 세계관 복원과 기억 충돌, 스트리밍·저장 실패, 대용량 스크롤, 플랫폼별 빌드 문제를 소스와 테스트로 확인하는 데 활용하려 합니다. 제품이 이미 Claude API로 동작한다고 주장하지 않습니다.
