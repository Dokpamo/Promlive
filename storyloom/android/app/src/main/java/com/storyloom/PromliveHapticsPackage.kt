package com.storyloom

import android.os.Build
import android.view.HapticFeedbackConstants
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager

class PromliveHapticsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PromliveHaptics"

  @ReactMethod
  fun selection() {
    UiThreadUtil.runOnUiThread {
      val view = reactApplicationContext.currentActivity?.window?.decorView
      if (view == null || !view.isAttachedToWindow || !view.hasWindowFocus()) return@runOnUiThread
      val effect = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        HapticFeedbackConstants.SEGMENT_TICK
      } else {
        HapticFeedbackConstants.CLOCK_TICK
      }
      // No override flags: honor the device's touch feedback settings.
      view.performHapticFeedback(effect)
    }
  }
}

class PromliveHapticsPackage : ReactPackage {
  @Suppress("OVERRIDE_DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PromliveHapticsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
