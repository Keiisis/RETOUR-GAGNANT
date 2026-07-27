// ══════════════════════════════════════════════════════════════
//  CLIENT API e-MCF / MECeF — SYGMEF (DGI Bénin)
//  Normalise une facture directement via l'API DGI au lieu de la saisie
//  manuelle. Flux standard :
//    1. POST /invoice          → crée le brouillon, renvoie un identifiant.
//    2. PUT  /invoice/{id}/confirm → renvoie la normalisation fiscale
//       (NIM, code de contrôle, compteurs, date/heure, contenu du QR).
//
//  ⚠️ Contrat à VALIDER en sandbox (developper.sygmef.impots.bj) :
//     - noms exacts des endpoints et des champs de réponse (parsing défensif
//       ci-dessous : nim/NIM, code/codeMECeFDGI/signature, qrCode/qr…) ;
//     - sémantique du prix : ici on envoie le PRIX UNITAIRE TTC (les prix
//       e-MCF sont taxe-incluse, le groupe encode le taux). À confirmer au
//       1er appel réel — la config `mecef_price_ttc=false` permet de basculer.
//
//  Toute la config (jeton, sandbox, opérateur) vient de la table `settings`
//  (catégorie `mecef`) — jamais codée en dur.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export interface MecefConfig {
    enabled: boolean
    sandbox: boolean
    token: string
    operatorId: string
    operatorName: string
    aib: string          // '', 'A' (1%) ou 'B' (5%) — acompte impôt bénéfices
    priceTtc: boolean     // true = on envoie le prix TTC (défaut), false = HT
}

export interface MecefResult {
    nim: string
    code: string          // code de contrôle (codeMECeFDGI)
    counters: string
    qr: string            // contenu à encoder dans le QR
    datetime: string      // ISO
    raw: unknown          // réponse brute (diagnostic sandbox)
}

interface InvoiceDoc {
    type?: string | null
    numero?: string | null
    client_nom?: string | null
    client_prenom?: string | null
    client_email?: string | null
    client_phone?: string | null
    client_ifu?: string | null
    currency?: string | null
    payment_method?: string | null
    items?: Array<{ description?: string; quantity?: number; unit_price?: number; tva?: number }> | null
    total?: number | null
}

const BASE = {
    sandbox: 'https://developper.sygmef.impots.bj/api',
    prod: 'https://sygmef.impots.bj/api',
}

/** Lit la configuration MECeF depuis la table settings (catégorie `mecef`). */
export async function getMecefConfig(supabase: SupabaseClient): Promise<MecefConfig> {
    const { data } = await supabase.from('settings').select('key, value').eq('category', 'mecef')
    const m: Record<string, string> = {}
    for (const row of data || []) m[row.key] = row.value || ''
    const truthy = (v: string) => v === 'true' || v === '1' || v === 'on'
    return {
        enabled: truthy(m.mecef_enabled),
        sandbox: m.mecef_sandbox === '' ? true : truthy(m.mecef_sandbox), // sandbox par défaut
        token: m.mecef_token || '',
        operatorId: m.mecef_operator_id || 'CAISSE',
        operatorName: m.mecef_operator_name || 'RETOUR GAGNANT',
        aib: m.mecef_aib || '',
        priceTtc: m.mecef_price_ttc === '' ? true : truthy(m.mecef_price_ttc),
    }
}

/** Groupe de taxe e-MCF : B = 18 % (taux normal), D = exonéré. */
function taxGroup(tva: number): string {
    return Number(tva) > 0 ? 'B' : 'D'
}

