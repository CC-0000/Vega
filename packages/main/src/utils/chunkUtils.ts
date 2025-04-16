export interface TextChunk {
  text: string;
  chunkId: string;
  startOffset: number;
  endOffset: number;
}

/**
 * Split content into semantic blocks
 * @param content The full text content to split
 * @param minChunkSize Minimum size for each chunk (default: 800 characters)
 * @param maxChunkSize Maximum size for each chunk (default: 2000 characters)
 * @returns Array of text chunks with position information
 */
export function splitContentIntoSemanticChunks(
  content: string,
  fileHash: string,
  minChunkSize: number = 800,
  maxChunkSize: number = 2000
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Step 1: Split content into sentences
  const sentences = content.split("\n");

  let currentChunk: string = "";
  let currentChunkStart: number = 0;
  let position: number = 0;
  let lastSentence: string = "";
  let lastSentenceStart: number = 0;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];

    // Add newline if not the first sentence
    if (i > 0) {
      position += 1;
    }

    const sentenceStart = position;

    // Case 1: Single sentence exceeds maxChunkSize
    if (sentence.length > maxChunkSize) {
      // First, add any current chunk
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk,
          chunkId: `${fileHash.substring(0, fileHash.length - 2)}-0`,
          startOffset: currentChunkStart,
          endOffset: sentenceStart - (i > 0 ? 1 : 0), // -1 for newline if needed
        });
        currentChunk = "";
      }

      // Handle the long sentence by breaking it into smaller chunks
      let offset = 0;
      while (offset < sentence.length) {
        let size = Math.min(maxChunkSize, sentence.length - offset);

        // Try to cut at word boundary if not at end
        if (offset + size < sentence.length) {
          const lastSpace = sentence.lastIndexOf(" ", offset + size);
          if (lastSpace > offset) {
            size = lastSpace - offset;
          }
        }

        chunks.push({
          text: sentence.substring(offset, offset + size),
          chunkId: `${fileHash.substring(0, fileHash.length - 2)}-0`,
          startOffset: sentenceStart + offset,
          endOffset: sentenceStart + offset + size,
        });

        offset += size;
        // Skip the space if we cut at a word boundary
        if (offset < sentence.length && sentence[offset] === " ") {
          offset += 1;
        }
      }

      // Update position and continue to the next sentence
      position = sentenceStart + sentence.length;
      lastSentence = sentence;
      lastSentenceStart = sentenceStart;
      // eslint-disable-next-line no-continue
      continue;
    }

    // Case 2: Check if adding this sentence would exceed maxChunkSize
    const newChunkLength =
      currentChunk.length + (currentChunk.length > 0 ? 1 : 0) + sentence.length;

    if (newChunkLength > maxChunkSize && currentChunk.length >= minChunkSize) {
      // Finalize the current chunk
      chunks.push({
        text: currentChunk,
        chunkId: `${fileHash.substring(0, fileHash.length - 2)}-0`,
        startOffset: currentChunkStart,
        endOffset: sentenceStart - (i > 0 ? 1 : 0), // -1 for newline if needed
      });

      // Create overlap for the next chunk
      if (lastSentence.length > 0) {
        let overlapText = lastSentence;

        // Limit overlap to about 200 characters
        if (overlapText.length > 200) {
          // Try to cut at word boundary
          const words = overlapText.split(" ");
          const truncated = words.reduce((result, word) => {
            if (result.length + word.length + (result ? 1 : 0) <= 200) {
              return result + (result ? " " : "") + word;
            }
            return result;
          }, "");

          overlapText = truncated || overlapText.substring(0, 200);
        }

        // Start the new chunk with the overlap
        currentChunk = overlapText;
        // Calculate new start offset based on where the overlap begins
        currentChunkStart =
          lastSentenceStart + (lastSentence.length - overlapText.length);
      } else {
        // No previous sentence for overlap
        currentChunk = "";
        currentChunkStart = sentenceStart;
      }

      // Add the current sentence to the new chunk
      if (currentChunk.length > 0) {
        currentChunk += "\n";
      } else {
        currentChunkStart = sentenceStart;
      }
      currentChunk += sentence;
    } else {
      // Just add this sentence to the current chunk
      if (currentChunk.length > 0) {
        currentChunk += "\n";
      } else {
        currentChunkStart = sentenceStart;
      }
      currentChunk += sentence;
    }

    // Update position and remember this sentence for potential overlap
    position = sentenceStart + sentence.length;
    lastSentence = sentence;
    lastSentenceStart = sentenceStart;
  }

  // Add the final chunk if there's anything left
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk,
      chunkId: `${fileHash.substring(0, fileHash.length - 2)}-0`,
      startOffset: currentChunkStart,
      endOffset: position,
    });
  }

  return chunks;
}

/**
 * Splits multiple pages of content into semantic chunks.
 *
 * @param pagedContent - Array of strings, each representing a page of content
 * @param fileHash - Hash of the file to use as part of the chunk ID
 * @param minChunkSize - Minimum size of each chunk (default: 800)
 * @param maxChunkSize - Maximum size of each chunk (default: 2000)
 * @returns Array of TextChunk objects representing the semantic chunks
 */
export function splitPagedContentIntoSemanticChunks(
  pagedContent: string[],
  fileHash: string,
  minChunkSize: number = 800,
  maxChunkSize: number = 2000
): TextChunk[] {
  const totalChunks: TextChunk[] = [];

  for (let i = 0; i < pagedContent.length; i += 1) {
    const chunks: TextChunk[] = splitContentIntoSemanticChunks(
      pagedContent[i],
      fileHash,
      minChunkSize,
      maxChunkSize
    );
    for (let j = 0; j < chunks.length; j += 1) {
      chunks[j].chunkId = `${fileHash.substring(
        0,
        fileHash.length - (String(i + 1).length + 1)
      )}-${i + 1}`;
      totalChunks.push(chunks[j]);
    }
  }

  return totalChunks;
}
