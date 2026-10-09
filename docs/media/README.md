# Screenshot provenance / 화면 출처

Captured **2026-10-09** from the actual **Promlive native macOS development app**. These are normal application screens, not design mockups. They show a newer local build than the public application baseline.

| File | Actual workflow shown |
|---|---|
| `library-macos-dev.png` | Original card found through Library search, with its detail pane open |
| `world-macos-dev.png` | World editor showing nested setting, place, character, and rule folders |
| `character-macos-dev.png` | Character folder showing the profile and prompt |

## Sample content

**빛의 기록실 / The Lantern Archive** is a fictional sample created for these captures. Its records keeper, 나래, and the archive setting were created through the app's normal conversational authoring UI. No imported character card or personal conversation is used. Search filters keep unrelated local cards and conversations out of the captures.

The geometric cover was authored specifically for this task in [lantern-archive.svg](lantern-archive.svg), rendered to PNG, attached through the app's file picker, and associated with the card and setting through the normal UI. It does not use third-party character artwork.

The capture session used the app's existing ChatGPT connection. **It did not use Claude for runtime generation.** The screenshots are interface evidence, not proof of compatibility with every provider.

## Build distinction

- Public application baseline: `d4054e70eed9b42caa3118a6bee75d1fb2210867`.
- Captured local development source: `d6ac15f` plus uncommitted application changes. Those changes are not included in this documentation publication.
- Captured native app's JS bundle SHA-256: `47ae912c313bfdff4246cd4c2ce9894c5fcc30ee0c4d61953cc3188ee4e9be35`.
- The app runs locally on macOS and has an ad-hoc signature. This is not a signed/notarized public release.
- Screenshots are unmodified app-window captures. The original files contain no private account view, API key, imported artwork, or unrelated chat content.

Required context when reusing a capture: **“Actual macOS development build. AI authoring and world-state features are not yet included in the public application baseline.”**

한국어 표기: **“macOS 개발 빌드의 실제 화면. AI 제작·세계관 기능은 아직 공개 main에 미포함.”**
