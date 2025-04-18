import * as mqtt from "mqtt";
import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import {
  TextChunk,
  splitContentIntoSemanticChunks,
  splitPagedContentIntoSemanticChunks,
} from "./chunkUtils.js";
import * as proto from "../protos/vega.js";
import {
  extractTxtContent,
  extractPdfContent,
  extractPdfContentSinglePage,
  extractTextFromOfficeFile,
} from "./fileUtils.js";
import {
  getAllAllowedFiles,
  getFileHash,
  getFileHashes,
} from "./helperUtils.js";
import { getSecretObject } from "../modules/Secrets.js";

export interface MqttTlsOptions {
  ca?: Buffer | string; // CA certificate
  cert?: Buffer | string; // Client certificate
  key?: Buffer | string; // Client private key
  rejectUnauthorized?: boolean; // Whether to reject self-signed certificates
  passphrase?: string; // Optional passphrase for private key
}

export interface MqttOptions {
  host: string;
  port: number;
  clientId?: string;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
  protocol?: "mqtts";
  tls?: MqttTlsOptions;
  userId: string;
}

export class MqttClient extends EventEmitter {
  /**
   * Publish a message to MQTT with QoS 2 and await broker confirmation.
   * @param topic The topic to publish to
   * @param payload The Buffer payload to send
   */
  private async send(topic: string, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 2 }, (err) => {
        if (err) {
          console.error(`Failed to publish to ${topic}:`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  private client: mqtt.MqttClient | null = null;

  private options: MqttOptions;

  private connected: boolean = false;

  private uploadingFiles: boolean = false;

  private crawlReqTopic = "";

  private queryReqTopic = "";

  private newChunkTopic = "";

  private newCrawlTopic = "";

  private queryResTopic = "";

  constructor(options: MqttOptions) {
    super();
    this.options = options;

    // set up the topics
    this.crawlReqTopic = `crawl_req/${this.options.userId}`;
    this.queryReqTopic = `query_req/${this.options.userId}`;
    this.newChunkTopic = `new_chunk/${this.options.userId}`;
    this.newCrawlTopic = `new_crawl/${this.options.userId}`;
    this.queryResTopic = `query_res/${this.options.userId}`;
  }

  /**
   * Connect to the MQTT broker
   */
  public connect(): void {
    const { host, port, protocol = "mqtts", ...restOptions } = this.options;
    const connectUrl = `${protocol}://${host}:${port}`;

    this.client = mqtt.connect(connectUrl, {
      clientId:
        this.options.clientId ||
        `mqtt_client_${Math.random().toString(16).substring(2, 10)}`,

      clean: this.options.clean !== undefined ? this.options.clean : true,

      connectTimeout: this.options.connectTimeout || 4000,

      reconnectPeriod: this.options.reconnectPeriod || 1000,

      rejectUnauthorized:
        this.options.tls?.rejectUnauthorized !== undefined
          ? this.options.tls.rejectUnauthorized
          : true,

      ca: this.options.tls?.ca,

      cert: this.options.tls?.cert,

      key: this.options.tls?.key,

      ...restOptions,
    });

    this.client.on("connect", () => {
      this.connected = true;
      this.emit("Connected");

      this.setupSubscriptions();
    });

    this.client.on("close", () => {
      this.connected = false;
      this.emit("Disconnected");
    });

    this.client.on("error", (error) => {
      console.error("MQTT client error:", error);
    });

    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  /**
   * Setup all topic subscriptions
   * All subscriptions should be defined here
   */
  private setupSubscriptions(): void {
    if (!this.client || !this.connected) {
      return;
    }

    this.client.subscribe(this.crawlReqTopic, (err) => {
      if (err) console.error("Failed to subscribe to crawl_req:", err);
    });

    this.client.subscribe(this.queryReqTopic, (err) => {
      if (err) console.error("Failed to subscribe to query_req:", err);
    });
  }

  /**
   * Handle incoming messages from subscribed topics
   * @param topic The MQTT topic on which the message was received
   * @param message The message payload as a Buffer
   */
  private handleMessage(topic: string, message: Buffer): void {
    switch (topic) {
      case this.crawlReqTopic:
        this.handleCrawlRequest(message);
        break;

      case this.queryReqTopic:
        this.handleQueryRequest(message);
        break;

      default:
        console.log(`Received message on unhandled topic ${topic}: ${message}`);
    }
  }

  /**
   * Process a file by breaking it into semantic chunks and publishing them
   * chunks and sends the chunks in order
   * @param filePath Path to the file to be processed
   */
  private async chunkFile(filePath: string): Promise<void> {
    try {
      // Get file stats to extract creation and modification dates
      const stats = await fs.stat(filePath);
      const dateCreated = stats.birthtime;
      const dateLastModified = stats.mtime;
      const fileHash = await getFileHash(filePath);

      // Extract text based on file type
      let chunks: TextChunk[] = [];
      switch (path.extname(filePath).toLowerCase()) {
        case ".pdf":
          const pagedContent = await extractPdfContent(filePath);
          chunks = splitPagedContentIntoSemanticChunks(pagedContent, fileHash);
          break;
        case ".txt":
          const content = await extractTxtContent(filePath);
          chunks = splitContentIntoSemanticChunks(content, fileHash);
          break;
        case ".docx":
        case ".pptx":
        case ".xlsx":
        case ".odt":
        case ".odp":
        case ".ods":
          const officeContent = await extractTextFromOfficeFile(filePath);
          chunks = splitContentIntoSemanticChunks(officeContent, fileHash);
          break;
        default:
          console.error(`Unsupported file type: ${path.extname(filePath)}`);
          return;
      }

      // Get filename for title
      const title = path.basename(filePath);

      // grab the userId from the passed in options
      const { userId } = this.options;

      // Determine platform - assuming local for this example
      const platform = proto.Platform.PLATFORM_LOCAL;

      // Publish each chunk with metadata
      for (const chunk of chunks) {
        const textChunkMessage = proto.TextChunkMessage.create({
          metadata: {
            dateCreated,
            dateLastModified,
            userId,
            filePath,
            start: chunk.startOffset,
            end: chunk.endOffset,
            title,
            platform,
            chunkId: chunk.chunkId,
          },
          content: chunk.text,
        });

        const serializedMessage =
          proto.TextChunkMessage.encode(textChunkMessage).finish();
        const messageBuffer = Buffer.from(serializedMessage);

        await this.send(this.newChunkTopic, messageBuffer);
      }

      // Send the file_done message after all chunks are processed
      const fileDoneMessage = proto.TextChunkMessage.create({
        metadata: {
          dateCreated,
          dateLastModified,
          userId,
          filePath,
          start: 0,
          end: 0,
          title,
          platform,
        },
        content: "<file_done>",
      });

      const serializedFileDoneMessage =
        proto.TextChunkMessage.encode(fileDoneMessage).finish();
      const fileDoneBuffer = Buffer.from(serializedFileDoneMessage);

      await this.send(this.newChunkTopic, fileDoneBuffer);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  /**
   * Processes crawl requests by chunking files and publishing them to MQTT
   *
   * @param message The protobuf binary message containing file paths to process
   */
  private async handleCrawlRequest(message: Buffer): Promise<void> {
    if (this.uploadingFiles) {
      return;
    }
    this.uploadingFiles = true;

    try {
      // Parse the protobuf message
      const crawlRequest = proto.NewCrawl.decode(message);

      // Process each filepath in parallel
      await Promise.all(
        crawlRequest.filePaths.map((filePath: string) =>
          this.chunkFile(filePath)
        )
      );

      // Create a crawl done message
      const crawlDoneMessage = proto.TextChunkMessage.create({
        metadata: {
          userId: this.options.userId,
          platform: proto.Platform.PLATFORM_LOCAL,
        },
        content: "<crawl_done>",
      });

      // Serialize the message
      const serializedMessage =
        proto.TextChunkMessage.encode(crawlDoneMessage).finish();
      const messageBuffer = Buffer.from(serializedMessage);

      // Publish the message
      await this.send(this.newChunkTopic, messageBuffer);
    } catch (error) {
      console.error("Error processing crawl request:", error);
    } finally {
      this.uploadingFiles = false;
    }
  }

  /**
   * Handle query request messages to retrieve specific chunks of data from files
   * @param message The protobuf message buffer containing the query request
   */
  private async handleQueryRequest(message: Buffer): Promise<void> {
    try {
      // 1. Parse the incoming message
      const queryRequest: proto.QueryRequestMessage =
        proto.QueryRequestMessage.decode(message);
      const { requestId, requestedChunks } = queryRequest;

      // 2. Prepare the response object
      const responseChunks: proto.TextChunkMessage[] = [];

      // 3. Organize work by grouping requested chunks by file path
      const chunksByFile = new Map<string, proto.Metadata[]>();
      requestedChunks.forEach((chunk: proto.Metadata) => {
        const { filePath } = chunk;
        if (!filePath) {
          console.error("Invalid chunk: Missing filePath");
          return;
        }
        if (!chunksByFile.has(filePath)) {
          chunksByFile.set(filePath, []);
        }
        chunksByFile.get(filePath)!.push(chunk);
      });

      // 4. Process each file using Promise.all with array methods
      const fileProcessingTasks = Array.from(chunksByFile.entries()).map(
        async ([filePath, chunksForFile]) => {
          try {
            // Check if file exists asynchronously
            try {
              await fs.stat(filePath);
            } catch (statError: any) {
              if (statError.code === "ENOENT") {
                console.error(`File not found: ${filePath}`);
                return;
              }
              throw statError;
            }

            // Read file content
            let isPdfFlag: boolean = false;
            let fileContent = "";
            let fileBufferContent = null;

            switch (path.extname(filePath).toLowerCase()) {
              case ".pdf":
                isPdfFlag = true;
                fileBufferContent = await fs.readFile(filePath);
                break;
              case ".txt":
                fileContent = await extractTxtContent(filePath);
                break;
              case ".docx":
              case ".pptx":
              case ".xlsx":
              case ".odt":
              case ".odp":
              case ".ods":
                fileContent = await extractTextFromOfficeFile(filePath);
                break;
              default:
                console.error(
                  `Unsupported file type: ${path.extname(filePath)}`
                );
                return;
            }

            // Create promises for processing each chunk
            const chunkPromises = chunksForFile.map(async (chunkMetadata) => {
              const { start = 0, end = 0, chunkId } = chunkMetadata;
              const pageNum = parseInt(
                (chunkId || "").split("-").pop() || "0",
                10
              );

              // Only process if we have valid values
              if (typeof start !== "number" || typeof end !== "number") {
                console.error(
                  `Missing valid start/end values for chunk in file ${filePath}`
                );
                return null;
              }

              let pageContent = "";
              try {
                if (isPdfFlag) {
                  pageContent = await extractPdfContentSinglePage(
                    filePath,
                    pageNum,
                    fileBufferContent!
                  );
                  pageContent = pageContent.substring(start, end);
                } else {
                  if (start < 0 || end > fileContent.length || start >= end) {
                    console.error(
                      `Invalid chunk boundaries for file ${filePath}, chunk ${chunkId}`
                    );
                    return null;
                  }
                  pageContent = fileContent.substring(start, end);
                }
                return {
                  metadata: chunkMetadata,
                  content: pageContent,
                };
              } catch (chunkError) {
                console.error(
                  `Error processing chunk ${chunkId} for file ${filePath}:`,
                  chunkError
                );
                return null;
              }
            });

            // Wait for all chunk promises for this file to resolve
            const processedChunks = await Promise.all(chunkPromises);

            // Filter out any null results (errors during chunk processing)
            const validChunks = processedChunks.filter(
              (chunk) => chunk !== null
            ) as { metadata: proto.Metadata; content: string }[];
            responseChunks.push(...validChunks);
          } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
          }
        }
      );

      // 5. Wait for all tasks to finish
      await Promise.all(fileProcessingTasks);

      // 6. Create and send the response
      const queryResponse: proto.QueryResponseMessage = {
        requestId,
        textChunks: responseChunks,
      };

      // 7. Serialize the response
      const serializedResponse =
        proto.QueryResponseMessage.encode(queryResponse).finish();
      const responseBuffer = Buffer.from(serializedResponse);

      // 8. Send the response
      await this.send(this.queryResTopic, responseBuffer);
    } catch (error) {
      console.error("Error parsing query request:", error);
    }
  }

  /**
   * ========================================
   * Public API - Callable functions
   * ========================================
   * The following methods are exposed as the public interface
   * for interacting with the MQTT client.
   */

  public async makeCrawlRequest(): Promise<void> {
    if (!this.isConnected()) {
      console.warn("MQTT client not connected. Skipping makeCrawlRequest.");
      return;
    }
    // get the list of folder and file paths from the electron store
    const syncedFolderPaths =
      (getSecretObject("syncedFolderPaths") as string[]) ?? [];

    const syncedFilePaths =
      (getSecretObject("syncedFilePaths") as string[]) ?? [];

    const allFilePaths = await getAllAllowedFiles(
      syncedFolderPaths,
      syncedFilePaths
    );
    const allFileHashes = await getFileHashes(allFilePaths);

    // Create the crawl request
    const crawlRequest: proto.NewCrawl = {
      filePaths: allFilePaths,
      fileHashes: allFileHashes,
    };

    // Serialize and send the request
    const serializedMessage = proto.NewCrawl.encode(crawlRequest).finish();
    const messageBuffer = Buffer.from(serializedMessage);

    await this.send(this.newCrawlTopic, messageBuffer);
  }

  /**
   * Disconnect from the MQTT broker
   */
  public disconnect(): void {
    if (!this.client) {
      return;
    }

    // Remove all listeners to avoid leaks or duplicate handlers on reconnect
    this.client.removeAllListeners();
    this.client.end(false, () => {
      this.connected = false;
      this.client = null;
      this.emit("Disconnected");
    });
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    return this.connected;
  }
}
