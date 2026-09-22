# Native blur compatibility

`@sbaiahmed1/react-native-blur` is pinned to 6.0.2. `npm install` applies the
checked-in patch with `patch-package`.

The Android progressive blur hosts the floating header controls. The patch:

- Treats the internal blur renderer separately from Fabric-managed children, so
  it remains behind buttons and does not disturb mounting/removal indices.
- Lets touches pass through the decorative surface while its buttons stay
  interactive.
- Captures the current window when there is no React root ancestor. Settings
  pages live in native modal windows and must blur their own scrolling content.

When updating the package, verify opening/closing settings repeatedly, header
button presses, scrolling beneath the header, and both appearance modes. Limit
regenerated patches to source files so local Gradle outputs are excluded:

```sh
npx patch-package @sbaiahmed1/react-native-blur --include 'android/src/.*'
```
