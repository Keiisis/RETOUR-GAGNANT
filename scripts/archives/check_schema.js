const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ywvsfhqdtkgzavxsumnk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM');

async function checkSchema(tableName) {
    const { data, error } = await s.from(tableName).select('*').limit(1);
    if (error) console.log(tableName, "ERROR:", error.message);
    else if (data.length === 0) console.log(tableName, "EMPTY (needs 1 row to see schema without deeper inspection, but let's try)");

    // We can just dump a row if it exists
    if (data && data.length > 0) {
        console.log(`\nTable: ${tableName} columns:`);
        console.log(Object.keys(data[0]).join(', '));
    }
}

async function run() {
    await checkSchema('patrimoine');
    await checkSchema('testimonials');
    await checkSchema('faq');
}
run();
