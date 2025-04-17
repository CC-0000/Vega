import { app } from "electron";
import Store from "electron-store";
import { safeStorage, ipcMain } from "electron";
import type { AppModule } from "../AppModule.js";

interface SecretStore {
  setSecret: (key: string, value: string) => boolean;
  getSecret: (key: string) => string | undefined;
  deleteSecret: (key: string) => void;
  secretLogin: (
    certificate: string,
    privateKey: string,
    userId: string
  ) => boolean;
  secretLogout: () => void;
  storeSecretObject: <T>(key: string, value: T) => void;
  getSecretObject: <T>(key: string) => T | undefined;
  deleteSecretObject: (key: string) => void;
}

const store = new Store<{ [key: string]: string }>({
  name: "secrets",
  cwd: app.getPath("userData"),
});

class SecretsModule implements AppModule, SecretStore {
  enable(): void {
    // Secrets module ready; could register IPC handlers here if needed.
    ipcMain.handle("secrets:get", (_event, key: string) => this.getSecret(key));
    ipcMain.handle("secrets:set", (_event, key: string, value: string) =>
      this.setSecret(key, value)
    );
    ipcMain.handle(
      "secrets:login",
      (_event, certificate: string, privateKey: string, userId: string) =>
        this.secretLogin(certificate, privateKey, userId)
    );
    ipcMain.handle("secrets:delete", (_event, key: string) =>
      this.deleteSecret(key)
    );
    ipcMain.handle("secrets:logout", (_event) => this.secretLogout());
    ipcMain.handle(
      "secrets:storeSecretObject",
      (_event, key: string, value: any) => this.storeSecretObject(key, value)
    );
    ipcMain.handle("secrets:getSecretObject", (_event, key: string) =>
      this.getSecretObject(key)
    );
    ipcMain.handle("secrets:deleteSecretObject", (_event, key: string) =>
      this.deleteSecretObject(key)
    );
  }

  secretLogin(
    certificate: string,
    privateKey: string,
    userId: string
  ): boolean {
    if (!this.setSecret("certificate", certificate)) return false;
    if (!this.setSecret("privateKey", privateKey)) return false;
    if (!this.setSecret("userId", userId)) return false;
    return true;
  }

  secretLogout(): void {
    this.deleteSecret("certificate");
    this.deleteSecret("privateKey");
    this.deleteSecret("userId");
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

  storeSecretObject<T>(key: string, value: T): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const serializedValue = JSON.stringify(value);
    const encryptedValue = safeStorage.encryptString(serializedValue);
    store.set(key, encryptedValue.toString("base64"));
    return true;
  }

  getSecretObject<T>(key: string): T | undefined {
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    const encryptedValue = store.get(key);
    if (!encryptedValue) return undefined;

    try {
      const buffer = Buffer.from(encryptedValue, "base64");
      const decryptedString = safeStorage.decryptString(buffer);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      return undefined;
    }
  }

  deleteSecretObject(key: string): void {
    store.delete(key);
  }
}

function secretsModule(...args: ConstructorParameters<typeof SecretsModule>) {
  return new SecretsModule(...args);
}

export { secretsModule };

// Singleton instance for direct use
const secrets = new SecretsModule();

// Export bound methods for easy import
export const setSecret = secrets.setSecret.bind(secrets);
export const getSecret = secrets.getSecret.bind(secrets);
export const secretLogin = secrets.secretLogin.bind(secrets);
export const secretLogout = secrets.secretLogout.bind(secrets);
export const storeSecretObject = secrets.storeSecretObject.bind(secrets);
export const getSecretObject = secrets.getSecretObject.bind(secrets);
export const deleteSecretObject = secrets.deleteSecretObject.bind(secrets);
