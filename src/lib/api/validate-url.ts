/**
 * SSRF-prevention: validates that a URL is safe to fetch server-side.
 * Blocks private/internal IPs, loopback, link-local, and non-HTTPS schemes.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateIp(hostname: string): boolean {
  // IPv4 private / loopback / link-local ranges
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 10) return true;                              // 10.0.0.0/8
    if (a === 127) return true;                             // 127.0.0.0/8
    if (a === 169 && b === 254) return true;                // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                // 192.168.0.0/16
    if (a === 0) return true;                               // 0.0.0.0/8
  }

  // Simplified IPv6 loopback / link-local
  const lower = hostname.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;              // IPv6 link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // IPv6 ULA

  return false;
}

/**
 * Validates that `url` is a safe external HTTPS URL.
 * Returns the parsed `URL` object on success.
 * Throws a descriptive `Error` on any violation.
 */
export function validateExternalUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`URL protocol must be https (got "${parsed.protocol}")`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`URL hostname "${hostname}" is not allowed`);
  }

  if (BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error(`URL hostname "${hostname}" is not allowed`);
  }

  if (isPrivateIp(hostname)) {
    throw new Error(`URL hostname "${hostname}" resolves to a private or reserved IP range`);
  }

  return parsed;
}

/**
 * Non-throwing wrapper – returns `true` when the URL passes all checks.
 */
export function isValidExternalUrl(url: string): boolean {
  try {
    validateExternalUrl(url);
    return true;
  } catch {
    return false;
  }
}
