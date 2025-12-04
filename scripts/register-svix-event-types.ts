/**
 * Register SVIX Event Types
 * 
 * Run this script to register all event types with SVIX.
 * This only needs to be done once (or when adding new event types).
 * 
 * Usage: bun run scripts/register-svix-event-types.ts
 */

import { registerEventTypes } from '../lib/svix/user-management'

async function main() {
  console.log('🚀 Registering SVIX event types...\n')
  
  const success = await registerEventTypes()
  
  if (success) {
    console.log('\n✅ Event types registered successfully!')
  } else {
    console.log('\n❌ Failed to register event types (check logs above)')
    process.exit(1)
  }
}

main()

