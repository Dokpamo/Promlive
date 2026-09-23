package com.promlive

import android.view.KeyEvent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.splashscreen.SplashScreenViewProvider
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  private var appReady = false
  private var launchView: SplashScreenViewProvider? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    val splash = installSplashScreen()
    super.onCreate(savedInstanceState)
    // Keep the launch artwork over the activity instead of cancelling pre-draw.
    // React needs to lay out and draw before it can report that its UI is ready.
    splash.setOnExitAnimationListener { provider ->
      launchView = provider
      if (appReady) revealApp()
    }
    if (Build.VERSION.SDK_INT >= 30) {
      // Keep the canvas fixed. KeyboardMotionView moves only the floating dock.
      window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
    }
  }

  fun revealApp() {
    appReady = true
    val provider = launchView ?: return
    launchView = null
    window.decorView.postOnAnimation {
      provider.view.animate().alpha(0f).setDuration(120).withEndAction { provider.remove() }.start()
    }
  }

  override fun onDestroy() {
    launchView?.remove()
    launchView = null
    super.onDestroy()
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
    // RN forwards dialog key-ups here, but currentFocus belongs to the activity.
    // Typing "rr" in a modal must not trigger the debug reload shortcut.
    if (BuildConfig.DEBUG && keyCode == KeyEvent.KEYCODE_R && !hasWindowFocus()) {
      return false
    }
    return super.onKeyUp(keyCode, event)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Promlive"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
