const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const emailSettings = [
        { key: 'smtp_host', value: 'smtp.gmail.com' },
        { key: 'smtp_port', value: '587' },
        { key: 'smtp_user', value: 'votre.adresse@gmail.com' },
        { key: 'smtp_pass', value: '' },
        { key: 'smtp_from_email', value: 'contact@retourgagnant.bj' },
        { key: 'smtp_from_name', value: 'Retour Gagnant - Agence' }
    ];

    const frontendSettings = [
        { key: 'frontend_hero_video', value: '/videos/hero-bg.mp4' },
        { key: 'frontend_hero_audio', value: '/audio/ambient.mp3' },
        { key: 'frontend_hero_title', value: 'RETOUR GAGNANT' },
        { key: 'frontend_hero_subtitle', value: 'Batissons l\'avenir de l\'Afrique a travers des projets immobiliers, culturels et touristiques d\'exception.' },
        { key: 'frontend_colors_primary', value: '#008751' },
        { key: 'frontend_colors_accent', value: '#FCD116' },
        { key: 'frontend_navbar_json', value: '[\n        {"label": "Accueil", "href": "/"},\n        {"label": "Boutique", "href": "/boutique"},\n        {"label": "Services", "href": "/services"},\n        {"label": "Culture & Tourisme", "href": "/culture"},\n        {"label": "Rendez-Vous", "href": "/rendez-vous"},\n        {"label": "Contact", "href": "/contact"}\n    ]' }
    ];

    console.log("Inserting email settings...");
    const { error: error1 } = await supabase
        .from('settings')
        .upsert(emailSettings, { onConflict: 'key' });

    if (error1) console.error("Error inserting email settings:", error1);
    else console.log("Email settings inserted/verified.");

    console.log("Inserting frontend settings...");
    const { error: error2 } = await supabase
        .from('settings')
        .upsert(frontendSettings, { onConflict: 'key' });

    if (error2) console.error("Error inserting frontend settings:", error2);
    else console.log("Frontend settings inserted/verified.");
}

main();
