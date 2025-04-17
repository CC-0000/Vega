import type { AppModule } from "../AppModule.js";
import { ipcMain } from "electron";
import * as fs from "node:fs/promises";

interface FileOpsAPI {
  getFileMetadata: (
    filePath: string
  ) => Promise<{ size: number; lastModified: number } | undefined>;
  isDirectory: (filePath: string) => Promise<boolean>;
}

class FileOpsModule implements AppModule, FileOpsAPI {
  enable(): void {
    ipcMain.handle("fileops:getMetadata", async (_event, filePath: string) => {
      return this.getFileMetadata(filePath);
    });
    ipcMain.handle("fileops:isDirectory", async (_event, filePath: string) => {
      return this.isDirectory(filePath);
    });
  }

  async getFileMetadata(
    filePath: string
  ): Promise<{ size: number; lastModified: number } | undefined> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return undefined;
      return {
        size: stats.size,
        lastModified: stats.mtimeMs,
      };
    } catch (_) {
      return undefined;
    }
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch (_) {
      return false;
    }
  }
}

function fileOpsModule(...args: ConstructorParameters<typeof FileOpsModule>) {
  return new FileOpsModule(...args);
}

export { fileOpsModule };
