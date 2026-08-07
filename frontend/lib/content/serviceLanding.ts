// ══════════════════════════════════════════════════════════════
//  Schéma GÉNÉRIQUE d'une landing de service (style logement / VIP)
//  Réutilisé par plusieurs pages (passeport, business, …). Chaque page
//  fournit ses valeurs par défaut et stocke ses overrides dans
//  page_sections(page='<slug>', section_key='page_content').content.
// ══════════════════════════════════════════════════════════════

export interface Pilier { title: string; desc: string }
export interface Etape { num: string; title: string; desc: string }
export interface Reassurance { title: string; desc: string }
export interface FaqQA { q: string; r: string }

export interface ServiceLandingContent {
    // Hero
    hero_badge: string
    hero_title: string
    hero_subtitle: string
    hero_chips: string[]
    hero_image: string
    cta1_label: string
    cta1_href: string
    cta2_label: string
    cta2_href: string
    // Piliers (bande verte) — 4 icônes fixes
    piliers: Pilier[]
    // Intro + étapes
    intro_eyebrow: string
    intro_title: string
    intro_text: string
    etapes_title: string
    etapes: Etape[]
    // Contraste solo vs accompagné
    contrast_title: string
    contrast_accent: string
    contrast_intro: string
    solo: string[]
    avec: string[]
    // Bloc liste (pièces / prestations)
    features_eyebrow: string
    features_title: string
    features_intro: string
    features: string[]
    features_note: string
    // Réassurance — 3 icônes fixes
    reassurance: Reassurance[]
    // FAQ
    faq: FaqQA[]
    // CTA final
    final_title: string
    final_text: string
    final_note: string
}

// Fusionne des overrides partiels (DB) sur des valeurs par défaut.
export function mergeServiceLanding(def: ServiceLandingContent, over?: Partial<ServiceLandingContent> | null): ServiceLandingContent {
    return { ...def, ...(over || {}) }
}
