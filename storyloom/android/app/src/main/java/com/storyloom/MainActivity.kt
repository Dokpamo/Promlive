package com.storyloom

import android.view.KeyEvent
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  private var appReady = false

  override fun onCreate(savedInstanceState: Bundle?) {
    val started = SystemClock.elapsedRealtime()
    val splash = installSplashScreen()
    super.onCreate(savedInstanceState)
    // Release as soon as the restored app (or its error view) is ready. The
    // deadline only prevents a missing JS bundle from trapping the user here.
    splash.setKeepOnScreenCondition { !appReady && SystemClock.elapsedRealtime() - started < 10_000 }
    if (Build.VERSION.SDK_INT >= 30) {
      // Keep the canvas fixed. KeyboardMotionView moves only the floating dock.
      window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
    }
  }

  fun revealApp() {
    appReady = true
    window.decorView.postInvalidateOnAnimation()
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
  override fun getMainComponentName(): String = "Storyloom"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
