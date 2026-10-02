package com.promlive

import org.junit.Assert.assertEquals
import org.junit.Test

class ChatKeyboardViewportTest {
  @Test fun lastMessageFollowsEveryKeyboardFrameIncludingReversal() {
    var height = 800
    var offset = 600
    for (next in listOf(780, 710, 550, 500, 560, 730, 800)) {
      offset = chatKeyboardScrollOffset(offset, 1400, height, next, 80)
      assertEquals(1400 - next, offset)
      height = next
    }
  }

  @Test fun readingHistoryDoesNotJumpToTheEndWhenFocusing() {
    assertEquals(150, chatKeyboardScrollOffset(150, 1400, 800, 500, 80))
    assertEquals(150, chatKeyboardScrollOffset(150, 1400, 500, 800, 80))
  }

  @Test fun shortConversationsOnlyMoveWhenTheyWouldBeCovered() {
    assertEquals(0, chatKeyboardScrollOffset(0, 620, 800, 700, 80))
    assertEquals(120, chatKeyboardScrollOffset(0, 620, 700, 500, 80))
    assertEquals(0, chatKeyboardScrollOffset(120, 620, 500, 800, 80))
    assertEquals(0, chatKeyboardScrollOffset(0, 0, 800, 500, 80))
  }

  @Test fun nearEndSpacingIsPreservedAndHidingClampsWithoutBlankSpace() {
    assertEquals(860, chatKeyboardScrollOffset(560, 1400, 800, 500, 80))
    assertEquals(560, chatKeyboardScrollOffset(860, 1400, 500, 800, 80))
    assertEquals(0, chatKeyboardScrollOffset(100, 600, 300, 800, 80))
  }
}
