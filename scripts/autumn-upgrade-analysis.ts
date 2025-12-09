import { Autumn, Customer } from "autumn-js";
import { Inbound } from "inboundemail";
import React from "react";
import * as fs from "fs";
import * as path from "path";

// Email templates for A/B testing
import { FreePlanSunsetFinalEmail } from "../emails/free-plan-sunset-final";
import { FreePlanSunsetReminderEmail } from "../emails/free-plan-sunset-reminder";
import { FreePlanSunsetNoticeEmail } from "../emails/free-plan-sunset-notice";

// Progress tracking
const PROGRESS_FILE = path.join(__dirname, "email-campaign-progress.json");

interface ProgressData {
  sentEmails: Set<string>;
  results: Array<{
    email: string;
    name: string | null;
    variant: EmailVariant;
    success: boolean;
    error?: string;
    timestamp: string;
  }>;
  startedAt: string;
  lastUpdated: string;
}

function loadProgress(): ProgressData {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
      return {
        ...data,
        sentEmails: new Set(data.sentEmails || []),
      };
    }
  } catch (error) {
    console.log("⚠️  Could not load progress file, starting fresh");
  }
  return {
    sentEmails: new Set(),
    results: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: ProgressData): void {
  const dataToSave = {
    ...progress,
    sentEmails: Array.from(progress.sentEmails),
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(dataToSave, null, 2));
}

function clearProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log("🗑️  Progress file cleared");
  }
}

const inbound = new Inbound({
  apiKey: process.env.INBOUND_API_KEY!,
});

const autumn = new Autumn({
  secretKey: process.env.AUTUMN_PROD_SECRET_KEY!,
});

// A/B test variants
type EmailVariant = "final" | "reminder" | "notice";

const EMAIL_TEMPLATES: Record<
  EmailVariant,
  {
    subject: string;
    component: (props: {
      userFirstname?: string;
      currentDomain?: string;
      deletionDate?: string;
      daysRemaining?: number;
    }) => React.ReactElement;
  }
> = {
  final: {
    subject: "Urgent: Action required — plan downgraded",
    component: FreePlanSunsetFinalEmail,
  },
  reminder: {
    subject: "Urgent: Your Inbound account is at risk",
    component: FreePlanSunsetReminderEmail,
  },
  notice: {
    subject: "Urgent: Your plan requires attention",
    component: FreePlanSunsetNoticeEmail,
  },
};

const VARIANTS: EmailVariant[] = ["final", "reminder", "notice"];

const TEST_EMAIL = "raavtube@icloud.com";
const isTestMode = process.argv.includes("--test");
const isDryRun = process.argv.includes("--dry-run");
const isReset = process.argv.includes("--reset");

function pickRandomVariant(): EmailVariant {
  const index = Math.floor(Math.random() * VARIANTS.length);
  return VARIANTS[index];
}

function getFirstName(name: string | null): string {
  if (!name) return "there";
  return name.split(" ")[0] || "there";
}

