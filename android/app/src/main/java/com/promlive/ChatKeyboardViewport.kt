package com.promlive

import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.scroll.ReactScrollView
import kotlin.math.roundToInt

/** Resize only the message viewport on the same IME frame as the composer. */
internal class ChatKeyboardViewport(private val owner: ViewGroup) {
  private var scroll: ReactScrollView? = null
  private var previousHeight = 0

  fun update(coveredHeight: Int, safeBottom: Float) {
    val view = scroll?.takeIf { it.isAttachedToWindow } ?: findScroll(owner)?.also {
      scroll = it
      previousHeight = it.height
    } ?: return
    if (owner.height <= 0 || view.width <= 0) return
    val height = (owner.height - maxOf(0f, coveredHeight - safeBottom)).roundToInt().coerceAtLeast(0)
    if (view.height == height && previousHeight == height) return
    val contentHeight = view.getChildAt(0)?.height ?: 0
    val oldHeight = previousHeight.takeIf { it > 0 } ?: view.height
    val offset = chatKeyboardScrollOffset(view.scrollY, contentHeight, oldHeight, height,
      (80 * owner.resources.displayMetrics.density).roundToInt())
    previousHeight = height
    // Fabric's full-height frame remains stable. Native layout owns the visible
    // viewport, so neither a JS commit nor scrollToEnd is needed on IME frames.
    view.measure(View.MeasureSpec.makeMeasureSpec(view.width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
    view.layout(view.left, view.top, view.right, view.top + height)
    view.scrollTo(view.scrollX, offset)
  }

  fun reset() { scroll = null; previousHeight = 0 }

  private fun findScroll(view: View): ReactScrollView? {
    if (view is ReactScrollView) return view
    if (view is ViewGroup) for (i in 0 until view.childCount) findScroll(view.getChildAt(i))?.let { return it }
    return null
  }
}

/** Keep the distance from the end, or preserve a reader's position in history. */
internal fun chatKeyboardScrollOffset(offset: Int, content: Int, previousHeight: Int, height: Int, endThreshold: Int): Int {
  val before = maxOf(0, content - previousHeight)
  val after = maxOf(0, content - height)
  val next = if (before - offset <= endThreshold) offset + after - before else offset
  return next.coerceIn(0, after)
}
