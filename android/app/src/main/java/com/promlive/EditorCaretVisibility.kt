package com.promlive

import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.EditText
import android.widget.ScrollView
import com.facebook.react.views.scroll.ReactScrollView
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt

/** Preserve the reading position; only reveal the active insertion/selection end. */
internal class EditorCaretVisibility(private val host: View) {
  private data class Frame(
    val editor: EditText,
    val scroller: ScrollView?,
    val scroll: Int,
    val height: Int,
    val width: Int,
    val ime: Int,
    val start: Int,
    val end: Int,
    val length: Int,
    val viewport: Int,
    val caretTop: Int,
    val caretBottom: Int,
  )
  private var previous: Frame? = null
  private var downX = 0f
  private var downY = 0f
  private var touchingEditor = false
  private var userScrolling = false
  private val slop = ViewConfiguration.get(host.context).scaledTouchSlop
  private val location = IntArray(2)
  private val rootLocation = IntArray(2)
  private var transitionActive = false
  private var anchor: EditorScrollAnchor? = null
  val isTransitioning: Boolean get() = transitionActive || anchor != null

  fun reset() { previous = null; touchingEditor = false; userScrolling = false; anchor = null }

  fun setTransitioning(active: Boolean, ime: Int) {
    transitionActive = active
    if (!active) return // Apply the anchor to the final layout before releasing it.
    val editor = host.findFocus() as? EditText ?: return
    val source = previous?.takeIf { it.editor === editor } ?: frame(editor, ime)
    anchor = EditorScrollAnchor(source.scroll, source.viewport, source.caretTop, source.caretBottom, !userScrolling)
    previous = source
  }

