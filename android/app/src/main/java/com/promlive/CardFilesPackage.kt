package com.promlive

import android.app.Activity
import android.content.Intent
import android.content.ClipData
import android.provider.OpenableColumns
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.concurrent.Executors

class CardFilesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private var pending: Promise? = null
  private var pendingContent: ByteArray? = null
  private val pickCardCode = 7801
  private val pickAssetCode = 7802
  private val saveCode = 7803
  override fun getName() = "PromliveCardFiles"
  init {
    context.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode !in listOf(pickCardCode, pickAssetCode, saveCode)) return
        val promise = pending ?: return
        val contents = pendingContent
        pending = null; pendingContent = null
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {promise.resolve(if (requestCode == saveCode) false else null); return}
        executor.execute {
          try {
            if (requestCode == saveCode) {
              context.contentResolver.openOutputStream(uri, "wt")?.use {it.write(contents ?: error("저장할 파일이 없어요."))} ?: error("파일을 저장할 수 없어요.")
              promise.resolve(true)
            } else {
              val limit = if (requestCode == pickCardCode) 32 * 1024 * 1024 else 10 * 1024 * 1024
              val bytes = context.contentResolver.openInputStream(uri)?.use {stream ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {val count = stream.read(buffer); if (count < 0) break; if (output.size() + count > limit) error("파일 크기 제한을 넘었어요."); output.write(buffer, 0, count)}
                output.toByteArray()
              } ?: error("파일을 읽지 못했어요.")
              if (requestCode == pickCardCode) promise.resolve(bytes.toString(Charsets.UTF_8))
              else {
                var name = "에셋"
                context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {cursor -> if (cursor.moveToFirst()) name = cursor.getString(0).take(180)}
                val type = context.contentResolver.getType(uri) ?: "application/octet-stream"
                val mime = if (Regex("^(audio/(mpeg|mp4|wav|x-wav|ogg)|text/plain|application/(json|pdf))$").matches(type)) type else "application/octet-stream"
                promise.resolve(Arguments.createMap().apply {putString("uri", "data:$mime;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)); putString("name", name); putInt("width", 0); putInt("height", 0)})
              }
            }
          } catch (error: Exception) {promise.reject("CARD_FILE", error.message, error)}
        }
      }
    })
  }
  private fun choose(code: Int, promise: Promise, contents: ByteArray? = null, name: String? = null) {
    UiThreadUtil.runOnUiThread {
      if (pending != null) {promise.reject("BUSY", "파일 선택을 먼저 마쳐 주세요."); return@runOnUiThread}
      val activity = context.currentActivity
      if (activity == null) {promise.reject("NO_ACTIVITY", "앱 화면을 먼저 열어 주세요."); return@runOnUiThread}
      pending = promise; pendingContent = contents
      try {
        val intent = Intent(if (code == saveCode) Intent.ACTION_CREATE_DOCUMENT else Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = if (code == saveCode) "application/octet-stream" else "*/*"
          if (name != null) putExtra(Intent.EXTRA_TITLE, name)
        }
        activity.startActivityForResult(intent, code)
      } catch (error: Exception) {pending = null; pendingContent = null; promise.reject("CARD_FILE", error.message, error)}
    }
  }
  @ReactMethod fun pickCard(promise: Promise) = choose(pickCardCode, promise)
  @ReactMethod fun pickAsset(promise: Promise) = choose(pickAssetCode, promise)
  @ReactMethod fun exportCard(name: String, contents: String, share: Boolean, promise: Promise) {
    val bytes = contents.toByteArray(Charsets.UTF_8)
    if (bytes.size > 32 * 1024 * 1024) {promise.reject("TOO_LARGE", "카드 파일은 32MB까지 내보낼 수 있어요."); return}
    val safeName = name.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").take(100)
    if (!share) {choose(saveCode, promise, bytes, safeName); return}
    executor.execute {
      try {
        val directory = File(context.cacheDir, "card-shares").apply {mkdirs()}
        directory.listFiles()?.filter {System.currentTimeMillis() - it.lastModified() > 86400000}?.forEach {it.delete()}
        val file = File(directory, safeName).apply {writeBytes(bytes)}
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.cards", file)
        UiThreadUtil.runOnUiThread {
          try {
            val activity = context.currentActivity ?: error("앱 화면을 먼저 열어 주세요.")
            val intent = Intent(Intent.ACTION_SEND).apply {type = "application/octet-stream"; putExtra(Intent.EXTRA_STREAM, uri); clipData = ClipData.newRawUri(name, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)}
            activity.startActivity(Intent.createChooser(intent, "카드 공유")); promise.resolve(true)
          } catch (error: Exception) {promise.reject("CARD_FILE", error.message, error)}
        }
      } catch (error: Exception) {promise.reject("CARD_FILE", error.message, error)}
    }
  }
}
class CardFilesPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(CardFilesModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
