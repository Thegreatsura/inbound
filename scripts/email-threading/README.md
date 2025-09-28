# Email Threading Scripts

This directory contains scripts for managing email threading functionality.

## Backfill Script

The `backfill-threads.ts` script processes existing emails to create thread relationships.

### Usage

```bash
# Dry run to see what would happen
bun run scripts/email-threading/backfill-threads.ts --dry-run

# Process all emails in batches of 100
bun run scripts/email-threading/backfill-threads.ts

# Process specific user's emails only
bun run scripts/email-threading/backfill-threads.ts --user-id user123

# Process with custom batch size and limit
bun run scripts/email-threading/backfill-threads.ts --batch-size 50 --max-emails 1000
```

### Options

- `--batch-size <number>`: Number of emails to process in each batch (default: 100)
- `--max-emails <number>`: Maximum number of emails to process (default: unlimited)
- `--dry-run`: Show what would be done without making changes
- `--user-id <string>`: Process emails for specific user only
- `--help`: Show help message

### Safety Features

- **Dry run mode**: Test the script without making changes
- **Batch processing**: Processes emails in small batches to avoid overwhelming the database
- **Error handling**: Continues processing even if individual emails fail
- **Progress tracking**: Shows detailed progress and statistics
- **User filtering**: Can process emails for a specific user only

### Performance

The script is designed to be safe and efficient:
- Processes oldest emails first for better threading accuracy
- Includes small delays between operations to reduce database load
- Provides detailed progress reporting
- Can be stopped and resumed (already processed emails are skipped)

### Example Output

```
🧵 Starting email threading backfill...
📊 Options: batchSize=100, maxEmails=unlimited, dryRun=false, userId=all users
📧 Found 1,234 emails to process

📦 Processing batch 1 (emails 1-100)
🔄 Processing email abc123 (Welcome to our service...)
🆕 Created new thread thread_xyz789
🔄 Processing email def456 (Re: Welcome to our service...)
🔗 Added to existing thread thread_xyz789 at position 2
...

✅ Backfill completed!
📊 Final Statistics:
   Total emails: 1,234
   Processed: 1,234
   Threads created: 456
   Emails threaded: 1,234
   Errors: 0
   Duration: 123 seconds
   Rate: 10 emails/second
```
