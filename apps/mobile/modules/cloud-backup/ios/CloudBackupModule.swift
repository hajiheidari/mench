import ExpoModulesCore

/// The wallet recovery code in iCloud key-value storage, so a reinstall or a
/// new iPhone on the same Apple ID gets the coins back without typing it.
public class CloudBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CloudBackup")

    AsyncFunction("get") { (key: String) -> String? in
      let store = NSUbiquitousKeyValueStore.default
      store.synchronize()
      return store.string(forKey: key)
    }

    AsyncFunction("set") { (key: String, value: String) in
      let store = NSUbiquitousKeyValueStore.default
      store.set(value, forKey: key)
      store.synchronize()
    }
  }
}
