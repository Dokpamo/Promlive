# Native compatibility

`react-native-macos` 0.81.9 has a separate, macOS-only patch:

- Render images with `RCTUIView` and a dedicated image sublayer instead of
  `NSImageView` or AppKit's managed backing-layer contents. The backing layer
  could add a crossfade after a recycled view was remounted, blending the old
  icon/photo into its replacement for about 0.23 seconds. The owned image/tint
  layers disable implicit content and geometry animations; React animations on
  the containing views still work. Preserve decoded CGImage pixels across
  display invalidation and clear template tint when recycling an icon as a photo.
  The legacy image view maps resize modes explicitly and uses normal view
  accessibility instead of an NSImageCell.
- Follow the containing window's backing scale when it moves between monitors.
  Force Fabric layout on a density change even when the point dimensions match,
  so image requests and pixel rounding use the new display.
- Publish content-view dimensions (excluding window chrome) and current window
  scale to JavaScript, including when only the backing properties change.

After upgrading RN macOS, verify navigation between library, chat and settings,
then move the same window between 1x and 2x displays in both directions. Check
image sharpness, card proportions, scroll position, and an unsent chat draft.
The shared tab icon recalculates its pixel-aligned strips when density changes.
Also verify Hangul followed by a space and overflowing drafts in the native app.

For image flashing, record the native app while switching settings → chat →
library, then inspect the first visible frames. Settled screenshots miss the
brief stale-icon and gray-photo crossfade. Compare both directions between
1x/2x displays; normalize the recording's pixel scale and log logical window
bounds so capture resizing is not mistaken for an app layout change.

## Native blur

`@sbaiahmed1/react-native-blur` is pinned to 6.0.2. `npm install` applies the
checked-in patch with `patch-package`.

Screen edges now use `EdgeTint`, a translucent layer of the page background.
They do not mount a native blur view or capture another window. The page-local
capture experiment has been removed; the existing package compatibility patch
is retained for any future use of the dependency.

The Android progressive blur compatibility patch:

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
