import { createClient } from '@supabase/supabase-js'

export async function getServerTranslation(locale: string = 'fr') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    // Pour le serveur, on utilise la clé de service pour contourner le RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer toutes les traductions de la base
    const { data, error } = await supabase.from('translations').select('*');

    if (error) {
        console.error("Erreur serveur lors du chargement des traductions:", error);
    }

    const translations: Record<string, string> = {};
    if (data) {
        data.forEach((item: any) => {
            const translatedText = item[locale];
            // On stocke la valeur traduite, sinon on garde la clé d'origine
            translations[item.key] = translatedText ? translatedText : item.key;
        });
    }

    // Retourne la fonction "t" utilisable côté serveur
    return function t(key: string): string {
        return translations[key] || key;
    };
}
