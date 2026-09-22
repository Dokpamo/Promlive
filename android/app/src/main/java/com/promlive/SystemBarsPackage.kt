package com.promlive

import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.views.modal.ReactModalHostView

class SystemBarsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PromliveSystemBars"

  @ReactMethod
  fun setDarkIcons(dark: Boolean) {
    UiThreadUtil.runOnUiThread {
      val activity = reactApplicationContext.currentActivity ?: return@runOnUiThread
      if (activity.isFinishing || activity.isDestroyed) return@runOnUiThread
      applyStyle(activity.window, dark)
      updateDialogs(activity.window.decorView, dark)
    }
  }

  private fun applyStyle(window: Window, dark: Boolean) {
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightStatusBars = dark
      isAppearanceLightNavigationBars = dark
    }
  }

  private fun updateDialogs(view: View, dark: Boolean) {
    if (view is ReactModalHostView) {
      view.dialog?.window?.let { window ->
        applyStyle(window, dark)
        updateDialogs(window.decorView, dark)
      }
      // Modal children live in the dialog; avoid traversing them twice.
      return
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) updateDialogs(view.getChildAt(index), dark)
    }
  }
}

class SystemBarsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(SystemBarsModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
