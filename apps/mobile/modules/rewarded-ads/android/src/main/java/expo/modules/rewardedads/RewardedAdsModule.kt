package expo.modules.rewardedads

import android.app.Application
import android.os.Handler
import android.os.Looper
import com.adivery.sdk.Adivery
import com.adivery.sdk.AdiveryListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Adivery rewarded videos, shown only from the shop for a few coins. */
class RewardedAdsModule : Module() {
  private var placement = ""
  private var configured = false
  private var pending: Promise? = null
  private var shown = false
  private val main = Handler(Looper.getMainLooper())

  private val listener = object : AdiveryListener() {
    override fun onRewardedAdShown(placementId: String) {
      if (placementId == placement) shown = true
    }

    override fun onRewardedAdClosed(placementId: String, isRewarded: Boolean) {
      if (placementId != placement) return
      finish(isRewarded)
      prepare()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("RewardedAds")

    Function("initialize") { appId: String, placementId: String ->
      val app = appContext.reactContext?.applicationContext as? Application
      if (app != null && !configured) {
        configured = true
        placement = placementId
        Adivery.configure(app, appId)
        Adivery.addGlobalListener(listener)
        main.post { prepare() }
      }
    }

    Function("isReady") {
      configured && Adivery.isLoaded(placement)
    }

    /** Resolves true when the player watched enough to earn the reward. */
    AsyncFunction("show") { promise: Promise ->
      if (!configured || !Adivery.isLoaded(placement)) {
        promise.resolve(false)
        prepare()
      } else {
        pending?.resolve(false)
        pending = promise
        shown = false
        Adivery.showAd(placement)
        // Adivery reports no show failure; give up if nothing appeared.
        val attempt = promise
        main.postDelayed({ if (pending === attempt && !shown) finish(false) }, 10_000)
      }
    }.runOnQueue(Queues.MAIN)
  }

  private fun finish(earned: Boolean) {
    pending?.resolve(earned)
    pending = null
  }

  private fun prepare() {
    val context = appContext.currentActivity ?: appContext.reactContext ?: return
    Adivery.prepareRewardedAd(context, placement)
  }
}
