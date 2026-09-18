package com.storyloom

import android.os.Build
import android.view.RoundedCorner
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager

class ScreenCornersModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ScreenCorners"

  @ReactMethod
  fun getCorners(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(null)
        return@runOnUiThread
      }
      val activity = reactApplicationContext.currentActivity
      val insets = activity?.window?.decorView?.rootWindowInsets
      if (activity == null || insets == null) {
        promise.resolve(null)
        return@runOnUiThread
      }
      val density = activity.resources.displayMetrics.density
      val result = Arguments.createMap()
      for ((name, position) in listOf(
        "topLeft" to RoundedCorner.POSITION_TOP_LEFT,
        "topRight" to RoundedCorner.POSITION_TOP_RIGHT,
        "bottomLeft" to RoundedCorner.POSITION_BOTTOM_LEFT,
        "bottomRight" to RoundedCorner.POSITION_BOTTOM_RIGHT,
      )) {
        val corner = insets.getRoundedCorner(position)
        if (corner == null) result.putNull(name)
        else result.putDouble(name, (corner.radius / density).toDouble())
      }
      promise.resolve(result)
    }
  }
}

class ScreenCornersPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(ScreenCornersModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
