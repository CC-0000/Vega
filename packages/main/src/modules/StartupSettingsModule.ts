import { app } from "electron";
import type { AppModule } from '../AppModule.js'; // Import AppModule interface
import AutoLaunch from 'electron-auto-launch'; // Import the new package

/**
 * Configures application startup settings using electron-auto-launch for cross-platform compatibility.
 */
class StartupSettings implements AppModule {
  #autoLauncher: AutoLaunch;

  constructor() {
    // Configure auto-launch
    // Ensure the app path is correct, especially for packaged apps
    const appPath = app.getPath('exe').replace(/\//g, '/'); // Normalize path separators
    this.#autoLauncher = new AutoLaunch({
      name: app.getName(),
      path: appPath,
      isHidden: true, // Corresponds to the '--hidden' argument we used before
    });
  }

  async enable(): Promise<void> {
    if (!import.meta.env.DEV) {
      try {
        const isEnabled = await this.#autoLauncher.isEnabled();
        if (!isEnabled) {
          await this.#autoLauncher.enable();
          console.log("Auto-launch enabled.");
        }
      } catch (error) {
        console.error("Failed to enable auto-launch:", error);
      }
    } else {
      console.log("Auto-launch skipped in development mode.");
    }
  }

  // Optional: Add a disable method if needed later
  async disable(): Promise<void> {
    if (!import.meta.env.DEV) {
      try {
        await this.#autoLauncher.disable();
        console.log("Auto-launch disabled.");
      } catch (error) {
        console.error("Failed to disable auto-launch:", error);
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
