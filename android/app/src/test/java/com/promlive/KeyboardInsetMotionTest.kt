package com.promlive

import org.junit.Assert.assertEquals
import org.junit.Test

class KeyboardInsetMotionTest {
  private class Frames {
    val heights = mutableListOf<Int>()
    val motion = KeyboardInsetMotion { heights.add(it) }
  }

  @Test fun anEarlyFinalLayoutCannotMoveThePopupEvenWhenPrepareIsSeveralFramesLate() {
    val f = Frames()
    val animation = Any()
    // The dialog sent this target 50 ms before onPrepare in the failing trace.
    repeat(4) { f.motion.layout(883, followsAnimation = true) }
    assertEquals(emptyList<Int>(), f.heights)
    f.motion.prepare(animation)
    listOf(0, 38, 193, 380, 663, 883).forEach { f.motion.progress(it) }
    f.motion.layout(883, followsAnimation = true)
    f.motion.end(animation)
    assertEquals(listOf(0, 38, 193, 380, 663, 883), f.heights)
  }

  @Test fun earlyHideLayoutDoesNotDropThePopupBeforeTheKeyboard() {
    val f = Frames()
    val animation = Any()
    f.motion.progress(883)
    repeat(4) { f.motion.layout(0, followsAnimation = true) }
    assertEquals(listOf(883), f.heights)
    f.motion.prepare(animation)
    f.motion.progress(700)
    f.motion.progress(300)
    f.motion.progress(0)
    f.motion.end(animation)
    assertEquals(listOf(883, 700, 300, 0), f.heights)
  }

  @Test fun anInterruptedAnimationCannotPublishOverItsReplacement() {
    val f = Frames()
    val opening = Any()
    val closing = Any()
    f.motion.prepare(opening)
    f.motion.progress(400)
    f.motion.prepare(closing)
    f.motion.end(opening)
    f.motion.layout(0, followsAnimation = true)
    f.motion.progress(200)
    f.motion.progress(0)
    f.motion.end(closing)
    assertEquals(listOf(400, 200, 0), f.heights)
  }

  @Test fun endingAnAnimationDoesNotApplyTheNextAnimationsTargetEarly() {
    val f = Frames()
    val opening = Any()
    f.motion.prepare(opening)
    f.motion.progress(883)
    f.motion.layout(0, followsAnimation = true)
    f.motion.end(opening)
    assertEquals(listOf(883), f.heights)
    val closing = Any()
    f.motion.prepare(closing)
    f.motion.progress(700)
    assertEquals(listOf(883, 700), f.heights)
  }

  @Test fun unfocusedWindowsStillReceiveImmediateLayoutUpdates() {
    val f = Frames()
    // Background windows have no keyboard animation to follow.
    f.motion.layout(883, followsAnimation = false)
    f.motion.layout(700, followsAnimation = false)
    f.motion.layout(0, followsAnimation = false)
    assertEquals(listOf(883, 700, 0), f.heights)
  }

  @Test fun disabledAnimationsStillWaitForTheDisplayedFinalFrame() {
    val f = Frames()
    f.motion.layout(883, followsAnimation = true)
    assertEquals(emptyList<Int>(), f.heights)
    val animation = Any()
    f.motion.prepare(animation)
    f.motion.progress(0)
    f.motion.progress(883)
    f.motion.end(animation)
    assertEquals(listOf(0, 883), f.heights)
  }

  @Test fun losingWindowFocusDoesNotOverrideAnAnimationAlreadyInFlight() {
    val f = Frames()
    val animation = Any()
    f.motion.prepare(animation)
    f.motion.progress(400)
    f.motion.layout(883, followsAnimation = false)
    assertEquals(listOf(400), f.heights)
    f.motion.progress(883)
    f.motion.end(animation)
    f.motion.layout(0, followsAnimation = false)
    assertEquals(listOf(400, 883, 0), f.heights)
  }

  @Test fun detachingClearsAnimationsBeforeTheNextAttachment() {
    val f = Frames()
    f.motion.prepare(Any())
    f.motion.reset()
    f.motion.layout(0, followsAnimation = false)
    assertEquals(listOf(0), f.heights)
  }
}
