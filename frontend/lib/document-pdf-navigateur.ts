'use client'
// ══════════════════════════════════════════════════════════════
//  Téléchargement d'un devis / d'une facture depuis le NAVIGATEUR
//  (portail client, panel admin, panel agent) — même modèle que les emails
//  et l'app mobile : lib/document-pdf.ts.
// ══════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'
import { dessinerDocumentPdf, modeleDepuisContenu, nomFichierDocument, type DocumentPdfDonnees, type ModeleDocument } from './document-pdf'
import { appliquerTraductions } from './document-traduction'
import type { LangueDoc } from './document-langues'

/** Ligne `documents_financiers` (champs utiles au rendu). */
export interface DocumentSource {
    id?: string
    type?: string | null
    numero: string
    status?: string | null
    created_at: string
    paid_at?: string | null
    due_date?: string | null
    signed_at?: string | null
    validite?: string | null
    client_nom?: string | null
    client_prenom?: string | null
    client_email?: string | null
    client_phone?: string | null
    client_adresse?: string | null
    items?: { description?: string; quantity?: number; unit_price?: number; tva?: number }[] | null
    currency?: string | null
    sous_total?: number | null
    total_tva?: number | null
    remise?: number | null
    total?: number | null
    notes?: string | null
    conditions?: string | null
    signature_url?: string | null
    payment_method?: string | null
    payment_provider?: string | null
    mecef_code?: string | null
    mecef_nim?: string | null
    mecef_counters?: string | null
    mecef_datetime?: string | null
    mecef_qr?: string | null
}

async function enDataUrl(src?: string | null): Promise<string | undefined> {
    if (!src) return undefined
    if (src.startsWith('data:image/')) return src
    try {
        const r = await fetch(src)
        if (!r.ok) return undefined
        const blob = await r.blob()
        return await new Promise<string | undefined>(res => {
            const fr = new FileReader()
            fr.onload = () => res(typeof fr.result === 'string' ? fr.result : undefined)
            fr.onerror = () => res(undefined)
            fr.readAsDataURL(blob)
        })
    } catch { return undefined }
}

async function chargerModele(client?: SupabaseClient): Promise<ModeleDocument | undefined> {
    if (!client) return undefined
    try {
        const { data } = await client.from('document_templates').select('content').eq('id', 'official_devis_facture').maybeSingle()
        return modeleDepuisContenu(data?.content as Record<string, unknown> | undefined)
    } catch { return undefined }
}

export async function donneesDepuisDocument(doc: DocumentSource, client?: SupabaseClient): Promise<DocumentPdfDonnees> {
    const type = (doc.type || 'facture').toLowerCase()
    const statut = (doc.status || '').toLowerCase()
    const [modele, signature, qr] = await Promise.all([
        chargerModele(client),
        enDataUrl(doc.signature_url),
        doc.mecef_qr
            ? import('qrcode').then(m => m.default.toDataURL(doc.mecef_qr as string, { margin: 0, width: 220 })).catch(() => undefined)
            : Promise.resolve(undefined),
    ])
    return {
        invoiceRef: doc.numero,
        date: doc.created_at,
        paidAt: doc.paid_at || undefined,
        isPaid: statut === 'paye' || !!doc.paid_at,
        clientName: [doc.client_prenom, doc.client_nom].filter(Boolean).join(' '),
        clientEmail: doc.client_email || undefined,
        clientPhone: doc.client_phone || undefined,
        clientAddress: doc.client_adresse || undefined,
        items: (doc.items || []).map(i => ({
            description: String(i.description || ''),
            quantity: Number(i.quantity) || 0,
            unit_price: Number(i.unit_price) || 0,
            tva: Number(i.tva) || 0,
        })),
        currency: doc.currency || 'XOF',
        sous_total: Number(doc.sous_total) || 0,
        total_tva: Number(doc.total_tva) || 0,
        remise: Number(doc.remise) || 0,
        total: Number(doc.total) || 0,
        notes: doc.notes || undefined,
        conditions: doc.conditions || undefined,
        validite: doc.validite || undefined,
        docType: type === 'devis' ? 'devis' : type === 'avoir' ? 'avoir' : 'facture',
        statut,
        signedAt: doc.signed_at || undefined,
        dueDate: doc.due_date || undefined,
        paymentMethod: doc.payment_method || doc.payment_provider || undefined,
        clientSignatureDataUrl: signature,
        mecef: (doc.mecef_code || doc.mecef_nim)
            ? { code: doc.mecef_code || undefined, nim: doc.mecef_nim || undefined, compteurs: doc.mecef_counters || undefined, dateHeure: doc.mecef_datetime || undefined, qrDataUrl: qr }
            : undefined,
        modele,
    }
}

/** Traductions des textes saisis du document (segment français → traduction). Vide si indisponible. */
export async function traductionsDocument(id: string, langue: LangueDoc): Promise<Record<string, string>> {
    if (langue === 'fr' || !id) return {}
    try {
        const r = await fetch(`/api/documents/traduction?id=${encodeURIComponent(id)}&lang=${langue}`, { cache: 'no-store' })
        return r.ok ? ((await r.json()).traductions || {}) : {}
    } catch { return {} }
}

/** PDF du document dans la langue demandée, avec son nom de fichier. */
async function pdfDocument(doc: DocumentSource, client: SupabaseClient | undefined, langue: LangueDoc) {
    const [donnees, tr] = await Promise.all([
        donneesDepuisDocument(doc, client),
        doc.id ? traductionsDocument(doc.id, langue) : Promise.resolve({}),
    ])
    const final = langue === 'fr' ? donnees : appliquerTraductions(donnees, langue, tr)
    const nom = nomFichierDocument(donnees.docType, doc.numero).replace(/\.pdf$/, langue === 'fr' ? '.pdf' : `_${langue}.pdf`)
    return { pdf: dessinerDocumentPdf(final), nom }
}

/** Génère et télécharge le PDF du document, dans la langue demandée (français par défaut). */
export async function telechargerDocumentPdf(doc: DocumentSource, client?: SupabaseClient, langue: LangueDoc = 'fr'): Promise<void> {
    const { pdf, nom } = await pdfDocument(doc, client, langue)
    pdf.save(nom)
}

/** Même PDF, en base64 (pièce jointe d'un email). */
export async function documentPdfBase64(doc: DocumentSource, client?: SupabaseClient, langue: LangueDoc = 'fr'): Promise<{ nom: string; base64: string }> {
    const { pdf, nom } = await pdfDocument(doc, client, langue)
    return { nom, base64: pdf.output('datauristring').split(',')[1] }
}
