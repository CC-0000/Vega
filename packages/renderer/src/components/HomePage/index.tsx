import "./styles.css";
import { useEffect, useState } from "react";
import {
  Cloud,
  Folder,
  MinusCircle,
  File,
  FilePlus,
  FolderPlus,
  LogOut,
  RefreshCw,
  Info,
  Home,
  User,
} from "react-feather";
import { useAuth } from "../../context/AuthContext.defs";
import {
  getSecretObject,
  getFileMetadata,
  isDirectory,
  makeCrawlRequest,
  storeSecretObject,
  showOpenDialog,
  onMqttStatus,
  getMqttStatus,
  getAppConstants,
} from "@app/preload";

interface FileItem {
  name: string;
  type: "file";
  size: string;
  lastModified: string;
  path: string;
}

interface FolderItem {
  name: string;
  type: "folder";
  path: string;
}

function HomePage() {
  const [currentHour, setCurrentHour] = useState<number>(new Date().getHours());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60_000); // update every minute
    return () => clearInterval(interval);
  }, []);
  const { logout, alias } = useAuth();
  const [mqttStatus, setMqttStatus] = useState<string>("Unknown");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([]);

  /**
   * Formats file size in bytes to a human-readable format
   * @param bytes File size in bytes
   * @returns Formatted file size string (e.g., "2.4 MB")
   */
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Formats timestamp to a human-readable last modified date
   * @param timestamp Last modified timestamp in milliseconds
   * @returns Formatted date string
   */
  function formatLastModified(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();

    // If the file was modified today
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }

    // If the file was modified yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    // If the file was modified this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }

    // Otherwise show the full date
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getFileName(filePath: string): string {
    const fullFileName = filePath.split("/").pop() || filePath;
    const fileName = fullFileName.includes(".")
      ? fullFileName.substring(0, fullFileName.lastIndexOf("."))
      : fullFileName;
    return fileName;
  }

  useEffect(() => {
    // Load allowed extensions from global config
    getAppConstants().then(({ ALLOWED_EXTENSIONS }) => {
      setAllowedExtensions(ALLOWED_EXTENSIONS);
    });

    // First get the current status
    getMqttStatus()
      .then((status) => {
        setMqttStatus(status);
        return undefined;
      })
      .catch((error) => {
        setMqttStatus(error);
      });

    // Then set up listener for future changes
    onMqttStatus(({ status }) => setMqttStatus(status));

    // Load synced folder paths from secure storage
    async function loadSyncedFolders() {
      try {
        const storedFolderPaths = await getSecretObject("syncedFolderPaths");
        if (storedFolderPaths) {
          // Create folder items from the stored paths
          const folderItems = storedFolderPaths.map((path: string) => {
            const folderName = path.split("/").pop() || path;
            return { name: folderName, type: "folder" as const, path };
          });

          setFolders(folderItems);
        } else {
          setFolders([]);
        }
      } catch (error) {
        console.error("Failed to load synced folder paths:", error);
        setFolders([]);
      }
    }

    // Load synced file paths from secure storage
    async function loadSyncedFiles() {
      try {
        const storedFilePaths = await getSecretObject("syncedFilePaths");
        if (storedFilePaths) {
          // Create file items from the stored paths with actual metadata
          const fileItemsPromises = storedFilePaths.map(
            async (filePath: string) => {
              // Extract file info from path
              const fileName = getFileName(filePath);
              // Get actual file metadata using the preload API
              const metadata = await getFileMetadata(filePath);

              // Format file size
              const fileSize = metadata
                ? formatFileSize(metadata.size)
                : "Unknown";
              // Format last modified date
              const lastModified = metadata
                ? formatLastModified(metadata.lastModified)
                : "Unknown";

              return {
                name: fileName,
                type: "file" as const,
                size: fileSize,
                lastModified,
                path: filePath,
              };
            }
          );

          // Wait for all metadata to be fetched
          const fileItems = await Promise.all(fileItemsPromises);

          setFiles(fileItems);
        } else {
          setFiles([]);
        }
      } catch (error) {
        console.error("Failed to load synced file paths:", error);
        setFiles([]);
      }
    }

    loadSyncedFolders();
    loadSyncedFiles();

    return () => {
      // if (removeListener) removeListener();
    };
  }, []);

  function getFileExtension(filePath: string): string {
    const parts = filePath.split(".");
    if (parts.length > 1) {
      const extension = parts[parts.length - 1].toLowerCase();
      return extension.length > 4 ? extension.substring(0, 4) : extension;
    }
    return "";
  }

  function shortenPath(path: string): string {
    // Get the parts of the path
    const parts = path.split("/");

    // If the path is short enough, just return it
    if (parts.length <= 3) {
      return path;
    }

    // Otherwise, keep only the last 2 parts with ellipsis at the beginning
    return `.../${parts.slice(-2).join("/")}`;
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to clear authentication state:", error);
    }
  }

  async function handleRefresh() {
    // callback function for the re-index button
    makeCrawlRequest();
  }

  function handleRemoveFolder(folderPath: string) {
    // Implement the folder removal logic
    // First filter out the folder from the state
    const updatedFolders = folders.filter(
      (folder) => folder.path !== folderPath
    );
    setFolders(updatedFolders);

    // Then update the storage
    getSecretObject("syncedFolderPaths")
      .then((storedPaths) => {
        if (storedPaths) {
          // Filter out the matching path
          const updatedPaths = storedPaths.filter(
            (path: string) => path !== folderPath
          );

          // Store the updated paths
          return storeSecretObject("syncedFolderPaths", updatedPaths);
        }
        return undefined;
      })
      .catch((error) => {
        console.error("Failed to remove folder from storage:", error);
      });
  }

  /**
   * Filters paths to only include directories
   * @param dirPaths Array of paths to filter
   * @returns Promise resolving to array of directory paths
   */
  async function filterDirectories(dirPaths: string[]): Promise<string[]> {
    // Use Promise.all to run directory checks in parallel
    const directoryChecks = await Promise.all(
      dirPaths.map(async (path) => ({
        path,
        isDir: await isDirectory(path),
      }))
    );

    // Filter paths that are directories
    return directoryChecks
      .filter((item) => item.isDir)
      .map((item) => item.path);
  }

  async function handleAddFolders() {
    try {
      // Open folder selection dialog using IPC renderer
      const result = await showOpenDialog({
        properties: ["openDirectory", "multiSelections"],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        // Filter the selected directories
        const filteredFolderPaths = await filterDirectories(result.filePaths);

        if (filteredFolderPaths.length === 0) {
          return;
        }

        // Get existing folder paths from secure storage
        let existingFolderPaths: string[] = [];
        try {
          const storedPaths = await getSecretObject("syncedFolderPaths");
          if (storedPaths) {
            existingFolderPaths = storedPaths;
          }
        } catch (error) {
          console.error("Error retrieving existing folder paths:", error);
        }

        // Combine existing and new paths, removing duplicates
        const updatedFolderPaths = [
          ...new Set([...existingFolderPaths, ...filteredFolderPaths]),
        ];

        // Store the updated paths in secure storage
        await storeSecretObject("syncedFolderPaths", updatedFolderPaths);

        // Update folders state with new folder items
        const folderItems = updatedFolderPaths.map((path: string) => {
          const folderName = path.split("/").pop() || path;
          return { name: folderName, type: "folder" as const, path };
        });

        setFolders(folderItems);
      }
    } catch (error) {
      console.error("Failed to add folders:", error);
    }
  }

  /**
   * Checks if a file has an allowed extension
   * @param filePath Path to the file
   * @returns Boolean indicating if the file extension is allowed
   */
  function hasAllowedExtension(filePath: string): boolean {
    const extension = getFileExtension(filePath).toLowerCase();
    return allowedExtensions.includes(extension);
  }

  /**
   * Filters paths to only include files with allowed extensions
   * @param filePaths Array of paths to filter
   * @returns Promise resolving to array of valid file paths
   */
  async function filterFiles(filePaths: string[]): Promise<string[]> {
    // Use Promise.all to run file checks in parallel
    const fileChecks = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        isDir: await isDirectory(path),
        hasValidExtension: hasAllowedExtension(path),
      }))
    );

    // Filter paths that are not directories and have allowed extensions
    return fileChecks
      .filter((item) => !item.isDir && item.hasValidExtension)
      .map((item) => item.path);
  }

  async function handleAddFiles() {
    try {
      // Create file filters for the dialog
      const fileFilters = [
        {
          name: "Allowed Files",
          extensions: allowedExtensions,
        },
      ];

      // Open file selection dialog using IPC renderer with filters
      const result = await showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: fileFilters,
      });

      if (!result.canceled && result.filePaths.length > 0) {
        // Filter the selected files
        const filteredFilePaths = await filterFiles(result.filePaths);

        if (filteredFilePaths.length === 0) {
          return;
        }

        // Get existing file paths from secure storage
        let existingFilePaths: string[] = [];
        try {
          const storedPaths = await getSecretObject("syncedFilePaths");
          if (storedPaths) {
            existingFilePaths = storedPaths;
          }
        } catch (error) {
          console.error("Error retrieving existing file paths:", error);
        }

        // Combine existing and new paths, removing duplicates
        const updatedFilePaths = [
          ...new Set([...existingFilePaths, ...filteredFilePaths]),
        ];

        // Store the updated paths in secure storage
        await storeSecretObject("syncedFilePaths", updatedFilePaths);

        // Update files state with new file items including actual metadata
        const fileItemsPromises = updatedFilePaths.map(async (path: string) => {
          // Extract file name from path
          const fileName = getFileName(path);
          // Get actual file metadata
          const metadata = await getFileMetadata(path);

          // Format file size
          const fileSize = metadata ? formatFileSize(metadata.size) : "Unknown";
          // Format last modified date
          const lastModified = metadata
            ? formatLastModified(metadata.lastModified)
            : "Unknown";

          return {
            name: fileName,
            type: "file" as const,
            size: fileSize,
            lastModified,
            path,
          };
        });

        // Wait for all metadata to be fetched
        const fileItems = await Promise.all(fileItemsPromises);

        setFiles(fileItems);
      }
    } catch (error) {
      console.error("Failed to add files:", error);
    }
  }

  function handleRemoveFile(filePath: string) {
    // First filter out the file from the state
    const updatedFiles = files.filter((file) => file.path !== filePath);
    setFiles(updatedFiles);

    // Then update the storage
    getSecretObject("syncedFilePaths")
      .then((storedPaths) => {
        if (storedPaths) {
          // Filter out the matching path
          const updatedPaths = storedPaths.filter(
            (path: string) => path !== filePath
          );

          // Store the updated paths
          return storeSecretObject("syncedFilePaths", updatedPaths);
        }
        return undefined;
      })
      .catch((error) => {
        console.error("Failed to remove file from storage:", error);
      });
  }

  return (
    <div className="home-container">
      <div className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-icon active">
            <Home size={24} />
          </div>
          <div className="sidebar-icon">
            <User size={24} />
          </div>
          <div className="sidebar-icon">
            <Info size={24} />
          </div>
        </div>
        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-icon logout-icon"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <div className="mqtt-status">
            <div className="tooltip-container">
              <Cloud
                className={`status-icon status-${mqttStatus}`}
                onMouseMove={(e) => {
                  setTooltipPosition({
                    x: e.clientX + 10,
                    y: e.clientY,
                  });
                }}
              />
              <div
                className={`tooltip tooltip-${mqttStatus}`}
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                }}
              >
                <span className="tooltip-status">Status:</span> {mqttStatus}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
            <span>Re-index</span>
          </button>
        </div>

        <div className="file-explorer">
          <h1>{getGreetingForHour(currentHour)}, {alias}</h1>

          <div className="action-buttons">
            <button
              type="button"
              className="action-button tooltip-container"
              onClick={handleAddFolders}
              onMouseMove={(e) => {
                setTooltipPosition({
                  x: e.clientX + 10,
                  y: e.clientY,
                });
                setActiveTooltip("folder");
              }}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <FolderPlus size={16} />
              <span>Add Folders</span>
              {activeTooltip === "folder" && (
                <div
                  className="tooltip tooltip-action"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                  }}
                >
                  Select folders to sync with Indeq!
                </div>
              )}
            </button>

            <button
              type="button"
              className="action-button tooltip-container"
              onClick={handleAddFiles}
              onMouseMove={(e) => {
                setTooltipPosition({
                  x: e.clientX + 10,
                  y: e.clientY,
                });
                setActiveTooltip("file");
              }}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <FilePlus size={16} />
              <span>Add Files</span>
              {activeTooltip === "file" && (
                <div
                  className="tooltip tooltip-action"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                  }}
                >
                  Select files to sync with Indeq!
                </div>
              )}
            </button>
          </div>

          <div className="folders-section">
            <h2>Folders</h2>
          </div>
          <div className="folders-grid">
            {folders.length > 0 ? (
              folders.map((folder) => (
                <div key={folder.path} className="folder-item">
                  <div className="folder-icon">
                    <Folder
                      size={48}
                      color="var(--primary-color)"
                      strokeWidth={1}
                    />
                  </div>
                  <div className="folder-info">
                    <div className="folder-name">{folder.name}</div>
                    <div className="folder-path">
                      {shortenPath(folder.path)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="folder-remove-button"
                    onClick={() => handleRemoveFolder(folder.path)}
                    aria-label={`Remove ${folder.name} folder`}
                  >
                    <MinusCircle size={20} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Folder size={48} color="#cbd5e1" strokeWidth={1} />
                </div>
                <p className="empty-state-text">
                  You haven&apos;t added any folders yet
                </p>
                <p className="empty-state-subtext">
                  Click on &quot;Add Files & Folders&quot; to get started
                </p>
              </div>
            )}
          </div>

          <div className="files-section">
            <h2>Files</h2>
            <span className="tooltip-container file-extensions-icon">
              <Info size={16} />
              <div className="tooltip tooltip-action">
                <span>
                  Allowed file extensions: {allowedExtensions.join(", ")}
                </span>
              </div>
            </span>
            {files.length > 0 ? (
              <div className="files-list">
                {files.map((file) => (
                  <div key={file.path} className="file-item">
                    <div className="file-icon">
                      <File
                        size={24}
                        color="var(--accent-coral)"
                        strokeWidth={1}
                      />
                      {getFileExtension(file.path) && (
                        <div className="file-extension-badge">
                          {getFileExtension(file.path)}
                        </div>
                      )}
                    </div>
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">
                        <span>Last modified: {file.lastModified}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      <span className="file-size">{file.size}</span>
                      <button
                        type="button"
                        className="file-remove-button"
                        onClick={() => handleRemoveFile(file.path)}
                        aria-label={`Remove ${file.name} file`}
                      >
                        <MinusCircle size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <File size={48} color="#cbd5e1" strokeWidth={1} />
                </div>
                <p className="empty-state-text">
                  You haven&apos;t added any files yet
                </p>
                <p className="empty-state-subtext">
                  Click on &quot;Add Files&quot; or &quot;Add Folders&quot; to
                  get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreetingForHour(hour: number): string {
  return hour < 12 ? "Good morning" : "Good evening";
}

export default HomePage;
