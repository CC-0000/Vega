import type { AppModule } from '../AppModule.js';
import { ipcMain, dialog, BrowserWindow } from 'electron';

export function dialogModule(): AppModule {
  return {
    enable() {
      ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
        const win = BrowserWindow.getFocusedWindow();
        return dialog.showOpenDialog(win!, options);
      });
    }
  };
}
