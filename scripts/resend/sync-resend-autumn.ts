import { Resend } from 'resend';
import dotenv from 'dotenv';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';

dotenv.config({ path: '../../.env' });

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set");
}

const RESEND_AUTUMN_AUDIENCE_ID = "515e5071-4d0e-4117-9c12-e8ddd29b807e"
const resend = new Resend(process.env.RESEND_API_KEY)

// Rate limiting helper - Resend has a 2 RPS limit
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncResendAudience() {
  console.log("Starting Resend audience sync...");
  console.log(`Target audience ID: ${RESEND_AUTUMN_AUDIENCE_ID}`);
  
  try {
    // Get all contacts from Resend audience
    console.log("Fetching existing contacts from Resend...");
    const resendContacts = await resend.contacts.list({
      audienceId: RESEND_AUTUMN_AUDIENCE_ID,
    });

    if (!resendContacts.data) {
      throw new Error("Failed to fetch Resend contacts - no data returned");
    }

    // Create a Set of existing Resend contact emails for fast lookup
    const existingEmails = new Set(
      resendContacts.data.data.map((contact: any) => contact.email.toLowerCase())
    );

    console.log(`✓ Found ${existingEmails.size} existing contacts in Resend`);

    // Get all users from DB who should be in the audience
    console.log("Fetching users from database...");
    const dbUsers = await db.select({
      email: user.email,
      name: user.name,
    }).from(user);

    console.log(`✓ Found ${dbUsers.length} users in database`);

    // Filter users who aren't in Resend yet
    const usersToAdd = dbUsers.filter(user => 
      user.email && !existingEmails.has(user.email.toLowerCase())
    );

    console.log(`📋 Need to add ${usersToAdd.length} new contacts to Resend`);

    if (usersToAdd.length === 0) {
      console.log("🎉 All users are already synced! No action needed.");
      return;
    }

    // Add new contacts to Resend in batches with rate limiting
    let addedCount = 0;
    let errorCount = 0;
    const failedEmails: string[] = [];

    console.log("Starting to add new contacts...");
    console.log("⏱️  Respecting 2 RPS rate limit (500ms delay between requests)");
    
    for (const user of usersToAdd) {
      try {
        console.log(`Adding contact: ${user.email}`);
        console.log(await resend.contacts.create({
          audienceId: RESEND_AUTUMN_AUDIENCE_ID,
          email: user.email!,
          firstName: user.name || undefined,
        }));
        addedCount++;
        console.log(`✓ Successfully added: ${user.email}`);
        
        if (addedCount % 10 === 0) {
          console.log(`📊 Progress: ${addedCount}/${usersToAdd.length} contacts added...`);
        }
        
        // Rate limiting: Wait 500ms between requests to respect 2 RPS limit
        if (addedCount < usersToAdd.length) {
          await sleep(500);
        }
      } catch (error) {
        errorCount++;
        failedEmails.push(user.email!);
        console.error(`✗ Failed to add ${user.email}:`, error);
        
        // Log more details about the error if available
        if (error instanceof Error) {
          console.error(`  Error message: ${error.message}`);
        }
        
        // Still respect rate limit even on errors
        if (addedCount + errorCount < usersToAdd.length) {
          await sleep(500);
        }
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("🏁 SYNC COMPLETE");
    console.log("=".repeat(50));
    console.log(`✅ Successfully added: ${addedCount} contacts`);
    console.log(`❌ Failed to add: ${errorCount} contacts`);
    console.log(`⏭️  Skipped (already exist): ${existingEmails.size} contacts`);
    console.log(`📊 Total database users: ${dbUsers.length}`);
    
    if (failedEmails.length > 0) {
      console.log("\n❌ FAILED EMAILS:");
      failedEmails.forEach(email => console.log(`  - ${email}`));
    }
    
    if (errorCount > 0) {
      console.log(`\n⚠️  Warning: ${errorCount} contacts failed to sync. Please review the errors above.`);
    } else {
      console.log("\n🎉 All new contacts synced successfully!");
    }

  } catch (error) {
    console.error("\n💥 CRITICAL ERROR during sync:");
    console.error("Error details:", error);
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    
    throw error; // Re-throw to be caught by the main error handler
  }
}

// Run the sync
syncResendAudience()
  .then(() => {
    console.log("\n🎊 Sync completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💀 SYNC FAILED:");
    console.error("Final error:", error);
    
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
    
    console.error("\n🔧 Please check your configuration and try again.");
    process.exit(1);
  });