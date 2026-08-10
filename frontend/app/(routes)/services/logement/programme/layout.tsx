import type { ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { pageMeta, serviceLd, breadcrumbLd, faqLd, ldJson } from '@/lib/seo'

const DESC = "Devenez propriétaire au Bénin : logements économiques et sociaux en location-accession. Éligibilité, catalogue, sites et FAQ."

export const metadata = pageMeta(
    "Programme 20 000 logements (SIMAU) au Bénin | Retour Gagnant",
    DESC,
    "/services/logement/programme",
)

// FAQ récupérées côté serveur → JSON-LD FAQPage (résultats enrichis Google).
async function getFaq(): Promise<Array<{ q: string; r: string }>> {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        )
        const { data } = await supabase.from('logement_content').select('faq').eq('id', 'main').maybeSingle()
        const faq = (data?.faq as Array<{ q: string; r: string }>) || []
        return Array.isArray(faq) ? faq.filter(f => f?.q && f?.r) : []
    } catch { return [] }
}

export default async function Layout({ children }: { children: ReactNode }) {
    const faq = await getFaq()
    const graph: object[] = [
        serviceLd("Programme national des 20 000 logements", DESC, "/services/logement/programme"),
        breadcrumbLd([["Accueil", "/"], ["Services", "/services"], ["Logement", "/services/logement"], ["Programme national", "/services/logement/programme"]]),
    ]
    if (faq.length > 0) graph.push(faqLd(faq))
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(graph) }} />
        </>
    )
}
