import type { AppModule } from "../AppModule.js";
import { ModuleContext } from "../ModuleContext.js";
import { BrowserWindow, Tray, Menu, nativeImage } from "electron";
import type { AppInitConfig } from "../AppInitConfig.js";
import * as path from "path";
import { fileURLToPath } from "url";

class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools;
  #tray?: Tray;
  #isQuitting = false;

  constructor({
    initConfig,
    openDevTools = false,
  }: {
    initConfig: AppInitConfig;
    openDevTools?: boolean;
  }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    this.createTray(app);

    // Check if launched with --hidden argument (e.g., from startup)
    const shouldStartHidden = process.argv.includes('--hidden');

    // Create the window, but only show it if not starting hidden
    await this.restoreOrCreateWindow(!shouldStartHidden);

    app.on("second-instance", () => this.restoreOrCreateWindow(true));
    app.on("activate", () => this.restoreOrCreateWindow(true));
  }

  async createWindow(): Promise<BrowserWindow> {
    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
        webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
        preload: this.#preload.path,
      },
    });

    browserWindow.on("close", (event) => {
      if (!this.#isQuitting) {
        event.preventDefault();
        browserWindow.hide();
      }
    });

    if (this.#renderer instanceof URL) {
      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }

    if (!show) {
      return window;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window?.show();

    if (this.#openDevTools) {
      window?.webContents.openDevTools();
    }

    window.focus();

    return window;
  }

  private createTray(app: Electron.App) {
    const currentModulePath = fileURLToPath(import.meta.url);
    const moduleDir = path.dirname(currentModulePath);
    // In the built app, assets are copied to 'dist/assets'
    const iconPath = path.join(moduleDir, "assets", "trayIcon.png"); // Use PNG for reliable cross-platform support
    const trayIcon = nativeImage.createFromPath(iconPath);
    this.#tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Show", click: () => this.restoreOrCreateWindow(true) },
      {
        label: "Quit",
        click: () => {
          this.#isQuitting = true;
          app.quit();
        },
      },
    ]);
    this.#tray.setToolTip(app.name);
    this.#tray.setContextMenu(contextMenu);
    this.#tray.on("click", () => this.restoreOrCreateWindow(true));
  }
}

export function createWindowManagerModule(
  ...args: ConstructorParameters<typeof WindowManager>
) {
  return new WindowManager(...args);
}
