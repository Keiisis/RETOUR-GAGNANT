/* Message de remerciement dynamique quand un dossier est TERMINÉ.
   Chaque service a une clause naturelle (on ne dit jamais « l'obtention de votre
   Acheter ou Louer »). Repli neutre et toujours grammatical pour tout service
   inconnu. L'ordre des tests évite les collisions (« Racines » apparaît dans
   « Langues & Racines » ET « Prêtres Fa & Racines » : on teste ceux-là avant). */
export function serviceCompletionPhrase(serviceType: string | null | undefined): string {
    const s = (serviceType || '').toLowerCase()

    if (s.includes('passeport')) return "pour l'obtention de votre passeport"
    if (s.includes('nationalit')) return 'pour la reconnaissance de votre nationalité béninoise'
    if (s.includes('permis')) return "pour l'obtention de votre permis de conduire"
    if (s.includes('entreprise') || s.includes('business') || s.includes('société') || s.includes('societe')) {
        return 'pour la création de votre entreprise'
    }
    if (s.includes('investiss')) return "pour votre projet d'investissement"
    if (s.includes('logement') || s.includes('immobil') || s.includes('acheter') || s.includes('louer') || s.includes('rent')) {
        return 'pour votre projet immobilier'
    }
    if (s.includes('construction') || s.includes('construire')) return 'pour votre projet de construction'
    if (s.includes('langue')) return 'pour votre accompagnement linguistique'
    if (s.includes('prêtre') || s.includes('pretre') || s.includes('fa &') || s.includes('consultation fa')) {
        return 'pour votre consultation du Fa'
    }
    if (s.includes('ancestral') || s.includes('généalog') || s.includes('genealog') || s.includes('recherche')) {
        return 'pour votre recherche ancestrale'
    }
    if (s.includes('culture') || s.includes('culturel')) return 'pour votre accompagnement culturel'

    return 'pour votre accompagnement'
}

/** Phrase complète (à passer à t() pour traduction). */
export function thankYouMessage(serviceType: string | null | undefined): string {
    return `Merci d'avoir fait confiance à Retour Gagnant Bénin ${serviceCompletionPhrase(serviceType)}.`
}
