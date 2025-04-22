import { app } from "electron";
import type { AppModule } from '../AppModule.js'; // Import AppModule interface

/**
 * Configures application startup settings, such as launching on login.
 */
class StartupSettings implements AppModule {

  // No constructor arguments needed for this simple module yet
  constructor() {}

  async enable(): Promise<void> {
    this.configureLaunchOnLogin();
    console.log("StartupSettingsModule enabled (launch-on-login configured).");
  }

  private configureLaunchOnLogin() {
    // Configure the app to launch on login for production builds
    if (!import.meta.env.DEV) {
      try {
        app.setLoginItemSettings({
          openAtLogin: true,
          // Add --hidden argument for WindowManager to detect startup launch
          args: ['--hidden']
        });
        console.log("Configured app to launch on login.");
      } catch (error) {
        console.error("Failed to set login item settings:", error);
      }
    }
  }
}

/**
 * Factory function to create an instance of the StartupSettings module.
 */
export function startupSettingsModule(...args: ConstructorParameters<typeof StartupSettings>) {
  return new StartupSettings(...args);
}
