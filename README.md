<p align="center"><img src="assets/brand/promlive-mark.svg" width="64" alt="Promlive" /></p>

# Promlive

**A local workspace for characters, worlds, and interactive stories.**

Build a story around the people, places, and rules that make it yours. Promlive brings card creation, a personal library, and conversations into one React Native app.

[Website](https://promlive.com) · [한국어](README.ko.md) · [Get started](docs/GETTING_STARTED.md) · [Product status](docs/PRODUCT_STATUS.md) · [Contact](mailto:contact@promlive.com)

[![Verify](https://github.com/Dokpamo/Promlive/actions/workflows/verify.yml/badge.svg)](https://github.com/Dokpamo/Promlive/actions/workflows/verify.yml)

> **In active development.** The public source supports card editing, a library, persistent local conversations, and settings. Conversational AI authoring and connected world state are being tested in a newer local development build. They are not included in the public application baseline described here. There is no packaged public release yet.

## From an idea to a story

1. **Create a card.** Write its title, introduction, starting scene, tags, and gallery. Keep a draft while refining the version used in your library.
2. **Organize your library.** Search cards, revisit recent stories, and continue existing conversations.
3. **Keep the work on your device.** Drafts, cards, messages, and reading positions use local persistence with bounded loading for large collections.

The next stage connects this workflow to AI-assisted creation: describe an idea in conversation, inspect the resulting world folders, and carry changes into play with a history you can revisit.

## Development preview

The following are **actual macOS development-build captures**, made with an original sample story and cover. They show work ahead of public `main`, not a downloadable release. [Capture provenance and scope](docs/media/README.md).

![An original story in the Promlive library and detail pane](docs/media/library-macos-dev.png)

| World editing | Character settings |
|---|---|
| ![World folders in the macOS development build](docs/media/world-macos-dev.png) | ![A character folder in the world editor](docs/media/character-macos-dev.png) |

## What works in the public source

| Area | Current public baseline |
|---|---|
| Library and creation | Searchable cards, draft editing, a completed local card version, gallery viewing |
| Conversations | Local message persistence, draft recovery, history paging, scroll restoration |
| Settings | User profile, personas and folders, appearance, provider/model configuration UI |
| Desktop and mobile | Desktop icon rail and settings panes; mobile tabs, gestures, and keyboard handling |
| Storage | SQLite on native targets; row-based IndexedDB for the current web workspace |

**AI integration has a separate status.** The public repository retains an xAI generation adapter and earlier generation services, but its current chat screen sends messages to local storage and does not call that generation service. A provider appearing in Settings does not establish a working end-to-end connection. See the [implementation matrix](docs/PRODUCT_STATUS.md) before evaluating AI features.

## Run locally

Use Node.js **22.13 or newer** and the checked-in lockfile.

```sh
git clone https://github.com/Dokpamo/Promlive.git
cd Promlive
npm ci
npm run web
```

Open [127.0.0.1:5178](http://127.0.0.1:5178). This is a local development preview. Each browser origin and native app keeps its own data; clearing browser storage removes its local workspace.

```sh
npm run verify  # TypeScript + tests + production web build
```

On **2026-10-09**, the public application baseline `d4054e7` passed TypeScript, **540 tests across 64 files**, and the web build. CI is configured for Node.js 22 and 24. Native build and runtime evidence is tracked separately; Windows native execution has not been verified. [Setup by platform](docs/GETTING_STARTED.md) · [Verification scope](docs/PRODUCT_STATUS.md#verification).

## Engineering

React 19 · React Native 0.81 · TypeScript · SQLite / IndexedDB

The UI uses shared commands behind separate desktop and mobile shells. Storage adapters implement explicit contracts. Collection metadata and message bodies load in bounded windows instead of loading an entire story into the view.

- [Architecture and data boundaries](docs/ARCHITECTURE.md)
- [Source and test map](docs/FEATURE_MAP.md)
- [Performance measurements and their limits](docs/performance/variable-message-matrix.md)
- [Development priorities](docs/ROADMAP.md)
- [Documentation index](docs/README.md)

## Contributing and project status

Read the [contribution guide](CONTRIBUTING.md) before changing storage, platform code, or the UI. Please use synthetic examples when reporting a problem; never include API keys, private conversations, or character assets you cannot share.

This repository does not currently declare a project-wide license. Public visibility does not establish a general reuse license. Dependency notices are in [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) and [docs/LICENSES.md](docs/LICENSES.md).

Questions: [contact@promlive.com](mailto:contact@promlive.com).
