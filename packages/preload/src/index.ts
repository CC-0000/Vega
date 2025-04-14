import {sha256sum} from './nodeCrypto.js';
import {versions} from './versions.js';
import {ipcRenderer} from 'electron';

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

export { sha256sum, versions, send, setSecret, getSecret, deleteSecret };
