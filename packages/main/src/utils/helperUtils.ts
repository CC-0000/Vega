import path from "path";
import * as fs from "node:fs/promises";
import crypto from "crypto";
import { ALLOWED_EXTENSIONS } from "../constants/constants.js";

/**
 * Recursively reads all files from a directory and its subdirectories.
 *
 * @param dir - The path to the directory to read files from
 * @returns A promise that resolves to an array of file paths
 * @throws Will throw an error if the directory cannot be read
 */
async function readAllFilesFrom(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const result: string[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      const subFiles = await readAllFilesFrom(fullPath);
      result.push(...subFiles);
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * Gets all files with allowed extensions from the specified directories and file paths.
 *
 * @param directories - Array of directory paths to scan for files recursively
 * @param filePaths - Array of individual file paths to include
 * @returns Promise resolving to an array of file paths with allowed extensions
 * @throws Will throw an error if any directory cannot be read
 */
export async function getAllAllowedFiles(
  directories: string[],
  filePaths: string[]
): Promise<string[]> {
  // Get all files from directories asynchronously
  const dirFilesArrays = await Promise.all(
    directories.map((dir) => readAllFilesFrom(dir))
  );
  const dFiles = dirFilesArrays.flat();

  // Combine with explicitly provided file paths, removing duplicates
  const allFiles = [...new Set([...dFiles, ...filePaths])];

  return allFiles.filter((file) => {
    const extension = path.extname(file).toLowerCase().substring(1);
    return ALLOWED_EXTENSIONS.includes(extension);
  });
}

/**
 * Gets the SHA-256 hash of a file.
 *
 * @param filePath - Path to the file to hash
 * @returns Promise resolving to the SHA-256 hash of the file
 * @throws Will throw an error if the file cannot be read
 */
export async function getFileHash(filePath: string): Promise<string> {
  // Read the file content
  const fileBuffer = await fs.readFile(filePath);

  // Create a hash object using SHA-256 algorithm
  const hashSum = crypto.createHash("sha256");

  // Update the hash with file content
  hashSum.update(fileBuffer);

  // Get the hex digest of the hash
  return hashSum.digest("hex");
}

/**
 * Gets the SHA-256 hash of multiple files.
 *
 * @param filePaths - Array of file paths to hash
 * @returns Promise resolving to an array of SHA-256 hashes
 * @throws Will throw an error if any file cannot be read
 */
export async function getFileHashes(filePaths: string[]): Promise<string[]> {
  return Promise.all(filePaths.map((filePath) => getFileHash(filePath)));
}
