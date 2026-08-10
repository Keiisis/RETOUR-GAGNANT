import type { Metadata } from 'next'

export const SITE = {
    base: 'https://www.retourgagnantbenin.bj',
    name: 'Retour Gagnant Bénin',
    ogImage: '/images/hero-bg.jpg',
}

// Métadonnées per-page (titre, description, canonical, Open Graph, Twitter).
export function pageMeta(title: string, description: string, path: string, image?: string): Metadata {
    const url = SITE.base + path
    const img = image || SITE.ogImage
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: {
            title,
            description,
            url,
            siteName: SITE.name,
            type: 'website',
            locale: 'fr_FR',
            images: [{ url: img, width: 1200, height: 630, alt: title }],
        },
        twitter: { card: 'summary_large_image', title, description, images: [img] },
    }
}

const ORG = {
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.base,
    logo: `${SITE.base}/icons/icon-512.png`,
    areaServed: 'BJ',
}

// Donnée structurée : Service (page de service).
export function serviceLd(name: string, description: string, path: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name,
        description,
        provider: ORG,
        areaServed: { '@type': 'Country', name: 'Bénin' },
        url: SITE.base + path,
    }
}

// Donnée structurée : WebPage (page éditoriale / marketing).
export function webPageLd(name: string, description: string, path: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        description,
        url: SITE.base + path,
        isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.base },
        publisher: ORG,
    }
}

// Donnée structurée : fil d'Ariane.
export function breadcrumbLd(items: Array<[string, string]>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map(([name, path], i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name,
            item: SITE.base + path,
        })),
    }
}

// Donnée structurée : FAQPage (à partir d'une liste {q, r}).
export function faqLd(items: Array<{ q: string; r: string }>) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.r },
        })),
    }
}

// Sérialise un ou plusieurs objets JSON-LD pour un <script>.
export function ldJson(objs: object[]): string {
    return JSON.stringify(objs.length === 1 ? objs[0] : objs)
}
