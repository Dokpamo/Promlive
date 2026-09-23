package com.promlive

/** Native IME translation uses the same laid-out frame as the JS-driven surface morph. */
internal data class ComposerDockGeometry(val compactHeight: Float, val expandedHeight: Float, val footer: Boolean) {
  fun fraction(displayedHeight: Int): Float {
    val range = expandedHeight - compactHeight
    val progress = if (range == 0f) 1f else ((displayedHeight - compactHeight) / range).coerceIn(0f, 1f)
    return if (footer) progress else 1f - progress
  }
}
