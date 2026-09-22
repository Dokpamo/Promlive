package com.storyloom

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ViewManager

/** A small native mirror of the app theme is available before React/SQLite load. */
object StartupAppearance {
  private fun preferences(context: Context) = context.getSharedPreferences("promlive_startup", Context.MODE_PRIVATE)
  fun saved(context: Context): String? = preferences(context).getString("theme", null)

  fun restore(context: Context) { saved(context)?.let { apply(context, it) } }

  fun save(context: Context, mode: String) {
    if (mode !in listOf("light", "dark", "system")) return
    if (saved(context) != mode) preferences(context).edit().putString("theme", mode).apply()
    apply(context, mode)
  }

  private fun apply(context: Context, mode: String) {
    if (Build.VERSION.SDK_INT >= 31) {
      // Android persists this package override, so even the system's first
      // launch frame matches. AUTO clears the override and follows the system.
      val night = when (mode) {
        "light" -> UiModeManager.MODE_NIGHT_NO
        "dark" -> UiModeManager.MODE_NIGHT_YES
        else -> UiModeManager.MODE_NIGHT_AUTO
      }
      (context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager).setApplicationNightMode(night)
    } else {
      AppCompatDelegate.setDefaultNightMode(when (mode) {
        "light" -> AppCompatDelegate.MODE_NIGHT_NO
        "dark" -> AppCompatDelegate.MODE_NIGHT_YES
        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      })
    }
  }
}

@ReactModule(name = "PromliveStartup")
class StartupScreenModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PromliveStartup"
  override fun getConstants(): Map<String, Any> = mapOf("theme" to (StartupAppearance.saved(reactApplicationContext) ?: "dark"))

  @ReactMethod
  fun ready(theme: String) {
    UiThreadUtil.runOnUiThread {
      StartupAppearance.save(reactApplicationContext, theme)
      (reactApplicationContext.currentActivity as? MainActivity)?.revealApp()
    }
  }
}

class StartupScreenPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(StartupScreenModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
