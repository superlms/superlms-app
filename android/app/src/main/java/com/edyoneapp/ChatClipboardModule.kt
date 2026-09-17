package com.edyoneapp

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Copies a chat's photo, video or document itself to the clipboard, so another
 * app can paste the file — @react-native-clipboard/clipboard copies only text on
 * Android. The file goes on as a content:// link through react-native-blob-util's
 * FileProvider (authority "<applicationId>.provider", which covers the app's
 * files); the clipboard lends the pasting app read access to it.
 */
class ChatClipboardModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  @ReactMethod
  fun copyFile(path: String, label: String, promise: Promise) {
    try {
      val file = File(path.removePrefix("file://"))
      if (!file.exists()) {
        promise.reject("E_NO_FILE", "The file is not on this phone.")
        return
      }
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newUri(context.contentResolver, label, uri))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_COPY", e.message, e)
    }
  }

  companion object {
    const val NAME = "ChatClipboard"
  }
}
