import type { PhotoInput } from "./types";
import type { ClaudeContentBlock } from "@/lib/api/claude-client";

/**
 * Build Claude message content from photos + a trailing text prompt.
 * Shared by classification and extraction stages to avoid duplication.
 */
export function buildImageContent(
  images: PhotoInput[],
  textPrompt: string,
): ClaudeContentBlock[] {
  const content: ClaudeContentBlock[] = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.buffer.toString("base64"),
    },
  }));

  content.push({ type: "text", text: textPrompt });
  return content;
}
