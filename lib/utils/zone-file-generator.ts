/**
 * Zone file generation utilities for DNS records
 * Based on RFC1035 standards using dns-zonefile library
 */

// @ts-ignore - dns-zonefile doesn't have TypeScript definitions
import zonefile from "dns-zonefile";

export interface DnsRecord {
  type: "TXT" | "MX" | "CNAME" | "A" | "AAAA" | "SRV" | "SPF" | "CAA" | "DS" | "PTR";
  name: string;
  value: string;
  isVerified?: boolean;
  error?: string;
}

export interface ZoneFileOptions {
  includeSoa?: boolean;
  ttl?: number;
  origin?: string;
}

/**
 * Generate an RFC1035 compliant zone file from DNS records
 */
export function generateZoneFile(
  domain: string,
  dnsRecords: DnsRecord[],
  options: ZoneFileOptions = {}
): string {
  if (!domain || dnsRecords.length === 0) {
    throw new Error("Domain and DNS records are required");
  }

  const { includeSoa = true, ttl = 3600, origin } = options;

  // Extract base domain (last two parts: domain.tld)
  const domainParts = domain.split(".");
  const baseDomain = origin || (domainParts.length >= 2 ? domainParts.slice(-2).join(".") : domain);

  // Helper function to convert full domain names to relative names based on origin
  const getRelativeName = (fullName: string, originDomain: string): string => {
    if (fullName === originDomain) {
      return "@";
    } else if (fullName.endsWith(`.${originDomain}`)) {
      return fullName.replace(`.${originDomain}`, "");
    } else {
      return fullName; // Already relative or different origin
    }
  };

  // Group records by type for the zonefile structure
  const recordsByType: { [key: string]: any[] } = {};

  dnsRecords.forEach((record) => {
    const type = record.type.toLowerCase();
    if (!recordsByType[type]) recordsByType[type] = [];

    const relativeName = getRelativeName(record.name, baseDomain);

    if (type === "mx") {
      // Parse MX record: "10 feedback-smtp.us-east-2.amazonses.com"
      const parts = record.value.trim().split(" ");
      if (parts.length >= 2 && !isNaN(Number(parts[0]))) {
        const preference = parseInt(parts[0], 10);
        let host = parts.slice(1).join(" ");

        // Remove domain suffix if accidentally appended (common DNS provider issue)
        if (host.endsWith(`.${baseDomain}`)) {
          host = host.replace(`.${baseDomain}`, "");
        }

        // Ensure MX target has trailing dot for FQDN (prevents auto-appending)
        if (!host.endsWith(".")) {
          host += ".";
        }

        recordsByType[type].push({
          name: relativeName,
          preference: preference,
          host: host,
        });
      }
    } else if (type === "txt" || type === "spf") {
      // Ensure TXT record value is properly quoted
      let txtValue = record.value;
      if (!txtValue.startsWith('"') && !txtValue.endsWith('"')) {
        txtValue = `"${txtValue}"`;
      }

      const recordData = {
        name: relativeName,
        [type === "spf" ? "data" : "txt"]: txtValue,
      };

      recordsByType[type].push(recordData);
    } else if (type === "a") {
      recordsByType[type].push({
        name: relativeName,
        ip: record.value,
      });
    } else if (type === "aaaa") {
      recordsByType[type].push({
        name: relativeName,
        ip: record.value,
      });
    } else if (type === "cname") {
      let alias = record.value;

      // Ensure CNAME alias has trailing dot for FQDN
      if (!alias.endsWith(".")) {
        alias += ".";
      }

      recordsByType[type].push({
        name: relativeName,
        alias: alias,
      });
    } else if (type === "srv") {
      // SRV record format: "priority weight port target"
      const parts = record.value.trim().split(" ");
      if (parts.length >= 4) {
        const priority = parseInt(parts[0], 10);
        const weight = parseInt(parts[1], 10);
        const port = parseInt(parts[2], 10);
        let target = parts.slice(3).join(" ");

        // Ensure SRV target has trailing dot for FQDN
        if (!target.endsWith(".") && target !== ".") {
          target += ".";
        }

        recordsByType[type].push({
          name: relativeName,
          priority: priority,
          weight: weight,
          port: port,
          target: target,
        });
      }
    } else if (type === "caa") {
      // CAA record format: "flags tag value"
      const parts = record.value.trim().split(" ");
      if (parts.length >= 3) {
        const flags = parseInt(parts[0], 10);
        const tag = parts[1];
        const value = parts.slice(2).join(" ");

        recordsByType[type].push({
          name: relativeName,
          flags: flags,
          tag: tag,
          value: value,
        });
      }
    } else if (type === "ds") {
      // DS record format: "key_tag algorithm digest_type digest"
      const parts = record.value.trim().split(" ");
      if (parts.length >= 4) {
        recordsByType[type].push({
          name: relativeName,
          key_tag: parts[0],
          algorithm: parts[1],
          digest_type: parts[2],
          digest: parts.slice(3).join(" "),
        });
      }
    } else if (type === "ptr") {
      let host = record.value;

      // Ensure PTR target has trailing dot for FQDN
      if (!host.endsWith(".")) {
        host += ".";
      }

      recordsByType[type].push({
        name: relativeName,
        host: host,
      });
    }
  });

  // Create zonefile data structure
  const zonefileData: any = {
    $origin: `${baseDomain}.`,
    $ttl: ttl,
  };

  // Add SOA record if requested
  if (includeSoa) {
    zonefileData.soa = {
      mname: "ns1.inbound.new.",
      rname: `admin.${baseDomain}.`,
      serial: Math.floor(Date.now() / 1000),
      refresh: 3600,
      retry: 600,
      expire: 604800,
      minimum: 86400,
    };
  }

  // Add record types that exist
  Object.keys(recordsByType).forEach((type) => {
    if (recordsByType[type].length > 0) {
      zonefileData[type] = recordsByType[type];
    }
  });

  try {
    return zonefile.generate(zonefileData);
  } catch (error) {
    throw new Error(`Failed to generate zone file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Copy zone file content to clipboard and download as file
 */
export async function copyAndSaveZoneFile(
  domain: string,
  dnsRecords: DnsRecord[],
  options: ZoneFileOptions = {}
): Promise<{ copied: boolean; downloaded: boolean }> {
  try {
    const zoneFileContent = generateZoneFile(domain, dnsRecords, options);
    
    let copied = false;
    let downloaded = false;

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(zoneFileContent);
      copied = true;
    } catch (clipboardError) {
      console.warn("Failed to copy to clipboard:", clipboardError);
    }

    // Download as file
    try {
      const blob = new Blob([zoneFileContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${domain}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      downloaded = true;
    } catch (downloadError) {
      console.warn("Failed to download file:", downloadError);
    }

    return { copied, downloaded };
  } catch (error) {
    throw new Error(`Zone file operation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract record name relative to domain for zone file formatting
 */
export function extractRecordName(recordName: string, domainName: string): string {
  // Extract root domain from domainName (get last 2 parts: domain.tld)
  const domainParts = domainName.split(".");
  const rootDomain = domainParts.slice(-2).join(".");

  // If the record name is exactly the root domain, return "@"
  if (recordName === rootDomain) {
    return "@";
  }

  // If the record name ends with the root domain, extract the subdomain part
  if (recordName.endsWith(`.${rootDomain}`)) {
    return recordName.replace(`.${rootDomain}`, "");
  }

  // Fallback: if no match found, return the original record name
  return recordName;
}
