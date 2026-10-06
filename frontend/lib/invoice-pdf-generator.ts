// ══════════════════════════════════════════════════════════════
//  PDF devis/facture côté SERVEUR (emails, app mobile, sauvegardes, reçus).
//
//  Depuis le 29/09/2026, le rendu vient du MODÈLE UNIQUE lib/document-pdf.ts,
//  le même que le portail client et les panels admin/agent : un client voit
//  exactement le même document, qu'il le reçoive par email ou le télécharge.
//  Ce fichier garde l'API historique (generateInvoicePdf → base64) pour ses
//  appelants, et tient à jour le modèle administrable (document_templates).
// ══════════════════════════════════════════════════════════════
import { dessinerDocumentPdf, modeleDepuisContenu, type DocumentPdfDonnees, type DocumentPdfLigne, type ModeleDocument } from './document-pdf'
import { segmentsDocument, appliquerTraductions } from './document-traduction'
import { traduireSegments } from './translation/documents'
import type { LangueDoc } from './document-langues'

export type InvoicePdfItem = DocumentPdfLigne
export type InvoicePdfData = DocumentPdfDonnees

/* Modèle administrable (en-tête, pied, signataire) : relu au plus toutes les
   5 minutes, sans bloquer la génération (les valeurs par défaut du modèle
   sont identiques au contenu en base tant qu'il n'est pas modifié). */
let modeleCache: ModeleDocument | undefined
let modeleLuLe = 0
let lectureEnCours: Promise<void> | null = null

export function rafraichirModeleDocument(): Promise<void> {
    if (lectureEnCours) return lectureEnCours
    lectureEnCours = (async () => {
        try {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (!url || !cle) return
            const r = await fetch(`${url}/rest/v1/document_templates?select=content&id=eq.official_devis_facture`, {
                headers: { apikey: cle, Authorization: `Bearer ${cle}` },
                cache: 'no-store',
            })
            if (r.ok) {
                const [ligne] = await r.json()
                modeleCache = modeleDepuisContenu(ligne?.content)
                modeleLuLe = Date.now()
            }
        } catch { /* on garde le modèle précédent */ } finally {
            lectureEnCours = null
        }
    })()
    return lectureEnCours
}

export function generateInvoicePdf(data: InvoicePdfData): string {
    if (Date.now() - modeleLuLe > 5 * 60_000) void rafraichirModeleDocument()
    const pdf = dessinerDocumentPdf({ ...data, modele: data.modele || modeleCache })
    return Buffer.from(pdf.output('arraybuffer')).toString('base64')
}

/** Même document, dans la langue demandée (textes saisis traduits avec contrôle, libellés fixes écrits par langue). */
export async function generateInvoicePdfLangue(data: InvoicePdfData, langue: LangueDoc): Promise<string> {
    if (langue === 'fr') return generateInvoicePdf(data)
    if (!data.modele && (!modeleCache || Date.now() - modeleLuLe > 5 * 60_000)) await rafraichirModeleDocument()
    const d = { ...data, modele: data.modele || modeleCache }
    const tr = await traduireSegments(segmentsDocument(d), langue)
    return generateInvoicePdf(appliquerTraductions(d, langue, tr))
}
