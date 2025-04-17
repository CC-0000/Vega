import { sha256sum } from "./nodeCrypto.js";
import { versions } from "./versions.js";
import { ipcRenderer } from "electron";

// Functions
function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}

function setSecret(key: string, value: string) {
  return ipcRenderer.invoke("secrets:set", key, value);
}

function getSecret(key: string) {
  return ipcRenderer.invoke("secrets:get", key);
}

function deleteSecret(key: string) {
  return ipcRenderer.invoke("secrets:delete", key);
}

function secretLogin(certificate: string, privateKey: string, userId: string) {
  return ipcRenderer.invoke("secrets:login", certificate, privateKey, userId);
}

function secretLogout() {
  return ipcRenderer.invoke("secrets:logout");
}

function storeSecretObject(key: string, value: any) {
  return ipcRenderer.invoke("secrets:storeSecretObject", key, value);
}

function getSecretObject(key: string) {
  return ipcRenderer.invoke("secrets:getSecretObject", key);
}

function deleteSecretObject(key: string) {
  return ipcRenderer.invoke("secrets:deleteSecretObject", key);
}

async function getFileMetadata(
  filePath: string
): Promise<{ size: number; lastModified: number } | undefined> {
  return ipcRenderer.invoke("fileops:getMetadata", filePath);
}

async function isDirectory(filePath: string): Promise<boolean> {
  return ipcRenderer.invoke("fileops:isDirectory", filePath);
}

async function makeCrawlRequest(): Promise<void> {
  return ipcRenderer.invoke("mqtt:makeCrawlRequest");
}

function connectToMQTT(): void {
  ipcRenderer.invoke("mqtt:connectToMQTT");
}

async function showOpenDialog(options: Electron.OpenDialogOptions) {
  return ipcRenderer.invoke("dialog:showOpenDialog", options);
}

// Callbacks
function onMqttStatus(
  callback: (payload: { status: "connected" | "disconnected" }) => void
) {
  ipcRenderer.on("mqtt:status", (_event, payload) => callback(payload));
}

export {
  sha256sum,
  versions,
  send,
  setSecret,
  getSecret,
  deleteSecret,
  secretLogin,
  secretLogout,
  storeSecretObject,
  getSecretObject,
  deleteSecretObject,
  getFileMetadata,
  isDirectory,
  makeCrawlRequest,
  connectToMQTT,
  showOpenDialog,
  onMqttStatus,
};
