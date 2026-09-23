package com.promlive

import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.EditText
import android.widget.ScrollView
import kotlin.math.abs
import kotlin.math.min

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
  )
  private var previous: Frame? = null
  private var downX = 0f
  private var downY = 0f
  private var touchingEditor = false
  private var userScrolling = false
  private val slop = ViewConfiguration.get(host.context).scaledTouchSlop
  private val location = IntArray(2)
  private val rootLocation = IntArray(2)

  fun reset() { previous = null; touchingEditor = false; userScrolling = false }

  fun touch(event: MotionEvent) {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        val editor = host.findFocus() as? EditText
        editor?.getLocationOnScreen(location)
        touchingEditor = editor != null && event.rawX >= location[0] && event.rawX < location[0] + editor.width &&
          event.rawY >= location[1] && event.rawY < location[1] + editor.height
        downX = event.rawX; downY = event.rawY; userScrolling = false
      }
      MotionEvent.ACTION_MOVE -> if (touchingEditor && (abs(event.rawX - downX) > slop || abs(event.rawY - downY) > slop)) userScrolling = true
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
    return Frame(editor, scroller, scroller?.scrollY ?: editor.scrollY, scroller?.height ?: editor.height, editor.width, ime,
      editor.selectionStart, editor.selectionEnd, editor.length())
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
    val resized = current.height != old.height || editor.width != old.width
    val keyboardChanged = ime != old.ime
    if (!resized && !keyboardChanged && !selectionChanged && !textChanged) { capture(ime); return }

    // A drag/fling belongs to the reader. Typing or moving the cursor resumes following it.
    if ((selectionChanged || textChanged) && !touchingEditor) userScrolling = false
    if (userScrolling) { capture(ime); return }

    val offset = (if (editor.selectionStart != old.start && editor.selectionEnd == old.end) editor.selectionStart else editor.selectionEnd)
      .coerceIn(0, editor.length())
    val line = layout.getLineForOffset(offset)
    editor.getLocationOnScreen(location)
    editor.rootView.getLocationOnScreen(rootLocation)
    val keyboardTop = rootLocation[1] + editor.rootView.height - ime
    val scroller = current.scroller
    val viewport = if (scroller == null) {
      maxOf(1, min(editor.height, keyboardTop - location[1]) - editor.totalPaddingTop - editor.totalPaddingBottom)
    } else {
      val editorTop = location[1]
      scroller.getLocationOnScreen(location)
      // These spacers belong to the scroll content, so reading can pass behind
      // the floating buttons. Only the active caret must stay in the clear area.
      val topInset = maxOf(0, editorTop - location[1] + scroller.scrollY)
      val bottomInset = maxOf(0, (scroller.getChildAt(0)?.height ?: 0) - topInset - editor.height)
      composerCaretViewport(scroller.height, keyboardTop - location[1], topInset + editor.totalPaddingTop, bottomInset + editor.totalPaddingBottom)
    }
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
