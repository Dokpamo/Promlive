package com.storyloom

import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

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
