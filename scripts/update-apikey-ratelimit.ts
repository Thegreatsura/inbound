/**
 * Update API Key Rate Limit Script
 * 
 * Updates an existing API key to enable rate limiting.
 * 
 * Usage:
 *   bun run scripts/update-apikey-ratelimit.ts <keyId>
 */

import { auth } from "@/lib/auth/auth";

const keyId = process.argv[2];

if (!keyId) {
  console.error("❌ Usage: bun run scripts/update-apikey-ratelimit.ts <keyId>");
  console.error("   Example: bun run scripts/update-apikey-ratelimit.ts Lk1sjgbNURcnK4XUDUJKMIwqzkPO1yiS");
  process.exit(1);
}

async function updateApiKeyRateLimit() {
  console.log(`🔧 Updating API key rate limiting for: ${keyId}`);
  
  try {
    const result = await (auth.api as any).updateApiKey({
      body: {
        keyId: keyId,
        rateLimitEnabled: true,
        rateLimitTimeWindow: 1000, // 1 second
        rateLimitMax: 4 // 4 requests per second
      }
    });

    console.log("✅ API key updated successfully!");
    console.log("📊 New settings:");
    console.log(`   - rateLimitEnabled: ${result.rateLimitEnabled}`);
    console.log(`   - rateLimitTimeWindow: ${result.rateLimitTimeWindow}ms`);
    console.log(`   - rateLimitMax: ${result.rateLimitMax} requests`);
    
    return result;
  } catch (error) {
    console.error("❌ Failed to update API key:", error);
    process.exit(1);
  }
}

updateApiKeyRateLimit();

