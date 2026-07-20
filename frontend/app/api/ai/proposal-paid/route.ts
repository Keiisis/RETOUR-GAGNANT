import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from '@/lib/document-numbering'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Formatage serveur-side des devises (pas d'import client-side)
const CURRENCY_SYMBOLS: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const formatAmount = (amount: number, cur: string) => {
    const symbol = CURRENCY_SYMBOLS[cur] || cur
    const formatted = Math.round(amount).toLocaleString('fr-FR')
    if (cur === 'USD') return `$${formatted}`
    return `${formatted} ${symbol}`
}

export async function POST(req: Request) {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const body = await req.json()
        const { proposal_id, client_email, client_name } = body

        if (!proposal_id) {
            return NextResponse.json({ error: 'proposal_id requis' }, { status: 400 })
        }

        // Marquer la proposition comme "paid"
        const { error } = await supabase
            .from('ai_client_proposals')
            .update({ status: 'paid' })
            .eq('id', proposal_id)

        if (error) {
            console.error('Erreur update proposal:', error)
            return NextResponse.json({ error: 'Mise à jour échouée' }, { status: 500 })
        }

        // Récupérer les détails complets de la proposition
        const { data: proposal } = await supabase
            .from('ai_client_proposals')
            .select('*')
            .eq('id', proposal_id)
            .single()

        if (!proposal) {
            return NextResponse.json({ success: true, warning: 'Proposal not found for invoice generation' })
        }

        const proposalCurrency = (proposal.currency || 'XOF').toUpperCase()

        // ═══════════════════════════════════════════════════════════
        //  FIX CRITIQUE : Auto-génération Facture ERP
        // Les revenus IA doivent apparaître dans documents_financiers
        // ═══════════════════════════════════════════════════════════
        try {
            // Garde d'idempotence : éviter les doublons
            const { data: existingInvoice } = await supabase
                .from('documents_financiers')
                .select('id')
                .ilike('notes', `%Proposal: ${proposal_id.slice(0, 12)}%`)
                .maybeSingle()

            if (!existingInvoice) {
                // Récupérer les items de la proposition
                const { data: proposalItems } = await supabase
                    .from('ai_proposal_items')
                    .select('*')
                    .eq('proposal_id', proposal_id)
                    .order('order_index', { ascending: true })

                // Construire les items de facture à partir des items de la proposition
                const invoiceItems = (proposalItems || [])
                    .filter(item => item.type !== 'hero' && item.type !== 'pricing' && item.selling_price > 0)
                    .map(item => ({
                        description: `${item.title}${item.location ? ` — ${item.location}` : ''}`,
                        quantity: 1,
                        unit_price: item.selling_price || 0,
                        unit_cost: item.original_price || 0,
                        tva: 0,
                    }))

                // Si aucun item détaillé, créer un item global
                if (invoiceItems.length === 0) {
                    invoiceItems.push({
                        description: `Proposition Voyage — ${proposal.destination}`,
                        quantity: 1,
                        unit_price: proposal.total_amount || 0,
                        unit_cost: 0,
                        tva: 0,
                    })
                }

                const sousTotal = invoiceItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0)

                // Numéro de facture séquentiel officiel (compteur atomique)
                const invoiceNumero = await nextDocumentNumber(supabase, 'facture')

                // Récupérer le taux de change actuel pour le verrouillage
                let exchangeRate = 1
                if (proposalCurrency !== 'XOF') {
                    const { data: currencyData } = await supabase
                        .from('currencies')
                        .select('exchange_rate_to_base')
                        .eq('code', proposalCurrency)
                        .single()
                    if (currencyData) exchangeRate = Number(currencyData.exchange_rate_to_base)
                }

                // Insérer la facture ERP
                await supabase.from('documents_financiers').insert({
                    type: 'facture',
                    numero: invoiceNumero,
                    client_nom: proposal.client_name || client_name || 'Client',
                    client_prenom: '',
                    client_email: proposal.client_email || client_email || '',
                    client_phone: proposal.client_phone || '',
                    client_adresse: '',
                    currency: proposalCurrency,
                    exchange_rate_applied: exchangeRate,
                    items: invoiceItems,
                    sous_total: sousTotal,
                    total_tva: 0,
                    remise: 0,
                    total: proposal.total_amount || sousTotal,
                    status: 'paye',
                    notes: `Facture auto-générée — Proposition IA (Conciergerie)\nDestination: ${proposal.destination}\nProposal: ${proposal_id.slice(0, 12).toUpperCase()}\nClient: ${proposal.client_name || client_name || 'N/A'}`,
                    conditions: 'Document généré automatiquement après paiement de la proposition IA.',
                    validite: 'Acquittée',
                })

                console.log(`[ERP] Facture IA auto-générée: ${invoiceNumero} pour proposal ${proposal_id.slice(0, 8)}`)
            }
        } catch (erpErr) {
            // Non-bloquant : le paiement est validé même si la facturation échoue
            console.error('[ERP] Erreur auto-génération facture IA:', erpErr)
        }

        // ═══════════════════════════════════════════════════════════
        // Envoi d'email de confirmation (avec devise correcte)
        // ═══════════════════════════════════════════════════════════
        if (client_email && proposal) {
            try {
                const displayAmount = formatAmount(proposal.total_amount || 0, proposalCurrency)

                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'}/api/notifications/email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: client_email,
 subject: `Confirmation de réservation — Voyage ${proposal.destination}`,
                        html: `
                        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #0f141e; color: white; border-radius: 16px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, #F59E0B, #D97706); padding: 32px; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px; color: #0f141e; font-weight: 900;">Retour Gagnant</h1>
                                <p style="margin: 8px 0 0; color: #0f141e; opacity: 0.8; font-size: 14px;">Votre voyage est confirmé !</p>
                            </div>
                            <div style="padding: 32px;">
                                <h2 style="color: #F59E0B; font-size: 22px; margin-bottom: 8px;">Bonjour ${client_name || 'cher client'} </h2>
                                <p style="color: #94a3b8; line-height: 1.8;">Nous avons bien reçu votre paiement pour votre voyage à <strong style="color: white;">${proposal.destination}</strong>.</p>
                                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 24px 0;">
                                    <p style="color: #94a3b8; margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Montant payé</p>
                                    <p style="color: #F59E0B; font-size: 32px; font-weight: 900; margin: 0;">${displayAmount}</p>
                                </div>
                                <p style="color: #94a3b8; line-height: 1.8;">Notre équipe va préparer tous les détails de votre séjour. Un agent vous contactera sous 24h pour finaliser les derniers arrangements.</p>
                                <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">© ${new Date().getFullYear()} Retour Gagnant — Voyages d'exception au Bénin</p>
                            </div>
                        </div>`
                    })
                })
            } catch (emailErr) {
                console.warn('Email de confirmation non envoyé:', emailErr)
            }
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error('Erreur API proposal-paid:', err)
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
}