/** Mappe le moyen de paiement interne vers le libellé e-MCF. */
function paymentName(method: string | null | undefined): string {
    const m = (method || '').toLowerCase()
    if (['kkiapay', 'fedapay', 'zeyow', 'momo', 'mtn', 'moov', 'mobile'].some(x => m.includes(x))) return 'MOBILE_MONEY'
    if (['stripe', 'paypal', 'card', 'carte', 'visa', 'mastercard'].some(x => m.includes(x))) return 'CARTE_BANCAIRE'
    if (m.includes('cheque') || m.includes('chèque')) return 'CHEQUE'
    if (m.includes('virement')) return 'VIREMENT'
    if (m.includes('espece') || m.includes('espèce') || m.includes('cash')) return 'ESPECES'
    return 'ESPECES'
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Construit le payload e-MCF à partir d'un document financier. */
function buildPayload(doc: InvoiceDoc, cfg: MecefConfig) {
    const items = (doc.items || []).map(it => {
        const ht = Number(it.unit_price) || 0
        const tva = Number(it.tva) || 0
        const unit = cfg.priceTtc ? round2(ht * (1 + tva / 100)) : ht
        return {
            name: String(it.description || 'Article').slice(0, 120),
            price: unit,
            quantity: Number(it.quantity) || 1,
            taxGroup: taxGroup(tva),
        }
    })

    const clientName = `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || 'Client'
    const total = Number(doc.total) || items.reduce((s, i) => s + i.price * i.quantity, 0)

    return {
        ifu: doc.client_ifu || undefined,
        aib: cfg.aib || undefined,
        type: doc.type === 'avoir' ? 'EV' : 'FV',
        items,
        client: doc.client_ifu
            ? { ifu: doc.client_ifu, name: clientName, contact: doc.client_phone || undefined }
            : { name: clientName, contact: doc.client_phone || undefined },
        operator: { id: cfg.operatorId, name: cfg.operatorName },
        payment: [{ name: paymentName(doc.payment_method), amount: round2(total) }],
        reference: doc.numero || undefined,
    }
}

/** Extrait de façon défensive les champs de normalisation (noms variables selon version). */
function pick(obj: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
        const v = obj[k]
        if (v != null && String(v).trim() !== '') return String(v)
    }
    return ''
}

/**
 * Normalise une facture via l'API e-MCF DGI.
 * @throws Error avec le message renvoyé par la DGI si l'appel échoue.
 */
export async function normalizeInvoice(doc: InvoiceDoc, cfg: MecefConfig): Promise<MecefResult> {
    if (!cfg.token) throw new Error('Jeton e-MCF manquant (Réglages → e-MCF).')
    const base = cfg.sandbox ? BASE.sandbox : BASE.prod
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
    }

    // 1) Création du brouillon
    const createRes = await fetch(`${base}/invoice`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPayload(doc, cfg)),
    })
    const createTxt = await createRes.text()
    let created: Record<string, unknown> = {}
    try { created = JSON.parse(createTxt) } catch { /* réponse non-JSON */ }
    if (!createRes.ok) {
        throw new Error(`DGI e-MCF (création) : ${createRes.status} — ${pick(created, ['message', 'error', 'errorDesc']) || createTxt.slice(0, 200)}`)
    }

    const uid = pick(created, ['uid', 'id', 'token', 'invoiceId'])
    // Certaines versions normalisent dès le POST : si le NIM est déjà présent, on ne confirme pas.
    let confirmed: Record<string, unknown> = created
    const alreadyNormalized = pick(created, ['nim', 'NIM']) !== ''

    if (!alreadyNormalized) {
        if (!uid) throw new Error('DGI e-MCF : identifiant de facture introuvable dans la réponse.')
        // 2) Confirmation → normalisation
        const confRes = await fetch(`${base}/invoice/${encodeURIComponent(uid)}/confirm`, {
            method: 'PUT',
            headers,
        })
        const confTxt = await confRes.text()
        try { confirmed = JSON.parse(confTxt) } catch { confirmed = {} }
        if (!confRes.ok) {
            throw new Error(`DGI e-MCF (confirmation) : ${confRes.status} — ${pick(confirmed, ['message', 'error', 'errorDesc']) || confTxt.slice(0, 200)}`)
        }
    }

    const nim = pick(confirmed, ['nim', 'NIM'])
    const code = pick(confirmed, ['codeMECeFDGI', 'code', 'signature', 'controlCode'])
    if (!nim && !code) {
        throw new Error('DGI e-MCF : réponse sans NIM ni code de contrôle (contrat à ajuster).')
    }
    const dt = pick(confirmed, ['dateTime', 'datetime', 'date', 'timestamp'])

    return {
        nim,
        code,
        counters: pick(confirmed, ['counters', 'compteur', 'compteurs']),
        qr: pick(confirmed, ['qrCode', 'qr', 'qrcode', 'codeQR']),
        datetime: dt ? new Date(dt.replace(' ', 'T')).toISOString() : new Date().toISOString(),
        raw: confirmed,
    }
}
