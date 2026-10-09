# Packaging status / 배포 준비 상태

Checked 2026-10-09. **No public installer is being published with this documentation update.** The files found locally cannot currently be presented as one verified, reproducible release of the public source.

| Platform | What was found | What remains before publishing |
|---|---|---|
| macOS | A running native development app with an x86_64/arm64 executable. `codesign` reports an ad-hoc signature and no Team Identifier. Its JavaScript bundle was built on 2026-10-07 and includes local development work. | Review and publish the exact application source, rebuild it, record checksums and a clean-machine smoke test, then choose a clearly labelled development distribution or signed/notarized release. This existing build is not a notarized public installer. |
| Android | Existing Debug and Release APKs dated 2026-10-02 and 2026-10-04. The checked-in Release configuration uses debug signing. APK output metadata has no source-commit provenance. | Rebuild from the chosen published source, validate install/launch/storage/keyboard behavior on Android, identify signing and architecture scope, and publish the corresponding checksum. An old APK's filename or timestamp does not establish its source revision. |
| Windows | Native source project and previous JavaScript bundle evidence; no `.exe`, `.msix`, or `.appx` distribution found in the Windows project. | Build and run on Windows, validate the SQLite/native host and UI, and produce a tested installer from the same source snapshot. |
| iOS | Historical Simulator build evidence. | Physical-device signing and distribution have not been established; no App Store availability is claimed. |

The local application checkout is ahead of public `main` and also has uncommitted feature work. Publishing that work requires a separate application review; this documentation change deliberately does not bundle those changes into a release.

## A concrete development-release gate

1. Choose and publish an exact application source commit, including required native modules and migrations.
2. Build each target from that commit in a clean, identified environment.
3. Exercise creation, local persistence, restart, input/keyboard behavior, and the advertised AI path on that platform. Record unsupported features.
4. Check distributed assets and dependency notices; use synthetic content and exclude local data or credentials.
5. Attach only verified artifacts to a prerelease, with architecture, signing status, build commands, checksums, and known limitations.

A platform without a working artifact should have no download button. A development prerelease must not be described as a production launch.

## 한국어 요약

맥 개발 앱은 실제로 실행되지만 미공개 코드가 포함되어 있고 배포용 서명 상태가 아닙니다. 기존 Android APK는 어느 소스 커밋으로 만들었는지 확인할 기록이 없으며, Windows 설치 파일은 없습니다. 먼저 배포할 소스를 확정하고 플랫폼별로 다시 빌드·실행 확인을 한 뒤 검증된 파일만 개발용 릴리스에 넣어야 합니다. 이번 문서 변경에서 앱 변경 전체를 임의로 커밋하거나 설치 파일을 공개하지 않았습니다.
