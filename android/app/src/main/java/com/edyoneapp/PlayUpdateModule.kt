package com.edyoneapp

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Play Store updates from inside the app (Google Play In-App Updates, the
 * immediate kind): asks Play whether a newer build of the app is out, and runs
 * Play's full-screen update, after which Play restarts the app on the new build.
 * Play only answers for an install that came from the Play Store.
 */
class PlayUpdateModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val manager: AppUpdateManager by lazy { AppUpdateManagerFactory.create(context) }

  /** The JS call waiting for the update screen to close. */
  private var flowPromise: Promise? = null

  private val resultListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = flowPromise ?: return
        flowPromise = null
        promise.resolve(
          when (resultCode) {
            Activity.RESULT_OK -> "updated"
            Activity.RESULT_CANCELED -> "cancelled"
            else -> "failed"
          }
        )
      }
    }

  init {
    context.addActivityEventListener(resultListener)
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    context.removeActivityEventListener(resultListener)
    super.invalidate()
  }

  /** { available, inProgress, immediateAllowed, versionCode } for the Play build. */
  @ReactMethod
  fun check(promise: Promise) {
    manager.appUpdateInfo
      .addOnSuccessListener { info ->
        val availability = info.updateAvailability()
        promise.resolve(
          Arguments.createMap().apply {
            putBoolean("available", availability == UpdateAvailability.UPDATE_AVAILABLE)
            putBoolean(
              "inProgress",
              availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS,
            )
            putBoolean("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
            putInt("versionCode", info.availableVersionCode())
          }
        )
      }
      .addOnFailureListener { e -> promise.reject("E_CHECK", e.message, e) }
  }

  /**
   * Opens Play's update screen. Resolves "updated", "cancelled", "failed", or
   * "unavailable" when there is nothing Play can update to right now.
   */
  @ReactMethod
  fun startImmediate(promise: Promise) {
    manager.appUpdateInfo
      .addOnSuccessListener { info ->
        val activity = reactApplicationContext.currentActivity
        val availability = info.updateAvailability()
        val startable =
          (availability == UpdateAvailability.UPDATE_AVAILABLE ||
            availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) &&
            info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
        if (activity == null || !startable) {
          promise.resolve("unavailable")
          return@addOnSuccessListener
        }

        flowPromise?.resolve("cancelled")
        flowPromise = promise
        try {
          val started =
            manager.startUpdateFlowForResult(
              info,
              activity,
              AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE),
              REQUEST_CODE,
            )
          if (!started) {
            flowPromise = null
            promise.resolve("unavailable")
          }
        } catch (e: IntentSender.SendIntentException) {
          flowPromise = null
          promise.reject("E_START", e.message, e)
        }
      }
      .addOnFailureListener { e -> promise.reject("E_CHECK", e.message, e) }
  }

  /** The app's Play Store page, for when Play won't run the update in the app. */
  @ReactMethod
  fun openStore(promise: Promise) {
    val id = context.packageName
    try {
      startView("market://details?id=$id")
    } catch (e: Exception) {
      try {
        startView("https://play.google.com/store/apps/details?id=$id")
      } catch (e2: Exception) {
        promise.reject("E_STORE", e2.message, e2)
        return
      }
    }
    promise.resolve(true)
  }

  private fun startView(url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  companion object {
    const val NAME = "PlayUpdate"
    private const val REQUEST_CODE = 4817
  }
}
