package com.promlive

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.MotionEvent
import android.view.ViewTreeObserver
import android.view.inputmethod.InputMethodManager
import androidx.core.view.ViewCompat
import androidx.core.view.SoftwareKeyboardControllerCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/** The dock follows the IME on the UI thread, without waiting for a JS layout. */
class KeyboardMotionView(private val reactContext: ThemedReactContext) : ReactViewGroup(reactContext) {
  var dockFraction = 0f
    set(value) { field = value; positionDock() }
  var bottomInset = 0f
    set(value) { field = value * resources.displayMetrics.density; positionDock() }
  var freezeKeyboard = false
    set(value) {
      if (value && !field) frozenIme = imeHeight
      field = value
      positionDock()
    }
  var followCaret = false
    set(value) {
      if (value && !field) caret.capture(caretIme)
      if (!value) caret.reset()
      field = value
    }
  private var frozenIme = 0
  private var imeHeight = 0
  private val caretIme: Int get() = if (Build.VERSION.SDK_INT >= 30) imeHeight else 0
  private var animating = false
  private var lastReported = -1
  private val caret = EditorCaretVisibility(this)
  private val beforeDraw = ViewTreeObserver.OnDrawListener { if (followCaret) caret.beforeDraw(caretIme) }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (followCaret) caret.touch(event)
    return super.dispatchTouchEvent(event)
  }

  private fun positionDock() {
    // Older Android versions still use the window's adjustResize fallback.
    val dockIme = if (freezeKeyboard) frozenIme else imeHeight
    translationY = if (Build.VERSION.SDK_INT >= 30) -maxOf(0f, dockIme - bottomInset) * dockFraction else 0f
  }

  private fun update(insets: WindowInsetsCompat) {
    imeHeight = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
    positionDock()
    // A fixed sheet otherwise has no reason to redraw while the IME moves.
    // Keep caret avoidance on the same native frames, even if JS layout is late.
    if (followCaret) invalidate()
    // On older Android the resized window already excludes the IME.
    val coveredHeight = if (Build.VERSION.SDK_INT >= 30) imeHeight else 0
    if (id == NO_ID || coveredHeight == lastReported) return
    lastReported = coveredHeight
    val data = Arguments.createMap().apply {
      putDouble("height", coveredHeight / resources.displayMetrics.density.toDouble())
    }
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      KeyboardFrameEvent(UIManagerHelper.getSurfaceId(reactContext), id, data)
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnDrawListener(beforeDraw)
    lastReported = -1
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
      // These are the final insets during an animation. Wait for onProgress
      // instead of jumping to them before the keyboard has moved.
      if (!animating) update(insets)
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(this, object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
      override fun onPrepare(animation: WindowInsetsAnimationCompat) {
        if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
          animating = true
          reactContext.getNativeModule(KeyboardControlModule::class.java)?.keyboardWillAnimate()
        }
      }
      override fun onProgress(insets: WindowInsetsCompat, animations: MutableList<WindowInsetsAnimationCompat>): WindowInsetsCompat {
        update(insets)
        return insets
      }
      override fun onEnd(animation: WindowInsetsAnimationCompat) {
        if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
          animating = false
          ViewCompat.getRootWindowInsets(this@KeyboardMotionView)?.let(::update)
        }
      }
    })
    ViewCompat.getRootWindowInsets(this)?.let(::update)
    ViewCompat.requestApplyInsets(this)
  }

  override fun onDetachedFromWindow() {
    if (viewTreeObserver.isAlive) viewTreeObserver.removeOnDrawListener(beforeDraw)
    caret.reset()
    ViewCompat.setOnApplyWindowInsetsListener(this, null)
    ViewCompat.setWindowInsetsAnimationCallback(this, null)
    animating = false
    super.onDetachedFromWindow()
  }
}

private class KeyboardFrameEvent(surfaceId: Int, viewId: Int, private val data: WritableMap) : Event<KeyboardFrameEvent>(surfaceId, viewId) {
  override fun getEventName() = "topKeyboardFrame"
  override fun getEventData() = data
}

