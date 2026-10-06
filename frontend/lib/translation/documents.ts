// ══════════════════════════════════════════════════════════════
//  Traduction SERVEUR des textes d'un devis / d'une facture.
//
//  Ordre de recherche, du plus sûr au moins sûr :
//    1. table `translations` (corrections validées dans l'admin, puis
//       traductions déjà faites) — même clé que le site ;
//    2. dictionnaire statique versionné (lib/translation/dict/<lang>.json) ;
//    3. IA (Groq), seulement pour ce qui manque.
//  Une traduction n'est retenue QUE si elle garde à l'identique tout ce qui
//  engage : nombres (montants, dates, téléphones, références), e-mails,
//  adresses web, codes (RB/COT/…, FAC-2026-…), noms de marque. Sinon le
//  texte français est conservé — jamais une approximation sur un document
//  financier.
// ══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { fetchWithGroqRotation, GROQ_KEYS, GROQ_MODEL } from '@/lib/groq'
import { SUPPORTED_LANGUAGES } from './constants'
import { extractBrands } from './brands'
import { hashText } from './hash'
import { masquerMarques, demasquerMarques, jetonsIntacts, CONSIGNE_MARQUES, copieDuSource } from './marques'
import type { LangueDoc } from '@/lib/document-langues'

/** Invariants : ce qui doit traverser la traduction sans changer d'un caractère. */
const MOTIFS = [
    /\d+(?:[.,]\d+)*/g,                                  // nombres, montants, dates, téléphones
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,                     // e-mails
    /https?:\/\/\S+|www\.\S+/gi,                         // adresses web
    /\b[A-Z][A-Z0-9]*(?:[/-][A-Z0-9]+)+\b/g,             // codes : RB/COT/26, FAC-2026-0007
]
const empreinte = (s: string) => MOTIFS.map(m => (s.match(m) || []).sort().join('|')).join('§')
const variables = (s: string) => (s.match(/\{[\w.]+\}/g) || []).sort().join('|')

