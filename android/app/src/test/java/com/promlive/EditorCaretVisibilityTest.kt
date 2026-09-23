package com.promlive

import org.junit.Assert.assertEquals
import org.junit.Test

class EditorCaretVisibilityTest {
  @Test fun morphKeepsTheCaretOnOneContinuousPathThroughResizeAndReversal() {
    val anchor = EditorScrollAnchor(600, 400, 970, 1000, true)
    assertEquals(listOf(600, 550, 400, 200, 400, 550, 600),
      listOf(400, 450, 600, 800, 600, 450, 400).map { anchor.offset(it, 2000 - it) })
  }
  @Test fun morphPreservesReadingWhenTheCaretIsOffscreen() {
    val anchor = EditorScrollAnchor(300, 400, 1450, 1480, true)
    assertEquals(300, anchor.offset(650, 1000))
    assertEquals(300, anchor.offset(180, 1000))
  }
  @Test fun morphDoesNotFollowTheCaretAfterAManualScroll() {
    assertEquals(300, EditorScrollAnchor(300, 400, 600, 630, false).offset(650, 1000))
  }
  @Test fun morphClampsOnlyAtTheActualContentEnds() {
    val anchor = EditorScrollAnchor(120, 400, 490, 520, true)
    assertEquals(0, anchor.offset(700, 0))
    assertEquals(320, anchor.offset(200, 600))
  }
  @Test fun visibleCaretKeepsReadingPosition() {
    assertEquals(120, caretScrollOffset(120, 160, 190, 400, 1000, true))
  }
  @Test fun coveredCaretMovesOnlyTheNecessaryDistance() {
    assertEquals(410, caretScrollOffset(120, 780, 810, 400, 1000, true))
  }
  @Test fun lastLineIsRevealedWithoutCenteringOrScrollingPastTheContent() {
    assertEquals(600, caretScrollOffset(0, 970, 1000, 400, 600, true))
  }
  @Test fun movingSelectionToAnEarlierLineOnlyRevealsThatLine() {
    assertEquals(160, caretScrollOffset(500, 160, 190, 400, 1000, true))
  }
  @Test fun keyboardHidingDoesNotFollowAnOffscreenCaret() {
    assertEquals(300, caretScrollOffset(300, 1450, 1480, 700, 1000, false))
  }
  @Test fun keyboardHidingRemovesUnusedScrollSpaceWhenTheWholeTextFits() {
    assertEquals(0, caretScrollOffset(300, 50, 80, 700, 0, false))
  }
  @Test fun composerCaretClearsBothFloatingControlsWhileItsScrollerUsesTheFullHeight() {
    val viewport = composerCaretViewport(800, 500, 84, 70)
    assertEquals(346, viewport)
    assertEquals(654, caretScrollOffset(0, 970, 1000, viewport, 1000 - viewport, true))
  }
  @Test fun composerKeyboardHidingKeepsTheReadingPositionWhenItStillFits() {
    val viewport = composerCaretViewport(800, 900, 84, 70)
    assertEquals(646, viewport)
    assertEquals(120, caretScrollOffset(120, 970, 1000, viewport, 1000 - viewport, false))
  }
  @Test fun selectingTextBehindTheHeaderRevealsOnlyThatLine() {
    val viewport = composerCaretViewport(800, 500, 84, 70)
    assertEquals(460, caretScrollOffset(500, 460, 490, viewport, 1000 - viewport, true))
  }
}