class KeyboardMotionViewManager : ReactViewManager() {
  override fun getName() = "PromliveKeyboardView"
  override fun createViewInstance(context: ThemedReactContext) = KeyboardMotionView(context)
  @ReactProp(name = "dockFraction", defaultFloat = 0f)
  fun setDockFraction(view: ReactViewGroup, value: Float) { (view as KeyboardMotionView).dockFraction = value }
  @ReactProp(name = "bottomInset", defaultFloat = 0f)
  fun setBottomInset(view: ReactViewGroup, value: Float) { (view as KeyboardMotionView).bottomInset = value }
  @ReactProp(name = "freezeKeyboard", defaultBoolean = false)
  fun setFreezeKeyboard(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).freezeKeyboard = value }
  @ReactProp(name = "followCaret", defaultBoolean = false)
  fun setFollowCaret(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).followCaret = value }
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()).toMutableMap().apply {
      put("topKeyboardFrame", mapOf("registrationName" to "onKeyboardFrame"))
    }
}

@ReactModule(name = "PromliveKeyboard")
class KeyboardControlModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val handler = Handler(Looper.getMainLooper())
  private var expansionReady: (() -> Unit)? = null

  override fun getName() = "PromliveKeyboard"

  /** Resolve as the IME prepares to animate, not after it has finished showing. */
  @ReactMethod
  fun prepareExpansion(reactTag: Int, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      expansionReady?.invoke()
      val editor = runCatching {
        UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag)?.resolveView(reactTag)
      }.getOrNull()
      val insets = editor?.let(ViewCompat::getRootWindowInsets)
      if (editor == null || !editor.isAttachedToWindow || Build.VERSION.SDK_INT < 30 ||
        insets?.isVisible(WindowInsetsCompat.Type.ime()) == true || hardwareKeyboardOnly(editor)) {
        promise.resolve(null)
        return@runOnUiThread
      }

      var completed = false
      lateinit var timeout: Runnable
      val finish = {
        if (!completed) {
          completed = true
          handler.removeCallbacks(timeout)
          expansionReady = null
          promise.resolve(null)
        }
      }
      // Accessibility, hardware keyboards or an IME declining to open must
      // never prevent expansion. Normal IME animations resolve in onPrepare.
      timeout = Runnable { finish() }
      expansionReady = finish
      handler.postDelayed(timeout, 750)
      if (editor.hasFocus()) {
        val accepted = (editor.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
          .showSoftInput(editor, InputMethodManager.SHOW_IMPLICIT)
        if (!accepted) finish()
      }
      // A newly focused editor is shown by ReactEditText's focus command, which
      // the caller issues immediately after arming this callback.
    }
  }

  private fun hardwareKeyboardOnly(view: View): Boolean {
    val config = view.resources.configuration
    return config.keyboard != Configuration.KEYBOARD_NOKEYS &&
      config.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO &&
      Settings.Secure.getInt(view.context.contentResolver, "show_ime_with_hard_keyboard", 0) == 0
  }

  fun keyboardWillAnimate() { expansionReady?.invoke() }

  /** A dialog editor belongs to its own window, not the activity's currentFocus. */
  @ReactMethod
  fun showForInput(reactTag: Int) {
    UiThreadUtil.runOnUiThread {
      val editor = runCatching {
        UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag)?.resolveView(reactTag)
      }.getOrNull() ?: return@runOnUiThread
      if (!editor.isAttachedToWindow || hardwareKeyboardOnly(editor)) return@runOnUiThread
      val show = {
        editor.post {
          if (editor.isAttachedToWindow && editor.hasWindowFocus() && editor.hasFocus()) {
            SoftwareKeyboardControllerCompat(editor).show()
          }
        }
      }
      if (editor.hasWindowFocus()) {
        show()
      } else {
        val observer = editor.viewTreeObserver
        val listener = object : ViewTreeObserver.OnWindowFocusChangeListener, View.OnAttachStateChangeListener {
          private fun remove() {
            if (observer.isAlive) observer.removeOnWindowFocusChangeListener(this)
            editor.removeOnAttachStateChangeListener(this)
          }
          override fun onWindowFocusChanged(hasFocus: Boolean) { if (hasFocus) { remove(); show() } }
          override fun onViewDetachedFromWindow(view: View) { remove() }
          override fun onViewAttachedToWindow(view: View) = Unit
        }
        observer.addOnWindowFocusChangeListener(listener)
        editor.addOnAttachStateChangeListener(listener)
      }
    }
  }

  @ReactMethod
  fun show() {
    UiThreadUtil.runOnUiThread {
      val view = reactApplicationContext.currentActivity?.currentFocus ?: return@runOnUiThread
      (view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
    }
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread { expansionReady?.invoke() }
    super.invalidate()
  }
}

class KeyboardMotionPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(KeyboardControlModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(KeyboardMotionViewManager())
}
