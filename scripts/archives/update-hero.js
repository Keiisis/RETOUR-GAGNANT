const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
    const env = fs.readFileSync('.env.local', 'utf-8');
    const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
    const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing Supabase credentials");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const updates = [
        { key: 'frontend_hero_subtitle', value: "Réalisez vos ambitions au cœur du Bénin : là où vos racines deviennent des héritages d'exception." },
        { key: 'frontend_hero_title', value: "VOTRE RETOUR GAGNANT" }
    ];

    console.log("Updating hero settings...");
    const { error } = await supabase
        .from('settings')
        .upsert(updates, { onConflict: 'key' });

    if (error) {
        console.error("Error updating settings:", error);
    } else {
        console.log("Hero settings updated successfully!");
    }
}

main();
