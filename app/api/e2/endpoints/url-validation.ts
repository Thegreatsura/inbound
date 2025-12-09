/**
 * URL validation utilities for webhook endpoints
 * Prevents SSRF attacks by blocking internal/private addresses
 */

/**
 * Validates and resolves a webhook URL, blocking internal and private addresses
 * @param url - The URL to validate
 * @returns The validated URL string
 * @throws Error if URL is invalid or points to a private/internal address
 */
export function validateWebhookUrl(url: string): string {
  const raw = url?.trim() || "";
  if (!raw) throw new Error("Webhook URL is required");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Only allow http/https protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost and local addresses
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  ) {
    throw new Error("Local addresses are not allowed");
  }

  // Block link-local and other special addresses
  if (host === "0.0.0.0" || host === "[::]") {
    throw new Error("Wildcard addresses are not allowed");
  }

  // Check for IPv4 private/reserved ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // 10.0.0.0/8 - Private network
    if (a === 10) {
      throw new Error("Private network addresses (10.x.x.x) are not allowed");
    }

    // 172.16.0.0/12 - Private network
    if (a === 172 && b >= 16 && b <= 31) {
      throw new Error(
        "Private network addresses (172.16-31.x.x) are not allowed"
      );
    }

    // 192.168.0.0/16 - Private network
    if (a === 192 && b === 168) {
      throw new Error(
        "Private network addresses (192.168.x.x) are not allowed"
      );
    }

    // 127.0.0.0/8 - Loopback
    if (a === 127) {
      throw new Error("Loopback addresses (127.x.x.x) are not allowed");
    }

    // 169.254.0.0/16 - Link-local
    if (a === 169 && b === 254) {
      throw new Error("Link-local addresses (169.254.x.x) are not allowed");
    }

    // 0.0.0.0/8 - Current network
    if (a === 0) {
      throw new Error("Current network addresses (0.x.x.x) are not allowed");
    }

    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) {
      throw new Error("Multicast addresses (224-239.x.x.x) are not allowed");
    }

    // 240.0.0.0/4 - Reserved
    if (a >= 240) {
      throw new Error("Reserved addresses (240+.x.x.x) are not allowed");
    }
  }

  // Check for IPv6 private/reserved ranges (basic check)
  if (host.startsWith("[") || host.includes(":")) {
    const ipv6 = host.replace(/^\[|\]$/g, "").toLowerCase();

    // ::1 - Loopback
    if (ipv6 === "::1") {
      throw new Error("IPv6 loopback address is not allowed");
    }

    // fe80::/10 - Link-local
    if (
      ipv6.startsWith("fe8") ||
      ipv6.startsWith("fe9") ||
      ipv6.startsWith("fea") ||
      ipv6.startsWith("feb")
    ) {
      throw new Error("IPv6 link-local addresses are not allowed");
    }

    // fc00::/7 - Unique local address
    if (ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
      throw new Error("IPv6 unique local addresses are not allowed");
    }

    // :: - Unspecified
    if (ipv6 === "::") {
      throw new Error("IPv6 unspecified address is not allowed");
    }
  }

  // Block AWS metadata service
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new Error("Cloud metadata service addresses are not allowed");
  }

  return parsed.toString();
}

/**
 * Masks sensitive parts of a URL for logging
 * Removes credentials and query parameters
 */
export function maskUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "[invalid URL]";
  }
}
