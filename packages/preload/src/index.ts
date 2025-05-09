import { sha256sum } from "./nodeCrypto.js";
import { versions } from "./versions.js";
import { ipcRenderer } from "electron";

// Functions
function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}

async function getAppConstants(): Promise<{
  ALLOWED_EXTENSIONS: string[];
  API_ENDPOINT: string;
}> {
  return ipcRenderer.invoke("app:getConstants");
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

function secretLogin(
  certificate: string,
  privateKey: string,
  userId: string,
  alias: string
) {
  return ipcRenderer.invoke(
    "secrets:login",
    certificate,
    privateKey,
    userId,
    alias
  );
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

async function connectToMqtt(): Promise<void> {
  return ipcRenderer.invoke("mqtt:connectToMqtt");
}

async function disconnectFromMqtt(): Promise<void> {
  return ipcRenderer.invoke("mqtt:disconnectFromMqtt");
}

function getMqttStatus(): Promise<string> {
  return ipcRenderer.invoke("mqtt:getStatus");
}

async function showOpenDialog(options: Electron.OpenDialogOptions) {
  return ipcRenderer.invoke("dialog:showOpenDialog", options);
}

// Callbacks
function onMqttStatus(
  callback: (payload: { status: "Connected" | "Disconnected" }) => void
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
  connectToMqtt,
  disconnectFromMqtt,
  getMqttStatus,
  showOpenDialog,
  onMqttStatus,
  getAppConstants,
};