async function sendSunsetEmail(
  email: string,
  name: string | null,
  variant: EmailVariant
): Promise<{ success: boolean; variant: EmailVariant; error?: string }> {
  const template = EMAIL_TEMPLATES[variant];
  const firstName = getFirstName(name);

  try {
    const response = await inbound.emails.send({
      from: "Inbound <hello@mail.inbound.new>",
      to: email,
      subject: template.subject,
      react: template.component({
        userFirstname: firstName,
        deletionDate: "January 15, 2025",
        daysRemaining: 14,
      }),
    });

    return { success: true, variant };
  } catch (error) {
    return {
      success: false,
      variant,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function analyzeAndSendEmails() {
  console.log("Fetching customers from Autumn...\n");

  const limit = 100;
  let offset = 0;
  let page = 1;
  let allCustomers: Customer[] = [];

  // Paginate through all customers
  while (true) {
    console.log(`Fetching page ${page} (offset: ${offset})...`);

    const { data, error } = await autumn.customers.list({
      limit,
      offset,
    });

    if (error) {
      console.error("Error fetching customers:", error);
      return;
    }

    if (!data?.list) {
      console.log("No customer list found in response");
      break;
    }

    allCustomers = allCustomers.concat(data.list);
    console.log(
      `  → Got ${data.list.length} customers (total so far: ${allCustomers.length})`
    );

    // If we got fewer than we asked for, we've reached the end
    if (data.list.length < limit) {
      console.log("\n✅ All pages fetched!\n");
      break;
    }

    offset += limit;
    page++;
  }

  console.log("\n--- Analysis ---\n");

  const totalCustomers = allCustomers.length;

  // Separate customers by upgrade status
  const upgradedCustomers: Customer[] = [];
  const freeTierCustomers: Customer[] = [];

  for (const customer of allCustomers) {
    const hasDefaultTest = customer.products?.some(
      (product) => product.id === "inbound_default_test"
    );

    if (hasDefaultTest) {
      upgradedCustomers.push(customer);
    } else {
      // Check if they're on free tier
      const isFreeTier = customer.products?.some(
        (product) => product.id === "free_tier"
      );
      if (isFreeTier) {
        freeTierCustomers.push(customer);
      }
    }
  }

  console.log(`Total customers fetched: ${totalCustomers}`);
  console.log(
    `Upgraded to inbound_default_test: ${upgradedCustomers.length}/${totalCustomers}`
  );
  console.log(`Free tier (need email): ${freeTierCustomers.length}`);
  console.log(
    `Upgrade rate: ${((upgradedCustomers.length / totalCustomers) * 100).toFixed(2)}%`
  );

  if (freeTierCustomers.length === 0) {
    console.log("\n✅ No free tier customers to email!");
    return;
  }

  // Filter out customers without emails
  const customersWithEmail = freeTierCustomers.filter((c) => c.email);
  const customersWithoutEmail = freeTierCustomers.length - customersWithEmail.length;

  if (isDryRun) {
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║           DRY RUN MODE                 ║");
    console.log("╚════════════════════════════════════════╝\n");
    console.log(`Would send emails to: ${customersWithEmail.length} customers`);
    console.log(`Skipped (no email): ${customersWithoutEmail}`);
    console.log("\nRecipient list:");
    customersWithEmail.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.email} (${c.name || "No name"})`);
    });
    console.log("\n✅ Dry run complete. No emails were sent.");
    return;
  }

  // Load existing progress
  const progress = loadProgress();
  const alreadySent = progress.sentEmails.size;

  if (alreadySent > 0) {
    console.log(`\n📂 Resuming from previous run...`);
    console.log(`   Already sent: ${alreadySent} emails`);
    console.log(`   Remaining: ${customersWithEmail.length - alreadySent} emails`);
  }

  // Ask for confirmation before sending
  const remaining = customersWithEmail.filter((c) => !progress.sentEmails.has(c.email!));
  console.log(`\n⚠️  About to send ${remaining.length} emails (A/B test)`);
  console.log(`   Skipping ${customersWithoutEmail} customers without email`);
  if (alreadySent > 0) {
    console.log(`   Skipping ${alreadySent} already sent (from previous run)`);
  }
  console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Send emails with A/B testing
  console.log("\n--- Sending Emails ---\n");

  const variantCounts: Record<EmailVariant, { sent: number; failed: number }> = {
    final: { sent: 0, failed: 0 },
    reminder: { sent: 0, failed: 0 },
    notice: { sent: 0, failed: 0 },
  };

  let sentThisRun = 0;
  let skippedThisRun = 0;

  for (let i = 0; i < customersWithEmail.length; i++) {
    const customer = customersWithEmail[i];
    
    // Skip if already sent
    if (progress.sentEmails.has(customer.email!)) {
      skippedThisRun++;
      continue;
    }

    const variant = pickRandomVariant();
    console.log(
      `  [${i + 1}/${customersWithEmail.length}] 📧 Sending "${variant}" to ${customer.email}...`
    );

    const result = await sendSunsetEmail(customer.email!, customer.name, variant);

    // Track progress
    progress.sentEmails.add(customer.email!);
    progress.results.push({
      email: customer.email!,
      name: customer.name,
      variant,
      success: result.success,
      error: result.error,
      timestamp: new Date().toISOString(),
    });

    // Save progress after each email
    saveProgress(progress);

    if (result.success) {
      variantCounts[variant].sent++;
      sentThisRun++;
      console.log(`      ✅ Sent!`);
    } else {
      variantCounts[variant].failed++;
      console.log(`      ❌ Failed: ${result.error}`);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log("\n--- Summary ---\n");
  console.log("A/B Test Distribution (this run):");
  for (const variant of VARIANTS) {
    const counts = variantCounts[variant];
    console.log(
      `  ${variant}: ${counts.sent} sent, ${counts.failed} failed`
    );
  }

  console.log(`\nThis run: ${sentThisRun} sent`);
  console.log(`Total across all runs: ${progress.results.filter((r) => r.success).length} sent`);

  // Log failed emails for debugging
  const failedEmails = progress.results.filter((r) => !r.success);
  if (failedEmails.length > 0) {
    console.log("\nFailed emails (all runs):");
    console.table(failedEmails.map(({ email, variant, error }) => ({ email, variant, error })));
  }

  console.log(`\n📂 Progress saved to: ${PROGRESS_FILE}`);
  console.log("   Run with --reset to clear progress and start fresh");
}

async function runTestMode() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║         TEST MODE ENABLED              ║");
  console.log("╚════════════════════════════════════════╝\n");
  console.log(`Sending all ${VARIANTS.length} variants to: ${TEST_EMAIL}\n`);

  for (const variant of VARIANTS) {
    console.log(`📧 Sending "${variant}" variant...`);
    const result = await sendSunsetEmail(TEST_EMAIL, "Ryan", variant);

    if (result.success) {
      console.log(`   ✅ Sent "${variant}" successfully!\n`);
    } else {
      console.log(`   ❌ Failed: ${result.error}\n`);
    }

    // Small delay between sends
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("✅ Test complete! Check your inbox at", TEST_EMAIL);
}

// Main entry point
if (isReset) {
  clearProgress();
  console.log("✅ Ready to start fresh. Run without --reset to begin.");
} else if (isTestMode) {
  runTestMode();
} else {
  analyzeAndSendEmails();
}
