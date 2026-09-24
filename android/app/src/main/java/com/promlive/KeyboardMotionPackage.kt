package com.promlive

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
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
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
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
import com.facebook.react.views.textinput.ReactEditText

/** The dock follows the IME on the UI thread, without waiting for a JS layout. */
class KeyboardMotionView(private val reactContext: ThemedReactContext) : ReactViewGroup(reactContext) {
  var trackDockOffset = false
    set(value) { field = value; lastDockOffset = Float.NaN; positionDock() }
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
      if (!value && !caret.isTransitioning) caret.reset()
      field = value
    }
  var anchorEditor = false
    set(value) {
      if (value != field) caret.setTransitioning(value, caretIme)
      field = value
    }
  internal var composerGeometry: ComposerDockGeometry? = null
    set(value) { field = value; positionDock() }
  private var composerSurface: View? = null
  private var frozenIme = 0
  private var imeHeight = 0
  private val caretIme: Int get() = if (Build.VERSION.SDK_INT >= 30) imeHeight else 0
  private var lastReported = -1
  private var lastDockOffset = Float.NaN
  private val motion = KeyboardInsetMotion(publish = ::updateHeight)
  private val caret = EditorCaretVisibility(this)
  private val beforeDraw = ViewTreeObserver.OnDrawListener {
    if (composerGeometry != null) positionDock()
    if (followCaret || caret.isTransitioning) caret.beforeDraw(caretIme)
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (followCaret) caret.touch(event)
    return super.dispatchTouchEvent(event)
  }

  private fun positionDock() {
    // Older Android versions still use the window's adjustResize fallback.
    val dockIme = if (freezeKeyboard) frozenIme else imeHeight
    val geometry = composerGeometry
    val surface = if (geometry == null) null else findComposerSurface()
    val fraction = if (geometry != null && surface != null && surface.height > 0) geometry.fraction(surface.height) else dockFraction
    translationY = if (Build.VERSION.SDK_INT >= 30) -maxOf(0f, dockIme - bottomInset) * fraction else 0f
    // Fabric measures its shadow tree, not this UI-thread translation. Mirror
    // the displayed offset so Pressability keeps the correct release bounds.
    if (trackDockOffset && isAttachedToWindow && id != NO_ID && translationY != lastDockOffset) {
      lastDockOffset = translationY
      val data = Arguments.createMap().apply {
        putDouble("translationY", translationY / resources.displayMetrics.density.toDouble())
      }
      UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
        KeyboardDockFrameEvent(UIManagerHelper.getSurfaceId(reactContext), id, data)
      )
    }
  }

  private fun findComposerSurface(): View? {
    composerSurface?.takeIf { it.isAttachedToWindow }?.let { return it }
    fun matches(view: View) = view.getTag(com.facebook.react.R.id.view_tag_native_id) == "promlive-composer-surface"
    var ancestor = parent
    while (ancestor is View) {
      if (matches(ancestor)) { composerSurface = ancestor; return ancestor }
      ancestor = ancestor.parent
    }
    fun descendant(view: View): View? {
      if (matches(view)) return view
      if (view is ViewGroup) for (i in 0 until view.childCount) descendant(view.getChildAt(i))?.let { return it }
      return null
    }
    return descendant(this)?.also { composerSurface = it }
  }

  private fun updateHeight(height: Int) {
    imeHeight = height
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
    lastDockOffset = Float.NaN
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
      val height = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (Build.VERSION.SDK_INT >= 30) {
        // Even disabled animations deliver an IME progress/final frame. A
        // layout target must never bypass that stream in the focused window.
        motion.layout(height, followsAnimation = hasWindowFocus())
      } else updateHeight(height)
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(this, object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
      override fun onPrepare(animation: WindowInsetsAnimationCompat) {
        if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
          motion.prepare(animation)
          reactContext.getNativeModule(KeyboardControlModule::class.java)?.keyboardWillAnimate()
        }
      }
      override fun onProgress(insets: WindowInsetsCompat, animations: MutableList<WindowInsetsAnimationCompat>): WindowInsetsCompat {
        if (animations.any { it.typeMask and WindowInsetsCompat.Type.ime() != 0 }) {
          motion.progress(insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
        }
        return insets
      }
      override fun onEnd(animation: WindowInsetsAnimationCompat) {
        if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
          motion.end(animation)
        }
      }
    })
    ViewCompat.getRootWindowInsets(this)?.let { updateHeight(it.getInsets(WindowInsetsCompat.Type.ime()).bottom) }
    ViewCompat.requestApplyInsets(this)
  }

  override fun onDetachedFromWindow() {
    if (viewTreeObserver.isAlive) viewTreeObserver.removeOnDrawListener(beforeDraw)
    caret.reset()
    composerSurface = null
    ViewCompat.setOnApplyWindowInsetsListener(this, null)
    ViewCompat.setWindowInsetsAnimationCallback(this, null)
    motion.reset()
    super.onDetachedFromWindow()
  }
}

private class KeyboardFrameEvent(surfaceId: Int, viewId: Int, private val data: WritableMap) : Event<KeyboardFrameEvent>(surfaceId, viewId) {
  override fun getEventName() = "topKeyboardFrame"
  override fun getEventData() = data
}

private class KeyboardDockFrameEvent(surfaceId: Int, viewId: Int, private val data: WritableMap) : Event<KeyboardDockFrameEvent>(surfaceId, viewId) {
  override fun getEventName() = "topKeyboardDockFrame"
  override fun getEventData() = data
}

