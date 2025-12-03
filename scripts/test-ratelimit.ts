/**
 * Rate Limit Test Script
 * 
 * Tests the better-auth API key rate limiting (4 requests per second).
 * 
 * Usage:
 *   INBOUND_API_KEY=your_key bun run scripts/test-ratelimit.ts
 *   
 * Or if INBOUND_API_KEY is already set in your environment:
 *   bun run scripts/test-ratelimit.ts
 */

const INBOUND_API_KEY = "eIRWdAqrigvbdzWCZUrUzYVUgYwkbUvAjXojeaOEwHegLSTOaAuiUsHiuMkXmvgK"
const BASE_URL = process.env.BASE_URL || "https://dev.inbound.new";

if (!INBOUND_API_KEY) {
  console.error("❌ INBOUND_API_KEY is required");
  process.exit(1);
}

console.log(`🔑 Testing rate limits against ${BASE_URL}`);
console.log(`📊 Expected: 4 requests/second allowed\n`);

interface RequestResult {
  index: number;
  status: number;
  ok: boolean;
  time: number;
  error?: string;
}

async function makeRequest(index: number): Promise<RequestResult> {
  const start = performance.now();
  
  try {
    // Use the V2 domains list endpoint (supports GET) to test rate limiting
    const response = await fetch(`${BASE_URL}/api/v2/domains`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${INBOUND_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    
    const time = Math.round(performance.now() - start);
    
    return {
      index,
      status: response.status,
      ok: response.ok,
      time,
      error: response.ok ? undefined : await response.text().catch(() => "Unknown error"),
    };
  } catch (error) {
    const time = Math.round(performance.now() - start);
    return {
      index,
      status: 0,
      ok: false,
      time,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function runBurstTest(requestCount: number, label: string) {
  console.log(`\n🚀 ${label}: Sending ${requestCount} requests simultaneously...`);
  
  const startTime = performance.now();
  const promises = Array.from({ length: requestCount }, (_, i) => makeRequest(i + 1));
  const results = await Promise.all(promises);
  const totalTime = Math.round(performance.now() - startTime);
  
  // Analyze results
  const successful = results.filter(r => r.ok);
  const rateLimited = results.filter(r => r.status === 429);
  const otherErrors = results.filter(r => !r.ok && r.status !== 429);
  
  console.log(`\n📊 Results (${totalTime}ms total):`);
  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   🚫 Rate Limited (429): ${rateLimited.length}`);
  if (otherErrors.length > 0) {
    console.log(`   ❌ Other Errors: ${otherErrors.length}`);
    otherErrors.forEach(r => console.log(`      - Request ${r.index}: ${r.status} - ${r.error}`));
  }
  
  // Show individual results
  console.log(`\n   Individual responses:`);
  results.forEach(r => {
    const icon = r.ok ? "✅" : r.status === 429 ? "🚫" : "❌";
    console.log(`   ${icon} Request ${r.index}: ${r.status} (${r.time}ms)`);
  });
  
  return { successful: successful.length, rateLimited: rateLimited.length };
}

async function runSequentialTest(requestCount: number, delayMs: number) {
  console.log(`\n⏱️  Sequential Test: ${requestCount} requests with ${delayMs}ms delay...`);
  
  const results: RequestResult[] = [];
  
  for (let i = 0; i < requestCount; i++) {
    const result = await makeRequest(i + 1);
    results.push(result);
    
    const icon = result.ok ? "✅" : result.status === 429 ? "🚫" : "❌";
    console.log(`   ${icon} Request ${i + 1}: ${result.status} (${result.time}ms)`);
    
    if (i < requestCount - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successful = results.filter(r => r.ok).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  
  console.log(`\n📊 Summary: ${successful} successful, ${rateLimited} rate limited`);
  
  return { successful, rateLimited };
}

async function runRateLimitTest() {
  console.log("═".repeat(60));
  console.log("          RATE LIMIT TEST - 4 requests/second");
  console.log("═".repeat(60));
  
  // Test 1: Burst of 4 requests (should all succeed)
  const test1 = await runBurstTest(4, "Test 1 (within limit)");
  
  // Wait for rate limit window to reset
  console.log("\n⏳ Waiting 1.5 seconds for rate limit window to reset...");
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Test 2: Burst of 8 requests (should have some rate limited)
  const test2 = await runBurstTest(8, "Test 2 (exceeding limit)");
  
  // Wait for rate limit window to reset
  console.log("\n⏳ Waiting 1.5 seconds for rate limit window to reset...");
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Test 3: Sequential requests with 300ms delay (should all succeed - ~3.3 req/s)
  await runSequentialTest(6, 300);
  
  // Final summary
  console.log("\n" + "═".repeat(60));
  console.log("                      SUMMARY");
  console.log("═".repeat(60));
  
  if (test2.rateLimited > 0) {
    console.log("✅ Rate limiting is WORKING!");
    console.log(`   - Burst of 4: ${test1.successful}/4 successful`);
    console.log(`   - Burst of 8: ${test2.rateLimited}/8 rate limited`);
  } else if (test1.successful === 4 && test2.successful === 8) {
    console.log("⚠️  Rate limiting may NOT be enabled.");
    console.log("   All requests succeeded, none were rate limited.");
  } else {
    console.log("❓ Inconclusive results - check individual test outputs above.");
  }
  
  console.log("═".repeat(60));
}

runRateLimitTest().catch(console.error);

