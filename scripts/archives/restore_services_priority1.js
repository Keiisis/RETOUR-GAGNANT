const { createClient } = require('@supabase/supabase-js');

const s = createClient('https://ywvsfhqdtkgzavxsumnk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM');

async function restoreServices() {
    console.log("Effacement des anciens services (s'il y en a) pour etre sur...");
    await s.from('services').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const services = [
        {
            title: "Passeport & Documents",
            description: "Obtention rapide de vos documents officiels. Le Sceptre (Récade) ouvre toutes les portes.",
            icon: "FileText",
            icon_type: "passport",
            slug: "passeport",
            image_url: "/assets/icones/icone_Passeport_Documents.png",
            color: "#008751",
            order: 1
        },
        {
            title: "Acheter ou Louer",
            description: "Sécurisez vos transactions foncières. Votre forteresse (Tata) au Bénin.",
            icon: "Home",
            icon_type: "tata",
            slug: "logement",
            image_url: "/assets/icones/icone_Acheter_ou_louer.png",
            color: "#FCD116",
            order: 2
        },
        {
            title: "Création d'Entreprise",
            description: "Lancez votre business. Etudes de marché, créations de sociétés et implantation, Recherche de Partenaires.",
            icon: "Briefcase",
            icon_type: "drum",
            slug: "business",
            image_url: "/assets/icones/icone_Creation_d_Entreprise.png",
            color: "#E8112D",
            order: 3
        },
        {
            title: "Guide Culturel",
            description: "Reconnectez-vous avec vos racines. La richesse des Cauris. Cérémonie du Nom et validation à l'état civil.",
            icon: "Map",
            icon_type: "cowrie",
            slug: "culture",
            image_url: "/assets/icones/icone_Guide_culturel.png",
            color: "#008751",
            order: 4
        },
        {
            title: "Construction",
            description: "Bâtissez pour la postérité. Aide aux suivis de chantiers. L'ancrage de l'Assin.",
            icon: "HardHat",
            icon_type: "assin",
            slug: "construction",
            image_url: "/assets/icones/icone_Construction.png",
            color: "#FCD116",
            order: 5
        },
        {
            title: "Investissement",
            description: "Opportunités d'affaires rentables. Faites fructifier votre héritage.",
            icon: "TrendingUp",
            icon_type: "tree",
            slug: "investissement",
            image_url: "/assets/icones/icone_Investissement.png",
            color: "#E8112D",
            order: 6
        }
    ];

    console.log("Insertion des 6 services originaux...");
    const { data, error } = await s.from('services').insert(services).select();

    if (error) {
        console.error("Erreur lors de l'insertion:", error);
    } else {
        console.log("SUCCES ! Services insérés:", data.length);
        data.forEach(d => console.log(` - [${d.order}] ${d.title} (${d.slug})`));
    }
}

restoreServices();
