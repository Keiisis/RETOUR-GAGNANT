// ══════════════════════════════════════════════════════════════
//  Traduction d'un devis / d'une facture : découpage et réassemblage.
//
//  Module pur (navigateur + serveur). Le document est découpé en SEGMENTS
//  (un élément de ligne, une ligne de notes ou de conditions, la validité…),
//  traduits ailleurs (lib/translation/documents.ts), puis réassemblés.
//  Ne sont jamais envoyés à la traduction : montants, quantités, dates,
//  numéros, nom et coordonnées du client, mentions légales (RCCM / IFU),
//  nom de la signataire. Tout segment sans traduction valide reste en
//  français : un document partiellement traduit vaut mieux qu'un faux.
// ══════════════════════════════════════════════════════════════
import { MODELE_PAR_DEFAUT, notesPourClient, conditionsPourClient, aDesDebours, type DocumentPdfDonnees } from './document-pdf'
import { elementsDescription } from './description-lignes'
import { libelleMoyenPaiement } from './moyen-paiement-libelle'
import type { LangueDoc } from './document-langues'

const aTraduire = (s: string) => /[a-zà-ÿ]{2}/i.test(s)
const lignes = (s?: string | null) => String(s || '').split('\n').map(l => l.trim()).filter(Boolean)

function modeleDe(d: DocumentPdfDonnees) {
    return { ...MODELE_PAR_DEFAUT, ...Object.fromEntries(Object.entries(d.modele || {}).filter(([, v]) => v)) }
}
/** Lignes de contact de l'en-tête (les lignes légales RCCM/IFU et la raison sociale ne se traduisent pas). */
const contactsEntete = (entete: string) => lignes(entete).slice(1).filter(l => !/RCCM|IFU/i.test(l))
const moyenDe = (d: DocumentPdfDonnees) => libelleMoyenPaiement(d.paymentMethod) || libelleMoyenPaiement(/M[ée]thode\s*:\s*([^\n]+)/i.exec(d.notes || '')?.[1])

/** Tous les textes saisis du document, à traduire (dédoublonnés). */
export function segmentsDocument(d: DocumentPdfDonnees): string[] {
    const m = modeleDe(d)
    const s = [
        ...d.items.flatMap(i => elementsDescription(i.description)),
        ...lignes(notesPourClient(d.notes)),
        ...lignes(conditionsPourClient(d.conditions)),
        d.validite || '',
        ...contactsEntete(m.entete),
        m.titreSignataire,
        moyenDe(d),
    ]
    return [...new Set(s.map(x => x.trim()).filter(aTraduire))]
}

/* Police du PDF (Helvetica, encodage WinAnsi) : un caractère hors de ce jeu
   s'imprime en signes illisibles. On retire les accents inconnus, sinon « ? ». */
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
export function pourPdf(s: string): string {
    return Array.from(s).map(c => {
        const n = c.codePointAt(0)!
        if (c === '\n' || (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WIN_ANSI_EXTRA.includes(c)) return c
        const sans = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
        return sans && sans.codePointAt(0)! <= 0xff ? sans : '?'
    }).join('')
}

/**
 * Document prêt à dessiner dans `langue` : chaque segment remplacé par sa
 * traduction quand elle existe, sinon laissé en français.
 */
export function appliquerTraductions(d: DocumentPdfDonnees, langue: LangueDoc, tr: Record<string, string>): DocumentPdfDonnees {
    if (langue === 'fr') return d
    const t = (s: string) => { const v = tr[s.trim()]; return v ? pourPdf(v) : s }
    const parLigne = (s: string) => lignes(s).map(t).join('\n')
    const m = modeleDe(d)
    const [raison, ...reste] = lignes(m.entete)
    const entete = [raison, ...reste.map(l => (/RCCM|IFU/i.test(l) ? l : t(l)))].join('\n')
    const moyen = moyenDe(d)
    return {
        ...d,
        langue,
        debours: d.debours ?? aDesDebours(d),
        items: d.items.map(i => {
            const el = elementsDescription(i.description).map(t)
            return { ...i, description: el.length > 1 ? el.map(e => `- ${e}`).join('\n') : (el[0] ?? '') }
        }),
        notes: parLigne(notesPourClient(d.notes)) || undefined,
        conditions: parLigne(conditionsPourClient(d.conditions)) || undefined,
        validite: d.validite ? t(d.validite) : d.validite,
        paymentMethod: moyen ? t(moyen) : d.paymentMethod,
        modele: { ...m, entete, titreSignataire: t(m.titreSignataire) },
    }
}
