// ══════════════════════════════════════════════════════════════
//  Adresse publique d'une page de service à partir de son slug en base.
//
//  Le slug interne `nationalite-vip` (clé des tables services / page_sections)
//  est conservé, mais la page publique est /services/nationalite-beninoise :
//  le mot « VIP » ne doit plus apparaître côté client (décision du 30/09/2026).
//  L'ancienne adresse redirige de façon permanente (next.config.ts).
// ══════════════════════════════════════════════════════════════
const ADRESSES: Record<string, string> = {
    'nationalite-vip': '/services/nationalite-beninoise',
}

export function lienService(slug: string): string {
    return ADRESSES[slug] || `/services/${slug}`
}
