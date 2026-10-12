import ExpoModulesCore
import GameKit
import UIKit

/// Game Center: the player's sign-in, the online-wins leaderboard and the
/// achievements. Scores come from the server's count of verified wins.
public class GameCenterModule: Module {
  private let closer = DashboardCloser()

  public func definition() -> ModuleDefinition {
    Name("GameCenter")

    /// Resolves once Game Center has answered (signed in or not). If iOS needs
    /// the player to sign in, its own sheet is shown first.
    AsyncFunction("authenticate") { (promise: Promise) in
      let player = GKLocalPlayer.local
      if player.isAuthenticated {
        promise.resolve(true)
        return
      }
      var settled = false
      player.authenticateHandler = { viewController, _ in
        if let viewController {
          Self.topViewController()?.present(viewController, animated: true)
          return
        }
        if !settled {
          settled = true
          promise.resolve(player.isAuthenticated)
        }
      }
    }.runOnQueue(.main)

    Function("isAuthenticated") { () -> Bool in
      GKLocalPlayer.local.isAuthenticated
    }

    AsyncFunction("submitScore") { (leaderboard: String, value: Int) async throws in
      guard GKLocalPlayer.local.isAuthenticated else { return }
      try await GKLeaderboard.submitScore(
        value, context: 0, player: GKLocalPlayer.local,
        leaderboardIDs: [leaderboard])
    }

    AsyncFunction("reportAchievement") { (identifier: String, percent: Double) async throws in
      guard GKLocalPlayer.local.isAuthenticated else { return }
      let achievement = GKAchievement(identifier: identifier)
      achievement.percentComplete = min(100, max(0, percent))
      achievement.showsCompletionBanner = true
      try await GKAchievement.report([achievement])
    }

    AsyncFunction("showDashboard") {
      guard GKLocalPlayer.local.isAuthenticated,
        let top = Self.topViewController()
      else { return }
      let dashboard = GKGameCenterViewController(state: .dashboard)
      dashboard.gameCenterDelegate = self.closer
      top.present(dashboard, animated: true)
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

final class DashboardCloser: NSObject, GKGameCenterControllerDelegate {
  func gameCenterViewControllerDidFinish(_ controller: GKGameCenterViewController) {
    controller.dismiss(animated: true)
  }
}
