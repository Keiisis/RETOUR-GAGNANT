const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://ywvsfhqdtkgzavxsumnk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM');

async function repair() {
    console.log("Restoring Patrimoine & Culture data...");

    // Using lowercase 'imagename' because postgres folds unquoted identifiers to lowercase
    const patrimoines = [
        { title: "Porte du Non-Retour", description: "Symbole mémoriel historique de la traite transatlantique.", imagename: "Porte du Non-Retour.jpg" },
        { title: "Palais Royaux d'Abomey", description: "Vestiges de la puissance du Royaume de Dahomey.", imagename: "Palais Royaux Abomey.jpg" },
        { title: "Cité Lacustre de Ganvié", description: "La Venise de l'Afrique, entièrement bâtie sur l'eau.", imagename: "Cité Lacustre Ganvié.jpg" },
        { title: "Tata Somba", description: "Architecture forteresse unique au monde.", imagename: "TATA SOMBA.jpg" },
        { title: "Zangbeto", description: "Gardien de la nuit et police traditionnelle vaudou.", imagename: "Zangpeto.jpg" },
        { title: "Chutes de Kota", description: "Un havre de fraîcheur et de nature préservée.", imagename: "Chutes de Kota.jpg" },
        { title: "Place de l'Amazone", description: "Monument majestueux rendant hommage aux guerrières Agoodjié du Dahomey, symbole de la bravoure et de la force féminine au Bénin.", imagename: "place-amazone.jpg" },
        { title: "Monument Bio Guerra", description: "Statue équestre honorant le héros national Bio Guerra, figure de proue de la résistance contre la colonisation dans le nord du pays.", imagename: "bio-guera.jpg" },
        { title: "Temple des Pythons", description: "Site sacré à Ouidah dédié au culte du python, illustrant la cohabitation pacifique entre l'homme, la nature et le sacré.", imagename: "ouidah-temple-python-3.jpg" },
        { title: "Grand-Popo", description: "Cité balnéaire pittoresque entre mer et fleuve, réputée pour ses plages de sable fin et son patrimoine colonial préservé.", imagename: "Grand-Popo.jpg" },
        { title: "Mur de Fresques de Cotonou", description: "L'une des plus longues fresques murales d'Afrique, racontant l'histoire et les aspirations du peuple béninois à travers l'art urbain.", imagename: "Mur de Fresque de Cotonou.jpg" },
        { title: "Parc National de la Pendjari", description: "Joyau de la biodiversité ouest-africaine, ce sanctuaire sauvage abrite lions, éléphants et une faune exceptionnelle dans un cadre protégé.", imagename: "Parc Pendjari.jpg" }
    ];

    const { error: pErr } = await s.from('patrimoine').insert(patrimoines);
    if (pErr) console.error("Patrimoine error:", pErr);
    else console.log("Patrimoine restauré avec succès ! ✓");

    console.log("Restoring Testimonials...");
    const testimonials = [
        { name: "Aminata Diallo", service: "Conciergerie", text: "Grâce à Retour Gagnant, mon installation s'est faite en douceur. Leur service de conciergerie est exceptionnel.", approved: true, rating: 5 },
        { name: "Jean-Pierre Mensah", service: "Investissement", text: "Une équipe professionnelle qui a su m'accompagner dans toutes mes démarches d'investissement immobilier au Bénin.", approved: true, rating: 5 },
        { name: "Sophie et Marc", service: "Logement", text: "Nous avons trouvé la maison de nos rêves grâce à eux. Un suivi de bout en bout rassurant.", approved: true, rating: 4 }
    ];

    const { error: tErr } = await s.from('testimonials').insert(testimonials);
    if (tErr) console.error("Testimonial error:", tErr);
    else console.log("Avis clients restaurés avec succès ! ✓");
}

repair();
