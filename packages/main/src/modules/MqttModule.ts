import type { AppModule } from "../AppModule.js";
import { MqttClient } from "../utils/mqttUtils.js";
import { getSecret } from "../modules/Secrets.js";
import { ipcMain, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";

/**
 * Converts a base64-encoded certificate to PEM format
 *
 * @param base64Certificate - The certificate string in base64 format or already in PEM format
 * @returns The certificate in PEM format with proper headers and footers
 */
function convertBase64CertificateToPem(base64Certificate: string): string {
  if (base64Certificate.includes("-----BEGIN CERTIFICATE-----")) {
    // Already in PEM format
    return base64Certificate;
  }
  // Decode base64 and convert to PEM format
  const decodedCert = Buffer.from(base64Certificate, "base64").toString(
    "utf-8"
  );
  // Check if the decoded content already has PEM headers
  return decodedCert.includes("-----BEGIN CERTIFICATE-----")
    ? decodedCert
    : `-----BEGIN CERTIFICATE-----\n${decodedCert}\n-----END CERTIFICATE-----`;
}

class MqttModule implements AppModule {
  private mqttClient: MqttClient | undefined;

  enable(): void {
    ipcMain.handle("mqtt:makeCrawlRequest", async () => {
      if (this.mqttClient !== undefined && this.mqttClient.isConnected()) {
        await this.mqttClient.makeCrawlRequest();
        return;
      }
      return;
    });
    ipcMain.handle("mqtt:connectToMqtt", () => {
      this.connectToMQTT();
      return;
    });
    ipcMain.handle("mqtt:getStatus", () => {
      if (this.mqttClient !== undefined && this.mqttClient.isConnected()) {
        return "connected";
      }
      return "disconnected";
    });
  }

  connectToMQTT() {
    // if the mqtt client is connected already we want to disconnect from it and then connect
    if (this.mqttClient !== undefined && this.mqttClient.isConnected()) {
      this.mqttClient.disconnect();
    }

    // Retrieve certificate and private key from secure store
    const privateKeyPem = getSecret("privateKey");
    const certificateBase64 = getSecret("certificate");
    const userId = getSecret("userId");

    if (!privateKeyPem || !certificateBase64 || !userId) {
      return;
    }

    // Decode the base64 encoded certificate and convert to PEM format if needed
    const certificatePem = convertBase64CertificateToPem(certificateBase64);

    this.mqttClient = new MqttClient({
      host: "localhost",
      port: 8883,
      protocol: "mqtts",
      tls: {
        ca: fs.readFileSync(new URL("../certs/ca.crt", import.meta.url)),
        cert: certificatePem,
        key: privateKeyPem,
      },
      userId,
    });

    this.mqttClient.on("Connected", () => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("mqtt:status", { status: "Connected" });
      });
    });

    this.mqttClient.on("Disconnected", () => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("mqtt:status", { status: "Disconnected" });
      });
    });

    // Connect to broker
    this.mqttClient.connect();
  }
}

function mqttModule(...args: ConstructorParameters<typeof MqttModule>) {
  return new MqttModule(...args);
}

export { mqttModule };