/** La traduction garde-t-elle tout ce qui engage ? */
export function traductionFiable(source: string, traduit: string): boolean {
    if (!traduit || !traduit.trim()) return false
    if (copieDuSource(source, traduit)) return false
    if (/&(apos|quot|amp|#\d+);/.test(traduit)) return false
    return empreinte(source) === empreinte(traduit) && variables(source) === variables(traduit)
}

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Remet les marques masquées ({RG}, {RGB1}…) avec la forme exacte du texte source. */
const restituer = (t: string, vars: Record<string, string>) => t.replace(/\{(RG|RGB1|RGB2)\}/g, (j, k) => vars[k] ?? j)

async function dictionnaire(lang: LangueDoc): Promise<Record<string, string>> {
    try { return (await import(`./dict/${lang}.json`)).default as Record<string, string> } catch { return {} }
}

async function parIA(lang: LangueDoc, textes: string[]): Promise<Record<string, string>> {
    const cfg = SUPPORTED_LANGUAGES.find(l => l.code === lang)
    if (!cfg || !GROQ_KEYS.length || !textes.length) return {}
    const sortie: Record<string, string> = {}
    for (let i = 0; i < textes.length; i += 25) {
        const lot = textes.slice(i, i + 25).map(t => ({ t, ...masquerMarques(t) }))
        const creole = lang === 'cr' || lang === 'ht'
        const prompt = `Translate these lines of a quote / invoice from French to ${cfg.groqName}.
RULES:
1. Return ONLY a JSON object whose keys are the indexes "0", "1"… of the input and whose values are the translations.
2. Keep EVERY number, amount, date, phone number, e-mail, web address and reference code exactly as written.
3. Keep shortcodes like {RG}, {RGB1}, {n} exactly as they are.
4. ${CONSIGNE_MARQUES}
5. Business register: concise, precise, professional. Same punctuation as the source.
5b. CONTEXT: an agency in Benin handling administrative formalities for the African diaspora (nationality, passports, civil status, housing, company creation, ancestry research). In French, « courses » / « courses administratives » means administrative ERRANDS / formalities (never "courses" or "cursos"); « CIP » is the Beninese personal identification certificate (keep "CIP"); « acte » is a civil-status certificate; « afrodescendance » is Afro-descendant heritage.${cfg.promptHint ? `\n6. LANGUAGE CONTEXT: ${cfg.promptHint}` : ''}${creole ? `\n7. You MUST write ${cfg.groqName}, never English, never French.` : ''}

${JSON.stringify(Object.fromEntries(lot.map((x, n) => [String(n), x.texte])))}`
        try {
            const r = await fetchWithGroqRotation({
                model: GROQ_MODEL, temperature: 0.1, max_tokens: 4000,
                messages: [
                    { role: 'system', content: `You translate business documents from French to ${cfg.groqName}. Output only a JSON object.` },
                    { role: 'user', content: prompt },
                ],
            })
            if (!r.ok) continue
            const j = await r.json()
            const brut = JSON.parse(String(j.choices?.[0]?.message?.content || '{}').trim().replace(/^```(json)?/, '').replace(/```$/, '').trim())
            lot.forEach((x, n) => {
                const v = brut[String(n)]
                if (typeof v !== 'string' || !jetonsIntacts(v, x.remplacements.length)) return
                const t = demasquerMarques(v, x.remplacements)
                if (traductionFiable(x.t, t)) sortie[x.t] = t
            })
        } catch { /* IA indisponible : ces segments restent en français */ }
    }
    return sortie
}

/**
 * Traduit des segments de document. Renvoie { segment source → traduction }
 * pour les seuls segments traduits de façon fiable ; les autres sont absents
 * (l'appelant garde le français).
 */
export async function traduireSegments(segments: string[], lang: LangueDoc): Promise<Record<string, string>> {
    if (lang === 'fr') return {}
    const sources = [...new Set(segments.map(s => s.trim()).filter(Boolean))]
    if (!sources.length) return {}
    const infos = sources.map(s => { const { maskedText, extractedVars } = extractBrands(s); return { s, m: maskedText, vars: extractedVars, h: hashText(maskedText) } })

    const base = new Map<string, string>()
    const sb = db()
    for (let i = 0; i < infos.length; i += 200) {
        const { data } = await sb.from('translations').select('source_hash, translated_text').eq('lang', lang).in('source_hash', infos.slice(i, i + 200).map(x => x.h))
        for (const r of data || []) base.set(r.source_hash, r.translated_text)
    }
    const dict = await dictionnaire(lang)

    const resultat: Record<string, string> = {}
    const manquants: typeof infos = []
    for (const x of infos) {
        const candidat = [base.get(x.h), dict[x.h]].find(c => c && traductionFiable(x.m, c))
        if (candidat) resultat[x.s] = restituer(candidat, x.vars)
        else manquants.push(x)
    }

    if (manquants.length) {
        const ia = await parIA(lang, manquants.map(x => x.m))
        const lignes = manquants.filter(x => ia[x.m]).map(x => ({ source_text: x.m, source_hash: x.h, lang, translated_text: ia[x.m], context: 'document' }))
        for (const x of manquants) if (ia[x.m]) resultat[x.s] = restituer(ia[x.m], x.vars)
        if (lignes.length) await sb.from('translations').upsert(lignes, { onConflict: 'source_hash,lang', ignoreDuplicates: true })
    }
    return resultat
}

/**
 * Corrections validées par l'équipe (relecture d'un devis avant envoi) :
 * elles priment ensuite partout (site, documents). Refusées si elles
 * altèrent un nombre, un e-mail, un code ou une marque.
 */
export async function enregistrerCorrections(lang: LangueDoc, corrections: Record<string, string>): Promise<{ ok: number; refusees: string[] }> {
    const lignes: { source_text: string; source_hash: string; lang: string; translated_text: string; context: string }[] = []
    const refusees: string[] = []
    for (const [source, traduit] of Object.entries(corrections)) {
        const { maskedText, extractedVars } = extractBrands(source.trim())
        // la correction est saisie avec les marques en clair : on la masque comme la source
        const t = Object.entries(extractedVars).reduce((acc, [k, v]) => acc.split(v).join(`{${k}}`), traduit.trim())
        if (!traductionFiable(maskedText, t)) { refusees.push(source); continue }
        lignes.push({ source_text: maskedText, source_hash: hashText(maskedText), lang, translated_text: t, context: 'document_valide' })
    }
    if (lignes.length) {
        const { error } = await db().from('translations').upsert(lignes, { onConflict: 'source_hash,lang' })
        if (error) throw error
    }
    return { ok: lignes.length, refusees }
}
