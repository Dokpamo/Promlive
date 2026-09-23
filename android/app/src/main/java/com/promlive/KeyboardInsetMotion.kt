package com.promlive

/** Keep layout targets from overtaking the keyboard's displayed animation frames. */
internal class KeyboardInsetMotion(
  private val publish: (Int) -> Unit,
) {
  private val animations = mutableSetOf<Any>()

  fun layout(height: Int, followsAnimation: Boolean) {
    // The focused window can receive the *target* several frames before
    // onPrepare. Waiting one frame is still a race. Only animation progress
    // owns its displayed height; layouts are for windows without animation.
    if (!followsAnimation && animations.isEmpty()) publish(height)
  }

  fun prepare(animation: Any) {
    animations.add(animation)
  }

  fun progress(height: Int) {
    publish(height)
  }

  fun end(animation: Any) {
    animations.remove(animation)
    // onProgress already delivered the displayed final frame. Root insets can
    // belong to a replacement animation that has not reached onPrepare yet.
  }

  fun reset() {
    animations.clear()
  }
}
