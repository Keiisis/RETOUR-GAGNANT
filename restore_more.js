const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ywvsfhqdtkgzavxsumnk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM');

async function repairPatrimoine() {
    console.log("Restoring Patrimoine & Culture data...");

    // Check if table exists
    const { error: testErr } = await s.from('patrimoine').select('id').limit(1);
    if (testErr && testErr.message.includes('does not exist')) {
        console.log("Table patrimoine does not exist. It may be using fallbacks in the frontend.");
        return;
    }

    // Delete existing to reset cleanly
    await s.from('patrimoine').delete().neq('title', 'placeholder');

    const patrimoines = [
        { title: "Porte du Non-Retour", description: "Symbole mémoriel historique de la traite transatlantique.", imageName: "Porte du Non-Retour.jpg" },
        { title: "Palais Royaux d'Abomey", description: "Vestiges de la puissance du Royaume de Dahomey.", imageName: "Palais Royaux Abomey.jpg" },
        { title: "Cité Lacustre de Ganvié", description: "La Venise de l'Afrique, entièrement bâtie sur l'eau.", imageName: "Cité Lacustre Ganvié.jpg" },
        { title: "Tata Somba", description: "Architecture forteresse unique au monde.", imageName: "TATA SOMBA.jpg" },
        { title: "Zangbeto", description: "Gardien de la nuit et police traditionnelle vaudou.", imageName: "Zangpeto.jpg" },
        { title: "Chutes de Kota", description: "Un havre de fraîcheur et de nature préservée.", imageName: "Chutes de Kota.jpg" },
        { title: "Place de l'Amazone", description: "Monument majestueux rendant hommage aux guerrières Agoodjié du Dahomey, symbole de la bravoure et de la force féminine au Bénin.", imageName: "place-amazone.jpg" },
        { title: "Monument Bio Guerra", description: "Statue équestre honorant le héros national Bio Guerra, figure de proue de la résistance contre la colonisation dans le nord du pays.", imageName: "bio-guera.jpg" },
        { title: "Temple des Pythons", description: "Site sacré à Ouidah dédié au culte du python, illustrant la cohabitation pacifique entre l'homme, la nature et le sacré.", imageName: "ouidah-temple-python-3.jpg" },
        { title: "Grand-Popo", description: "Cité balnéaire pittoresque entre mer et fleuve, réputée pour ses plages de sable fin et son patrimoine colonial préservé.", imageName: "Grand-Popo.jpg" },
        { title: "Mur de Fresques de Cotonou", description: "L'une des plus longues fresques murales d'Afrique, racontant l'histoire et les aspirations du peuple béninois à travers l'art urbain.", imageName: "Mur de Fresque de Cotonou.jpg" },
        { title: "Parc National de la Pendjari", description: "Joyau de la biodiversité ouest-africaine, ce sanctuaire sauvage abrite lions, éléphants et une faune exceptionnelle dans un cadre protégé.", imageName: "Parc Pendjari.jpg" }
    ];

    const { error: insErr } = await s.from('patrimoine').insert(patrimoines);

    if (insErr) {
        console.log("Error inserting patrimoine:", insErr.message);

        // Let's try inserting with different column name (image_url instead of imageName)
        console.log("Trying alternative schema (image_url)...");
        const patrimoinesAlt = patrimoines.map(p => ({
            title: p.title,
            description: p.description,
            image_url: p.imageName
        }));
        const { error: insErr2 } = await s.from('patrimoine').insert(patrimoinesAlt);
        if (insErr2) console.log("Still failed:", insErr2.message);
        else console.log("Successfully restored patrimoine with image_url column!");
    } else {
        console.log("Successfully restored 12 patrimoine locations!");
    }
}

async function repairTestimonials() {
    console.log("Restoring Testimonials / Avis clients...");
    await s.from('testimonials').delete().neq('name', 'placeholder');

    const testimonials = [
        { name: "Aminata Diallo", role: "Entrepreneur", content: "Grâce à Retour Gagnant, mon installation s'est faite en douceur. Leur service de conciergerie est exceptionnel.", is_active: true, rating: 5 },
        { name: "Jean-Pierre Mensah", role: "Investisseur", content: "Une équipe professionnelle qui a su m'accompagner dans toutes mes démarches d'investissement immobilier au Bénin.", is_active: true, rating: 5 },
        { name: "Sophie et Marc", role: "Retraités", content: "Nous avons trouvé la maison de nos rêves grâce à eux. Un suivi de bout en bout rassurant.", is_active: true, rating: 4 }
    ];

    const { error } = await s.from('testimonials').insert(testimonials);
    if (error) console.log("Testimonial error:", error.message);
    else console.log("Restored testimonials.");
}

async function run() {
    await repairPatrimoine();
    await repairTestimonials();
}
run();
