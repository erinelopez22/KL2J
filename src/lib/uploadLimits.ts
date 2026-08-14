export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isOversizedFile(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export function isValidExternalLink(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
