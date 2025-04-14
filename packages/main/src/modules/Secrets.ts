import { app } from "electron";
import Store from "electron-store";
import { safeStorage } from "electron";
import type { AppModule } from "../AppModule.js";

interface SecretStore {
  setSecret: (key: string, value: string) => boolean;
  getSecret: (key: string) => string | undefined;
  deleteSecret: (key: string) => void;
}

const store = new Store<{ [key: string]: string }>({
  name: "secrets",
  cwd: app.getPath("userData"),
});

class SecretsModule implements AppModule, SecretStore {
  enable(): void {
    // Secrets module ready; could register IPC handlers here if needed.
  }

  setSecret(key: string, value: string): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const encrypted = safeStorage.encryptString(value).toString("base64");
    store.set(key, encrypted);
    return true;
  }

  getSecret(key: string): string | undefined {
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    const encrypted = store.get(key);
    if (!encrypted) return undefined;
    try {
      const buffer = Buffer.from(encrypted, "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      return undefined;
    }
  }

  deleteSecret(key: string): void {
    store.delete(key);
  }
}

function secretsModule(...args: ConstructorParameters<typeof SecretsModule>) {
  return new SecretsModule(...args);
}

export { secretsModule };