  fun touch(event: MotionEvent) {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        val editor = host.findFocus() as? EditText
        editor?.getLocationOnScreen(location)
        touchingEditor = editor != null && event.rawX >= location[0] && event.rawX < location[0] + editor.width &&
          event.rawY >= location[1] && event.rawY < location[1] + editor.height
        downX = event.rawX; downY = event.rawY; userScrolling = false
      }
      MotionEvent.ACTION_MOVE -> if (touchingEditor && (abs(event.rawX - downX) > slop || abs(event.rawY - downY) > slop)) {
        userScrolling = true
        // A new editing/reading gesture can interrupt the morph immediately.
        transitionActive = false
        anchor = null
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> touchingEditor = false
    }
  }

  fun capture(ime: Int) {
    val editor = host.findFocus() as? EditText ?: return
    previous = frame(editor, ime)
  }

  private fun editorScroller(editor: EditText): ScrollView? {
    var ancestor = editor.parent
    while (ancestor is View && ancestor !== host) {
      if (ancestor is ScrollView && ancestor.getTag(com.facebook.react.R.id.view_tag_native_id) == "promlive-composer-scroll") return ancestor
      ancestor = ancestor.parent
    }
    return null
  }

  private fun frame(editor: EditText, ime: Int): Frame {
    val scroller = editorScroller(editor)
    val layout = editor.layout
    val line = layout?.getLineForOffset(editor.selectionEnd.coerceIn(0, editor.length())) ?: 0
    return Frame(editor, scroller, scroller?.scrollY ?: editor.scrollY, scroller?.height ?: editor.height, editor.width, ime,
      editor.selectionStart, editor.selectionEnd, editor.length(), viewport(editor, scroller, ime),
      layout?.getLineTop(line) ?: 0, layout?.getLineBottom(line) ?: 0)
  }

  private fun viewport(editor: EditText, scroller: ScrollView?, ime: Int): Int {
    editor.getLocationOnScreen(location)
    editor.rootView.getLocationOnScreen(rootLocation)
    val keyboardTop = rootLocation[1] + editor.rootView.height - ime
    if (scroller == null) return maxOf(1, min(editor.height, keyboardTop - location[1]) - editor.totalPaddingTop - editor.totalPaddingBottom)
    scroller.getLocationOnScreen(location)
    // Read the scrolling inset in content coordinates. Subtracting two rounded
    // screen positions adds a pixel of noise while the dock is translating.
    var contentTop = editor.top
    var ancestor = editor.parent
    while (ancestor is View && ancestor !== scroller) {
      contentTop += ancestor.top - ancestor.scrollY
      ancestor = ancestor.parent
    }
    val topInset = maxOf(0, contentTop)
    val bottomInset = maxOf(0, (scroller.getChildAt(0)?.height ?: 0) - topInset - editor.height)
    return composerCaretViewport(scroller.height, keyboardTop - location[1], topInset + editor.totalPaddingTop, bottomInset + editor.totalPaddingBottom)
  }

  /** Runs after TextView's pre-draw auto-scroll, before any pixels are drawn. */
  fun beforeDraw(ime: Int) {
    val editor = host.findFocus() as? EditText ?: run { reset(); return }
    val layout = editor.layout ?: return
    val current = frame(editor, ime)
    val old = previous
    if (old == null || old.editor !== editor || old.scroller !== current.scroller) { previous = current; return }
    val selectionChanged = editor.selectionStart != old.start || editor.selectionEnd != old.end
    val textChanged = editor.length() != old.length
    val scroller = current.scroller
    if (isTransitioning && scroller != null) {
      if (anchor == null || selectionChanged || textChanged) {
        val baseline = if (selectionChanged || textChanged) current else old
        anchor = EditorScrollAnchor(baseline.scroll, baseline.viewport, current.caretTop, current.caretBottom, !userScrolling)
      }
      // ScrollView starts its own focus/resize smooth-scroll. Cancel that competing
      // animation and derive this frame from the one anchor captured at the start.
      (scroller as? ReactScrollView)?.let { it.abortAnimation(); it.flingAnimator.cancel() }
      if (editor.scrollY != 0) editor.scrollTo(editor.scrollX, 0)
      val next = anchor!!.offset(current.viewport, maxOf(0, layout.height - current.viewport))
      if (next != scroller.scrollY) scroller.scrollTo(scroller.scrollX, next)
      previous = frame(editor, ime)
      if (!transitionActive) anchor = null
      return
    }
    val resized = current.height != old.height || editor.width != old.width
    val keyboardChanged = ime != old.ime
    if (!resized && !keyboardChanged && !selectionChanged && !textChanged) { capture(ime); return }

    // A drag/fling belongs to the reader. Typing or moving the cursor resumes following it.
    if ((selectionChanged || textChanged) && !touchingEditor) userScrolling = false
    if (userScrolling) { capture(ime); return }

    val offset = (if (editor.selectionStart != old.start && editor.selectionEnd == old.end) editor.selectionStart else editor.selectionEnd)
      .coerceIn(0, editor.length())
    val line = layout.getLineForOffset(offset)
    val viewport = current.viewport
    val maxScroll = maxOf(0, layout.height - viewport)
    val baseline = if (textChanged) current.scroll else old.scroll
    val reveal = selectionChanged || textChanged || ime > old.ime || current.height < old.height || editor.width != old.width
    val next = caretScrollOffset(baseline, layout.getLineTop(line), layout.getLineBottom(line), viewport, maxScroll, reveal)
    if (next != current.scroll) {
      if (scroller == null) editor.scrollTo(editor.scrollX, next)
      else scroller.scrollTo(scroller.scrollX, next)
    }
    previous = frame(editor, ime)
  }
}

/** Keep a visible caret at the same relative height; offscreen reading stays at its top line. */
internal class EditorScrollAnchor(scroll: Int, viewport: Int, caretTop: Int, caretBottom: Int, follow: Boolean) {
  private val visible = follow && caretTop >= scroll && caretBottom <= scroll + viewport
  private val point = if (visible) caretBottom else scroll
  private val fraction = if (visible) (point - scroll).toFloat() / maxOf(1, viewport) else 0f

  fun offset(viewport: Int, maxScroll: Int): Int =
    (point - fraction * viewport).roundToInt().coerceIn(0, maxOf(0, maxScroll))
}

internal fun composerCaretViewport(height: Int, keyboardTop: Int, topInset: Int, bottomInset: Int): Int =
  maxOf(1, min(height, keyboardTop) - topInset - bottomInset)

/** No centering or scroll-to-end: move only the covered part of the caret's line. */
internal fun caretScrollOffset(scroll: Int, top: Int, bottom: Int, viewport: Int, maxScroll: Int, reveal: Boolean): Int {
  var next = scroll.coerceIn(0, maxScroll)
  if (reveal) {
    if (bottom - next > viewport) next = bottom - viewport
    else if (top < next) next = top
  }
  return next.coerceIn(0, maxScroll)
}
