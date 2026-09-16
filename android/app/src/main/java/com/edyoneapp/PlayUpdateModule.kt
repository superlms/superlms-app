package com.edyoneapp

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.content.IntentSender
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Play Store updates from inside the app (Google Play In-App Updates).
 *
 * The flexible kind downloads a newer build in the background while the app is
 * used, once the user has agreed in Play's small prompt; the download is then
 * installed quietly the next time the app leaves the screen — Play installs
 * without showing anything when the app is in the background — and the app
 * opens on the new build next time, still signed in (an update keeps the app's
 * data). The install waits while the app has another app open for a result (a
 * file or photo picker), so nothing picked is lost.
 *
 * The immediate kind runs Play's full-screen update and Play restarts the app.
 *
 * Play only answers for an install that came from the Play Store.
 */
class PlayUpdateModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val manager: AppUpdateManager by lazy { AppUpdateManagerFactory.create(context) }
  private val handler = Handler(Looper.getMainLooper())

  /** The JS call waiting for Play's prompt or update screen to close. */
  private var flowPromise: Promise? = null
  private var flowType = AppUpdateType.IMMEDIATE

  /** A flexible update has finished downloading and waits to be installed. */
  private var downloaded = false
  private var installing = false

  /** The app's screen isn't showing (home, another app, screen off). */
  private var away = false

  private val installWhenAway = Runnable {
    if (downloaded && away && !awaitingResult && !installing) {
      installing = true
      manager.completeUpdate().addOnFailureListener { installing = false }
    }
  }

  private val installStateListener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
      downloaded = true
      scheduleInstall()
    }
  }

  private val resultListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE) return
        val promise = flowPromise ?: return
        flowPromise = null
        promise.resolve(
          when {
            resultCode == Activity.RESULT_OK && flowType == AppUpdateType.FLEXIBLE -> "accepted"
            resultCode == Activity.RESULT_OK -> "updated"
            resultCode == Activity.RESULT_CANCELED -> "cancelled"
            else -> "failed"
          }
        )
      }
    }

  private val screenListener =
    object : Application.ActivityLifecycleCallbacks {
      override fun onActivityStarted(activity: Activity) {
        if (activity !is MainActivity) return
        away = false
        handler.removeCallbacks(installWhenAway)
      }

      override fun onActivityStopped(activity: Activity) {
        if (activity !is MainActivity) return
        away = true
        scheduleInstall()
      }

      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
      override fun onActivityResumed(activity: Activity) = Unit
      override fun onActivityPaused(activity: Activity) = Unit
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
      override fun onActivityDestroyed(activity: Activity) = Unit
    }

  init {
    context.addActivityEventListener(resultListener)
    (context.applicationContext as Application).registerActivityLifecycleCallbacks(screenListener)
    manager.registerListener(installStateListener)
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    handler.removeCallbacks(installWhenAway)
    manager.unregisterListener(installStateListener)
    (context.applicationContext as Application).unregisterActivityLifecycleCallbacks(screenListener)
    context.removeActivityEventListener(resultListener)
    super.invalidate()
  }

  /** A moment after the app leaves the screen, so a quick switch back doesn't count. */
  private fun scheduleInstall() {
    handler.removeCallbacks(installWhenAway)
    if (downloaded && away) handler.postDelayed(installWhenAway, INSTALL_DELAY_MS)
  }

  /**
   * { available, inProgress, immediateAllowed, flexibleAllowed, installStatus,
   * versionCode } for the Play build.
   */
  @ReactMethod
  fun check(promise: Promise) {
    manager.appUpdateInfo
      .addOnSuccessListener { info ->
        val availability = info.updateAvailability()
        val installStatus = info.installStatus()
        // Downloaded in an earlier session and not installed yet.
        if (installStatus == InstallStatus.DOWNLOADED) {
          downloaded = true
          scheduleInstall()
        }
        promise.resolve(
          Arguments.createMap().apply {
            putBoolean("available", availability == UpdateAvailability.UPDATE_AVAILABLE)
            putBoolean(
              "inProgress",
              availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS,
            )
            putBoolean("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
            putBoolean("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
            putString("installStatus", installStatusName(installStatus))
            putInt("versionCode", info.availableVersionCode())
          }
        )
      }
      .addOnFailureListener { e -> promise.reject("E_CHECK", e.message, e) }
  }

  /**
   * Play's prompt to download the update in the background. Resolves
   * "accepted", "cancelled", "failed", or "unavailable".
   */
  @ReactMethod
  fun startFlexible(promise: Promise) = startFlow(AppUpdateType.FLEXIBLE, promise)

  /**
   * Play's full-screen update. Resolves "updated", "cancelled", "failed", or
   * "unavailable" when there is nothing Play can update to right now.
   */
  @ReactMethod
  fun startImmediate(promise: Promise) = startFlow(AppUpdateType.IMMEDIATE, promise)

  private fun startFlow(type: Int, promise: Promise) {
    manager.appUpdateInfo
      .addOnSuccessListener { info ->
        val activity = reactApplicationContext.currentActivity
        val availability = info.updateAvailability()
        val startable =
          (availability == UpdateAvailability.UPDATE_AVAILABLE ||
            (type == AppUpdateType.IMMEDIATE &&
              availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)) &&
            info.isUpdateTypeAllowed(type)
        if (activity == null || !startable) {
          promise.resolve("unavailable")
          return@addOnSuccessListener
        }

        flowPromise?.resolve("cancelled")
        flowPromise = promise
        flowType = type
        try {
          val started =
            manager.startUpdateFlowForResult(
              info,
              activity,
              AppUpdateOptions.defaultOptions(type),
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

  private fun installStatusName(status: Int): String =
    when (status) {
      InstallStatus.PENDING -> "pending"
      InstallStatus.DOWNLOADING -> "downloading"
      InstallStatus.DOWNLOADED -> "downloaded"
      InstallStatus.INSTALLING -> "installing"
      InstallStatus.INSTALLED -> "installed"
      InstallStatus.FAILED -> "failed"
      InstallStatus.CANCELED -> "canceled"
      else -> "none"
    }

  companion object {
    const val NAME = "PlayUpdate"
    private const val REQUEST_CODE = 4817
    private const val INSTALL_DELAY_MS = 3000L

    /**
     * The app has another app open for a result (MainActivity keeps this) —
     * installing now would restart the app under it.
     */
    @Volatile @JvmStatic var awaitingResult = false
  }
}
