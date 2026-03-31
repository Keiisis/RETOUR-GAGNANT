const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
// Load environment variables (fallback if not in .env)
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or Key missing!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importKeys() {
    console.log("Lecture du fichier d'audit...");
    const auditData = JSON.parse(fs.readFileSync('untranslated_audit.json', 'utf8'));

    // Extraire les clés uniques
    const keysSet = new Set();
    auditData.forEach(item => {
        // Nettoyer les espaces inutiles au début/fin
        const cleanKey = item.matched.trim();
        if (cleanKey.length > 2) {
            keysSet.add(cleanKey);
        }
    });

    const uniqueKeys = Array.from(keysSet);
    console.log(`${uniqueKeys.length} clés uniques trouvées.`);

    const batchSize = 100;

    for (let i = 0; i < uniqueKeys.length; i += batchSize) {
        const batchKeys = uniqueKeys.slice(i, i + batchSize);
        console.log(`Insertion lot ${i / batchSize + 1}...`);

        // Préparer l'upsert
        const records = batchKeys.map(k => ({
            key: k,
            fr: k, // Le français est la langue par défaut/source
            // Les autres colonnes peuvent être laissées nulles pour l'instant
        }));

        const { error } = await supabase.from('translations').upsert(records, { onConflict: 'key', ignoreDuplicates: true });

        if (error) {
            console.error(`Erreur d'insertion lot ${i}:`, error.message);
        }
    }

    console.log("🎉 Opération d'importation des clés terminée avec succès !");
}

importKeys();
