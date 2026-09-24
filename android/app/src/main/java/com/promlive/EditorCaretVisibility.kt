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
    val scrolling: Boolean,
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
  private var restoredReading: RestoredEditorReading? = null
  private var finishRestore = false
  val isTransitioning: Boolean get() = transitionActive || anchor != null || restoredReading != null

  fun reset() { previous = null; touchingEditor = false; userScrolling = false; anchor = null; restoredReading = null }

  fun restoreScroll(offset: Int?, revealCaret: Boolean) {
    if (offset == null) {
      // Focus can finish transferring in this same mount transaction. Apply to
      // its final layout once before letting normal editing own the scroll again.
      finishRestore = true
    } else {
      restoredReading = RestoredEditorReading(offset, revealCaret)
      finishRestore = false
      anchor = null
    }
  }

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
        if (touchingEditor) restoredReading = null
        downX = event.rawX; downY = event.rawY; userScrolling = false
      }
      MotionEvent.ACTION_MOVE -> if (touchingEditor && (abs(event.rawX - downX) > slop || abs(event.rawY - downY) > slop)) {
        userScrolling = true
        // A new editing/reading gesture can interrupt the morph immediately.
        transitionActive = false
        anchor = null
        restoredReading = null
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
    return Frame(editor, scroller, scroller !is ReactScrollView || scroller.scrollEnabled,
      scroller?.scrollY ?: editor.scrollY, scroller?.height ?: editor.height, editor.width, ime,
      editor.selectionStart, editor.selectionEnd, editor.length(), viewport(editor, scroller, ime),
      layout?.getLineTop(line) ?: 0, layout?.getLineBottom(line) ?: 0)
  }

  private fun viewport(editor: EditText, scroller: ScrollView?, ime: Int, finalLayout: Boolean = false): Int {
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
    return composerCaretViewport(scroller.height, if (finalLayout) scroller.height else keyboardTop - location[1], topInset + editor.totalPaddingTop, bottomInset + editor.totalPaddingBottom)
  }

  /** Runs after TextView's pre-draw auto-scroll, before any pixels are drawn. */
  fun beforeDraw(ime: Int) {
    // A new editor receives its restoration prop before Android gives it focus.
    val editor = host.findFocus() as? EditText ?: run {
      if (restoredReading == null) reset() else previous = null
      return
    }
    val layout = editor.layout ?: return
    val outer = editorScroller(editor)
    // Android scrolls EditText to the new line before JS can grow its viewport.
    // A composer that fits its content must stay at the top during that frame.
    // Once scrolling is enabled, only the outer viewport owns the scroll offset.
    if (outer != null && editor.scrollY != 0) editor.scrollTo(editor.scrollX, 0)
    if (outer is ReactScrollView && !outer.scrollEnabled) {
      outer.abortAnimation()
      outer.flingAnimator.cancel()
      if (outer.scrollY != 0) outer.scrollTo(outer.scrollX, 0)
      previous = frame(editor, ime)
      if (finishRestore) restoredReading = null
      return
    }
    val current = frame(editor, ime)
    val old = previous
    val selectionChanged = old != null && (editor.selectionStart != old.start || editor.selectionEnd != old.end)
    val textChanged = old != null && editor.length() != old.length
    if (restoredReading != null && old?.editor === editor && (textChanged || (finishRestore && selectionChanged))) {
      // New input interrupts a pending handoff, including while the overlay exits.
      restoredReading = null
      userScrolling = false
    }
    restoredReading?.let { reading ->
      if (outer == null) return@let
      (outer as? ReactScrollView)?.let { it.abortAnimation(); it.flingAnimator.cancel() }
      val maxScroll = maxOf(0, (outer.getChildAt(0)?.height ?: 0) - outer.height)
      // The sheet is translating from below the screen. Its on-screen keyboard
      // overlap must not shift the text inside the already finished layout.
      val next = reading.offset(current.caretTop, current.caretBottom, viewport(editor, outer, ime, finalLayout = true), maxScroll)
      if (next != outer.scrollY) outer.scrollTo(outer.scrollX, next)
      previous = frame(editor, ime)
      userScrolling = true
      if (finishRestore) restoredReading = null
      return
    }
    if (old == null || old.editor !== editor || old.scroller !== current.scroller) { previous = current; return }
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
    val startedScrolling = current.scrolling && !old.scrolling
    if (!resized && !keyboardChanged && !selectionChanged && !textChanged && !startedScrolling) { capture(ime); return }

    // A drag/fling belongs to the reader. Typing or moving the cursor resumes following it.
    if ((selectionChanged || textChanged) && !touchingEditor) userScrolling = false
    if (userScrolling) { capture(ime); return }

    val offset = (if (editor.selectionStart != old.start && editor.selectionEnd == old.end) editor.selectionStart else editor.selectionEnd)
      .coerceIn(0, editor.length())
    val line = layout.getLineForOffset(offset)
    val viewport = current.viewport
    val maxScroll = maxOf(0, layout.height - viewport)
    val baseline = if (textChanged) current.scroll else old.scroll
    val reveal = selectionChanged || textChanged || startedScrolling || ime > old.ime || current.height < old.height || editor.width != old.width
    val next = caretScrollOffset(baseline, layout.getLineTop(line), layout.getLineBottom(line), viewport, maxScroll, reveal)
    if (next != current.scroll) {
      if (scroller == null) editor.scrollTo(editor.scrollX, next)
      else scroller.scrollTo(scroller.scrollX, next)
    }
    previous = frame(editor, ime)
  }
}

/** Explicit handoff beats focus auto-scroll; an edited caret is revealed minimally. */
internal class RestoredEditorReading(private val requested: Int, private val revealCaret: Boolean) {
  fun offset(top: Int, bottom: Int, viewport: Int, maxScroll: Int): Int =
    caretScrollOffset(requested, top, bottom, viewport, maxScroll, revealCaret)
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
