package com.promlive

import org.junit.Assert.assertEquals
import org.junit.Test

class ComposerDockGeometryTest {
  @Test fun dockWaitsForTheDisplayedFrameInsteadOfTheNextAnimationValue() {
    val geometry = ComposerDockGeometry(200f, 800f, false)
    assertEquals(0f, geometry.fraction(800), 0.001f)
    assertEquals(0.25f, geometry.fraction(650), 0.001f)
    assertEquals(1f, geometry.fraction(200), 0.001f)
  }
  @Test fun footerAndSurfaceShareTheSameFrame() {
    val surface = ComposerDockGeometry(200f, 800f, false)
    val footer = ComposerDockGeometry(200f, 800f, true)
    for (height in listOf(150, 200, 350, 650, 800, 820)) {
      assertEquals(1f, surface.fraction(height) + footer.fraction(height), 0.001f)
    }
  }
  @Test fun shortWindowsCanHaveAnExpandedSurfaceShorterThanTheCompactComposer() {
    val geometry = ComposerDockGeometry(200f, 120f, false)
    assertEquals(1f, geometry.fraction(200), 0.001f)
    assertEquals(0.5f, geometry.fraction(160), 0.001f)
    assertEquals(0f, geometry.fraction(120), 0.001f)
  }
}
