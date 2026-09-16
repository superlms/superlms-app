package com.edyoneapp
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.content.Intent
import android.os.Bundle
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory


class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SuperLMS"

  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
  }

  // While a picker, the camera or any app opened for a result is in front, a
  // downloaded Play update waits rather than restart the app under it.
  @Deprecated("Deprecated in Java")
  @Suppress("DEPRECATION")
  override fun startActivityForResult(intent: Intent, requestCode: Int, options: Bundle?) {
    PlayUpdateModule.awaitingResult = true
    super.startActivityForResult(intent, requestCode, options)
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    PlayUpdateModule.awaitingResult = false
    super.onActivityResult(requestCode, resultCode, data)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
