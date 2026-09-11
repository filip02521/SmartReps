#!/usr/bin/env node
/**
 * Migrate data from old Supabase project (pwfymoxjrgnovzcmmfyn) to new (epjtnhsqzgtjhghzqefx).
 * Uses MCP (old project) for reading and REST API with service_role key (new project) for writing.
 *
 * Usage: NEW_SERVICE_KEY=... node scripts/migrate-to-new-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const OLD_URL = 'https://pwfymoxjrgnovzcmmfyn.supabase.co'
const NEW_URL = 'https://epjtnhsqzgtjhghzqefx.supabase.co'
const NEW_SERVICE_KEY = process.env.NEW_SERVICE_KEY || ''

if (!NEW_SERVICE_KEY) {
  console.error('Error: Set NEW_SERVICE_KEY env var to the new project service_role key.')
  process.exit(1)
}

// New project client with service_role (bypasses RLS)
const newClient = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Old project client — we need the anon key. Since we don't have it,
// we'll use the MCP data files instead.
// For now, this script reads from /tmp/sr_migration/*.json files
// (exported via MCP execute_sql) and inserts into the new project.

async function createAuthUsers(users) {
  const mapping = {} // old_id → new_id
  for (const u of users) {
    const { data, error } = await newClient.auth.admin.createUser({
      email: u.email,
      password: 'TempPass123!SmartReps',
      email_confirm: u.email_verified,
    })
    if (error) {
      console.error(`Failed to create user ${u.email}:`, error.message)
      continue
    }
    mapping[u.id] = data.user.id
    console.log(`Created ${u.email}: ${u.id} → ${data.user.id}`)
  }
  return mapping
}

async function insertTable(table, rows, userIdMapping = {}) {
  if (!rows || rows.length === 0) {
    console.log(`${table}: 0 rows (skip)`)
    return
  }
  // Remap user_id if present
  const remapped = rows.map((r) => {
    const copy = { ...r }
    if (copy.user_id && userIdMapping[copy.user_id]) {
      copy.user_id = userIdMapping[copy.user_id]
    }
    // Remove any computed/virtual columns that might cause issues
    delete copy.created_at // let DB default
    return copy
  })

  const { error } = await newClient.from(table).upsert(remapped, { onConflict: 'id' })
  if (error) {
    console.error(`${table}: ${error.message}`)
    // Try individual inserts to find the problematic row
    for (const row of remapped) {
      const { error: e2 } = await newClient.from(table).upsert(row, { onConflict: 'id' })
      if (e2) console.error(`  row ${row.id}: ${e2.message}`)
    }
  } else {
    console.log(`${table}: ${remapped.length} rows inserted`)
  }
}

async function main() {
  // Step 1: Create auth users
  const users = JSON.parse(readFileSync('/tmp/sr_migration/auth_users.json', 'utf-8'))
  console.log(`\n=== Step 1: Creating ${users.length} auth users ===`)
  const userIdMapping = await createAuthUsers(users)
  console.log(`Mapping: ${Object.keys(userIdMapping).length} users mapped`)

  // Save mapping for reference
  writeFileSync('/tmp/sr_migration/user_mapping.json', JSON.stringify(userIdMapping, null, 2))

  // Step 2: Insert data tables (read from MCP-exported JSON files)
  const tables = [
    'profiles',
    'program_progress',
    'custom_plans',
    'custom_program_progress',
    'user_exercises',
    'workout_sessions',
    'set_results',
    'max_tests',
    'body_weight_entries',
    'active_workout_state',
    'session_tombstones',
    'custom_plan_tombstones',
    'ai_insights',
    'user_achievements',
    'community_publications',
    'community_reviews',
    'user_follows',
    'push_subscriptions',
  ]

  for (const table of tables) {
    try {
      const data = JSON.parse(readFileSync(`/tmp/sr_migration/${table}.json`, 'utf-8'))
      console.log(`\n=== Inserting ${table} (${data.length} rows) ===`)
      await insertTable(table, data, userIdMapping)
    } catch (e) {
      console.log(`\n=== ${table}: no data file or error — ${e.message} ===`)
    }
  }

  console.log('\n=== Migration complete ===')
  console.log(`User mapping saved to /tmp/sr_migration/user_mapping.json`)
}

main().catch(console.error)