class KeyboardMotionViewManager : ReactViewManager() {
  override fun getName() = "PromliveKeyboardView"
  override fun createViewInstance(context: ThemedReactContext) = KeyboardMotionView(context)
  // The transform prop mirrors native motion for Fabric measurements only.
  // Applying a late JS frame to the view would make the IME animation jump back.
  override fun setTransform(view: ReactViewGroup, transforms: ReadableArray?) = Unit
  @ReactProp(name = "trackDockOffset", defaultBoolean = false)
  fun setTrackDockOffset(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).trackDockOffset = value }
  @ReactProp(name = "dockFraction", defaultFloat = 0f)
  fun setDockFraction(view: ReactViewGroup, value: Float) { (view as KeyboardMotionView).dockFraction = value }
  @ReactProp(name = "bottomInset", defaultFloat = 0f)
  fun setBottomInset(view: ReactViewGroup, value: Float) { (view as KeyboardMotionView).bottomInset = value }
  @ReactProp(name = "freezeKeyboard", defaultBoolean = false)
  fun setFreezeKeyboard(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).freezeKeyboard = value }
  @ReactProp(name = "followCaret", defaultBoolean = false)
  fun setFollowCaret(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).followCaret = value }
  @ReactProp(name = "anchorEditor", defaultBoolean = false)
  fun setAnchorEditor(view: ReactViewGroup, value: Boolean) { (view as KeyboardMotionView).anchorEditor = value }
  @ReactProp(name = "composerGeometry")
  fun setComposerGeometry(view: ReactViewGroup, value: ReadableMap?) {
    val density = view.resources.displayMetrics.density
    (view as KeyboardMotionView).composerGeometry = value?.let {
      ComposerDockGeometry(it.getDouble("compactHeight").toFloat() * density,
        it.getDouble("expandedHeight").toFloat() * density, it.hasKey("footer") && it.getBoolean("footer"))
    }
  }
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()).toMutableMap().apply {
      put("topKeyboardFrame", mapOf("registrationName" to "onKeyboardFrame"))
      put("topKeyboardDockFrame", mapOf("registrationName" to "onKeyboardDockFrame"))
    }
}

@ReactModule(name = "PromliveKeyboard")
class KeyboardControlModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val handler = Handler(Looper.getMainLooper())
  private var expansionReady: (() -> Unit)? = null
  private var showRequest = 0

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
      if (editor == null || Build.VERSION.SDK_INT < 30 ||
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
      // focusWithKeyboard requests focus/show immediately after arming this
      // callback. showForInput waits for attachment and the served-view handoff.
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
      val request = ++showRequest
      val editor = runCatching {
        UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag)?.resolveView(reactTag)
      }.getOrNull() ?: return@runOnUiThread
      if (hardwareKeyboardOnly(editor)) return@runOnUiThread
      val show = {
        editor.post { showWhenReady(editor, request) }
      }
      if (editor.isAttachedToWindow && editor.hasWindowFocus()) {
        show()
      } else {
        val listener = object : ViewTreeObserver.OnWindowFocusChangeListener, View.OnAttachStateChangeListener {
          private var observer: ViewTreeObserver? = null
          private fun remove() {
            observer?.takeIf { it.isAlive }?.removeOnWindowFocusChangeListener(this)
            editor.removeOnAttachStateChangeListener(this)
          }
          fun watchWindow() {
            if (request != showRequest) { remove(); return }
            if (!editor.isAttachedToWindow) return
            if (editor.hasWindowFocus()) { remove(); show(); return }
            observer = editor.viewTreeObserver
            observer?.addOnWindowFocusChangeListener(this)
          }
          override fun onWindowFocusChanged(hasFocus: Boolean) { if (hasFocus) { remove(); show() } }
          override fun onViewDetachedFromWindow(view: View) { remove() }
          override fun onViewAttachedToWindow(view: View) { watchWindow() }
        }
        editor.addOnAttachStateChangeListener(listener)
        listener.watchWindow()
      }
    }
  }

  private fun showWhenReady(editor: View, request: Int, framesLeft: Int = 12) {
    if (request != showRequest || !editor.isAttachedToWindow) return
    // Fabric can dispatch focus before layout and InputMethodManager's served-view
    // handoff. A single show at that point is rejected with PHASE_CLIENT_VIEW_SERVED.
    // Retry only until this editor is served; never delay an already-ready input.
    val inputMethod = editor.context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    if (editor.hasWindowFocus() && editor.width > 0 && editor.height > 0 && !editor.hasFocus()) {
      // Removing an outgoing editor can move focus after Fabric's JS focus
      // command. Restore the requested input after that native commit.
      (editor as? ReactEditText)?.requestFocusFromJS()
    }
    if (editor.hasWindowFocus() && editor.hasFocus() && editor.width > 0 && editor.height > 0 && inputMethod.isActive(editor)) {
      if (ViewCompat.getRootWindowInsets(editor)?.isVisible(WindowInsetsCompat.Type.ime()) == true) keyboardWillAnimate()
      SoftwareKeyboardControllerCompat(editor).show()
    } else if (framesLeft > 0) {
      editor.postOnAnimation { showWhenReady(editor, request, framesLeft - 1) }
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
    UiThreadUtil.runOnUiThread { showRequest++; expansionReady?.invoke() }
    super.invalidate()
  }
}

class KeyboardMotionPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(KeyboardControlModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(KeyboardMotionViewManager())
}
