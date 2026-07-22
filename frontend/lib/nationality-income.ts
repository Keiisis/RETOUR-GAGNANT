// ══════════════════════════════════════════════════════════════
//  ENREGISTREMENT COMPTABLE D'UN PAIEMENT DE DOSSIER NATIONALITÉ
//  Les paiements en ligne (Kkiapay) du formulaire nationalité étaient
//  encaissés SANS trace dans facturation / comptabilité. Ce helper crée
//  UNE facture (statut payé) par dossier — idempotent via la référence
//  RG-NAT dans les notes. Le cas « facture manuelle sélectionnée » par
//  l'admin possède déjà sa propre facture : on ne double PAS.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from './document-numbering'

export async function recordNationalityIncome(
    supabase: SupabaseClient,
    p: {
        ref: string                 // RG-NAT-YYYY-XXXX
        nom?: string | null
        prenom?: string | null
        email?: string | null
        phone?: string | null
        amount: number
        currency?: string | null
        paymentMethod?: string | null
        txId?: string | null
        isMyafro?: boolean
    },
): Promise<void> {
    try {
        if (!p.ref || !p.amount || p.amount <= 0) return

        // Idempotence : une seule facture par dossier (ref dans les notes)
        const { data: existing } = await supabase
            .from('documents_financiers')
            .select('id')
            .ilike('notes', `%${p.ref}%`)
            .maybeSingle()
        if (existing) return

        const currency = (p.currency || 'EUR').toUpperCase()
        let exchangeRate = 1
        if (currency !== 'XOF') {
            const { data: cur } = await supabase
                .from('currencies').select('exchange_rate_to_base').eq('code', currency).maybeSingle()
            if (cur) exchangeRate = Number(cur.exchange_rate_to_base) || 1
        }

        const label = p.isMyafro
            ? 'Reprise de dossier de nationalité béninoise (MyAfroOrigins)'
            : 'Dossier de reconnaissance de nationalité béninoise'
        const numero = await nextDocumentNumber(supabase, 'facture')

        await supabase.from('documents_financiers').insert({
            type: 'facture',
            numero,
            client_nom: p.nom || 'Client',
            client_prenom: p.prenom || '',
            client_email: p.email || '',
            client_phone: p.phone || '',
            client_adresse: '',
            currency,
            exchange_rate_applied: exchangeRate,
            items: [{ description: label, quantity: 1, unit_price: p.amount, tva: 0 }],
            sous_total: p.amount,
            total_tva: 0,
            remise: 0,
            total: p.amount,
            status: 'paye',
            paid_at: new Date().toISOString(),
            notes: `Facture auto-générée — Nationalité\nDossier: ${p.ref}\nMéthode: ${p.paymentMethod || 'en ligne'}${p.txId ? `\nTransaction: ${p.txId}` : ''}`,
            conditions: 'Document généré automatiquement après paiement vérifié.',
            validite: 'Acquittée',
        })
    } catch (e) {
        console.error('[recordNationalityIncome]', e instanceof Error ? e.message : e)
    }
}
