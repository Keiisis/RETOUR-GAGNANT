import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { classifyProposalPayment } from '@/lib/proposal-classify'
import { guardPublic } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'

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
        // Route publique (appelée depuis /p/[secret]/paiement) mais qui écrit
        // en comptabilité : on plafonne le débit avant toute lecture de base.
        const trop = guardPublic(req, 'proposal-paid', PAYMENT_ROUTE_LIMIT)
        if (trop) return trop

        const supabase = createClient(supabaseUrl, supabaseKey)
        const body = await req.json()
        const { proposal_id, client_email, client_name } = body

        if (!proposal_id) {
            return NextResponse.json({ error: 'proposal_id requis' }, { status: 400 })
        }

        // ═══════════════════════════════════════════════════════════
        //  PREUVE DE PAIEMENT OBLIGATOIRE
        //  Cette route est appelée par le NAVIGATEUR du client après le
        //  widget. Sans contrôle, un simple POST { proposal_id } suffisait
        //  à marquer « payé », émettre une facture et envoyer un reçu.
        //  L'autorité reste la commande encaissée et vérifiée serveur
        //  (checkout/verify ou webhook) : pas de commande completed,
        //  pas d'écriture comptable.
        // ═══════════════════════════════════════════════════════════
        const { data: linkedOrder } = await supabase
            .from('orders')
            .select('id, amount, currency, payment_status')
            .eq('shipping_address', proposal_id)
            .eq('shipping_zone', 'proposal')
            .eq('payment_status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (!linkedOrder) {
            return NextResponse.json(
                { error: 'Aucun paiement encaissé pour cette proposition.' },
                { status: 402 },
            )
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
        //  CLASSIFICATION UNIQUE (anti-doublon) selon la catégorie choisie
        //  (Factures / Boutique / Paiements). Autorité partagée avec
        //  checkout/verify et les webhooks (erp-invoice) → un seul
        //  enregistrement comptable par proposition.
        // ═══════════════════════════════════════════════════════════
        try {
            // On réutilise la commande DÉJÀ vérifiée plus haut (payment_status
            // = 'completed') : refaire la requête sans ce filtre rouvrirait
            // exactement la brèche que le contrôle ferme.
            await classifyProposalPayment(supabase, proposal_id, linkedOrder)
        } catch (erpErr) {
            console.error('[ERP] classification proposition:', erpErr)
        }

        // ═══════════════════════════════════════════════════════════
        // Email de confirmation VOYAGE — uniquement pour les vraies
        // propositions de voyage. Pour un LIEN DE PAIEMENT (facturation /
        // encaissement), classifyProposalPayment envoie déjà le reçu RGB
        // officiel + PDF — on évite ici le doublon et le libellé « voyage ».
        // ═══════════════════════════════════════════════════════════
        const isPaymentLink = String(proposal.notes || '').startsWith('LIEN-PAIEMENT')
        if (client_email && proposal && !isPaymentLink) {
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
