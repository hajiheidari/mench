import Appodeal
import ExpoModulesCore
import UIKit

/// Appodeal rewarded videos, shown only from the shop for a few coins.
public class RewardedAdsModule: Module {
  private let listener = RewardedListener()

  public func definition() -> ModuleDefinition {
    Name("RewardedAds")

    Function("initialize") { (appKey: String, _: String) in
      DispatchQueue.main.async {
        Appodeal.setRewardedVideoDelegate(self.listener)
        Appodeal.setAutocache(true, types: .rewardedVideo)
        Appodeal.initialize(withApiKey: appKey, types: .rewardedVideo)
      }
    }

    Function("isReady") { () -> Bool in
      Appodeal.isReadyForShow(with: .rewardedVideo)
    }

    /// Resolves true when the player watched enough to earn the reward.
    AsyncFunction("show") { (promise: Promise) in
      guard Appodeal.isReadyForShow(with: .rewardedVideo),
        let root = Self.topViewController()
      else {
        promise.resolve(false)
        return
      }
      self.listener.begin(promise)
      if !Appodeal.showAd(.rewardedVideo, rootViewController: root) {
        self.listener.finish(false)
      }
    }.runOnQueue(.main)
  }

  private static func topViewController() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    var top = window?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}

final class RewardedListener: NSObject, AppodealRewardedVideoDelegate {
  private var pending: Promise?
  private var rewarded = false

  func begin(_ promise: Promise) {
    pending?.resolve(false)
    pending = promise
    rewarded = false
  }

  func finish(_ earned: Bool) {
    pending?.resolve(earned)
    pending = nil
  }

  func rewardedVideoDidFinish(_ rewardAmount: Float, name rewardName: String?) {
    rewarded = true
  }

  func rewardedVideoWillDismissAndWasFullyWatched(_ wasFullyWatched: Bool) {
    // The reward callback can land just after the dismissal.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      self.finish(self.rewarded || wasFullyWatched)
    }
  }

  func rewardedVideoDidFailToPresentWithError(_ error: Error) {
    finish(false)
  }
}
