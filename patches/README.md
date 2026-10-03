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
- Keep a non-scrolling text editor's clip viewport at the document origin,
  preserving its size. AppKit can give the document a negative origin; pinning
  it to zero or collapsing its bounds hides the first line while a composer
  grows. Update scrollbar visibility when scrolling is enabled/disabled, and
  reveal the caret after the composer reaches its height limit.
- Vertically center single-line text (including secure fields) inside the
  padded content rect using the actual font metrics. Drawing and editing use
  the same rect so focusing a field does not move its baseline.
- Keep single-line field cells scrollable without wrapping. Long API keys,
  search queries and names follow the caret horizontally inside the field.
- Back secure inputs with `NSSecureTextField`, sharing the regular field's React
  implementation with a secure cell. AppKit rejects a secure field editor whose
  delegate only inherits from `NSTextField`; editing can then lose React's
  focus/change/blur events and leave a detached editor when a settings column
  resizes. Keep the secure header's properties aligned with `RCTUITextField`.
  Preserve the text-field accessibility role and attributed text when toggling
  visibility, and apply the foreground color to masking glyphs and the caret.

After upgrading RN macOS, verify navigation between library, chat and settings,
then move the same window between 1x and 2x displays in both directions. Check
image sharpness, card proportions, scroll position, and an unsent chat draft.
The shared tab icon recalculates its pixel-aligned strips when density changes.
Also verify Hangul followed by a space and overflowing drafts in the native app.
Record one → four lines and back to one, checking every frame for a missing
first line. Continue past seven lines to verify caret visibility and internal
scrolling, then shrink again and check that the scrollbar disappears. Check
single-line setting fields and search both before and after focus, including
caret movement through values wider than the field and secure-key visibility.
Focus an API field, open a provider/model page to its right, then close that page.
Check that focus clears, the field stays vertically centered, and a disposable
test value survives both transitions and visibility toggles. Verify this in the
native macOS app; web input tests cannot detect AppKit delegate failures.

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
