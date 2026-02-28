const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const sqlFile = path.join(__dirname, 'migration_dashboard_v2.sql')
const sql = fs.readFileSync(sqlFile, 'utf8')

// Split by semicolons to run each statement independently
const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

async function run() {
    console.log(`Running ${statements.length} SQL statements...`)
    let success = 0
    let failed = 0

    for (const stmt of statements) {
        const shortStmt = stmt.substring(0, 60).replace(/\n/g, ' ')
        try {
            const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' })
            if (error) {
                // Try direct fetch approach
                const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': serviceKey,
                        'Authorization': `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({ sql_text: stmt + ';' }),
                })
                if (!resp.ok) {
                    console.log(`  SKIP: ${shortStmt}... (may already exist)`)
                    failed++
                } else {
                    console.log(`  OK: ${shortStmt}...`)
                    success++
                }
            } else {
                console.log(`  OK: ${shortStmt}...`)
                success++
            }
        } catch (e) {
            console.log(`  SKIP: ${shortStmt}... (${e.message})`)
            failed++
        }
    }

    console.log(`\nDone: ${success} success, ${failed} skipped`)
}

run()
