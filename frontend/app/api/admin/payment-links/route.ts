// ══════════════════════════════════════════════════════════════
//  LIENS DE PAIEMENT — Admin / Agent
//  Un lien de paiement réutilise la chaîne de paiement PROUVÉE des
//  propositions (/p/[secret]/paiement) : 5 providers, montant validé
//  serveur, webhook, facture ERP auto (documents_financiers → compta),
//  email de confirmation client. Zéro simulation.
//  Marqueur : notes commençant par « LIEN-PAIEMENT » pour les lister.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { COMPANY } from '@/lib/company'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

const esc = (s: unknown) => String(s ?? '').replace(/</g, '&lt;')

function fmtAmount(amount: number, currency: string): string {
    const n = Number(amount || 0).toLocaleString('fr-FR')
    return currency === 'EUR' ? `${n} €` : currency === 'USD' ? `$${n}` : `${n} FCFA`
}

function buildLinkEmail(clientName: string, label: string, amount: number, currency: string, url: string): string {
    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
      <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
      <div style="padding:28px 30px">
        <table style="border-collapse:collapse;margin:0 0 18px"><tr>
          <td><img src="${SITE_URL}/logo.jpg" alt="Retour Gagnant" style="width:46px;height:46px;border-radius:10px;object-fit:cover"/></td>
          <td style="padding-left:12px">
            <p style="margin:0;color:#1B2A4A;font-size:15px;font-weight:800">${esc(COMPANY.name)}</p>
            <p style="margin:1px 0 0;color:#8B94A6;font-size:11px">Accompagnement de la diaspora — Cotonou, Bénin</p>
          </td>
        </tr></table>
        <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:19px;font-weight:800">Votre lien de paiement sécurisé</h1>
        <p style="margin:0 0 18px;color:#5B6474;font-size:13.5px;line-height:1.7">Bonjour ${esc(clientName)},<br/>Voici votre lien de règlement sécurisé. Vous pouvez payer par Mobile Money, carte bancaire ou PayPal, en toute sécurité.</p>
        <table style="width:100%;border-collapse:collapse;background:#F8FAF9;border-radius:10px;overflow:hidden;margin:0 0 20px">
          <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px;width:120px">Prestation</td><td style="padding:10px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${esc(label)}</td></tr>
          <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px">Montant</td><td style="padding:10px 14px;color:#047857;font-size:15px;font-weight:800">${fmtAmount(amount, currency)}</td></tr>
        </table>
        <div style="text-align:center;margin:0 0 16px">
          <a href="${url}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:800;font-size:14px">Payer maintenant en toute sécurité</a>
        </div>
        <p style="margin:0;color:#8B94A6;font-size:11.5px;text-align:center;line-height:1.7">Une facture officielle vous sera automatiquement envoyée après le paiement.</p>
        <p style="margin:18px 0 0;color:#5B6474;font-size:12px;line-height:1.7">Une question ? <a href="mailto:${COMPANY.email}" style="color:#008751;font-weight:700;text-decoration:none">${COMPANY.email}</a> — WhatsApp : +229 01 94 35 50 50 / +229 01 60 32 21 21</p>
        <p style="margin:16px 0 0;color:#9aa5b1;font-size:10.5px;text-align:center;border-top:1px solid #eef1f0;padding-top:14px">${esc(COMPANY.name)} — RCCM ${esc(COMPANY.rccm)} — IFU ${esc(COMPANY.ifu)}</p>
      </div>
    </div>`
}

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data, error } = await supabase
            .from('ai_client_proposals')
            .select('id, secret_key, client_name, client_email, client_phone, destination, total_amount, currency, status, notes, created_at')
            .ilike('notes', 'LIEN-PAIEMENT%')
            .order('created_at', { ascending: false })
        if (error) throw error
        const links = (data || []).map(p => ({
            ...p,
            url: `${SITE_URL}/p/${p.secret_key}/paiement`,
            paid: p.status === 'paid',
        }))
        return NextResponse.json({ links })
    } catch (err) {
        console.error('[payment-links GET]', err)
        return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { label, amount, currency, client_name, client_email, client_phone, send_email, actor, category } = body
        // Catégorie comptable de destination choisie à la création
        const cat = ['factures', 'boutique', 'paiements'].includes(category) ? category : 'factures'

        const amt = Number(amount)
        if (!label?.trim() || !client_name?.trim() || !amt || amt <= 0) {
            return NextResponse.json({ error: 'Libellé, nom du client et montant positif sont requis.' }, { status: 400 })
        }
        const cur = ['XOF', 'EUR', 'USD'].includes(currency) ? currency : 'XOF'

        const supabase = createClient(supabaseUrl, serviceKey)

        // ── CONVERSION EN XOF (devise de tenue et de charge Kkiapay) ──
        // Le montant est saisi dans la devise choisie (ex. 50 €) mais TOUT le
        // système aval (page de paiement, Kkiapay/FedaPay, facture, compta)
        // raisonne en FCFA. On convertit donc ici via le taux officiel de la
        // table `currencies` (exchange_rate_to_base = valeur d'1 unité en XOF)
        // et on stocke TOUJOURS total_amount en XOF + currency='XOF'.
        let xofAmount = amt
        if (cur !== 'XOF') {
            const { data: rateRow } = await supabase
                .from('currencies').select('exchange_rate_to_base').eq('code', cur).single()
            const rate = Number(rateRow?.exchange_rate_to_base) || 0
            if (!rate || rate <= 0) {
                return NextResponse.json({ error: `Taux de change ${cur} indisponible. Configurez-le dans Devises & Taux.` }, { status: 400 })
            }
            xofAmount = Math.round(amt * rate)
        }
        if (xofAmount <= 0) return NextResponse.json({ error: 'Montant converti invalide.' }, { status: 400 })

        const base = {
            client_name: String(client_name).trim(),
            client_email: String(client_email || '').trim().toLowerCase() || null,
            client_phone: String(client_phone || '').trim() || null,
            destination: String(label).trim(),
            status: 'ready',
            total_amount: xofAmount, // TOUJOURS en XOF
            notes: `LIEN-PAIEMENT [CAT:${cat}] — créé par ${String(actor || 'Admin').slice(0, 80)} le ${new Date().toLocaleString('fr-FR')}${cur !== 'XOF' ? ` — montant saisi : ${amt.toLocaleString('fr-FR')} ${cur} (converti en ${xofAmount.toLocaleString('fr-FR')} FCFA)` : ''}`,
        }

        // currency TOUJOURS 'XOF' (cohérence page + Kkiapay + facture) ;
        // fallback si la colonne currency n'existe pas encore
        let proposal = null
        const res1 = await supabase.from('ai_client_proposals').insert({ ...base, currency: 'XOF' }).select().single()
        if (res1.error) {
            const colErr = res1.error.message?.includes('currency') || res1.error.code === '42703'
            if (!colErr) throw res1.error
            const res2 = await supabase.from('ai_client_proposals').insert(base).select().single()
            if (res2.error) throw res2.error
            proposal = res2.data
        } else proposal = res1.data

        if (!proposal?.secret_key) {
            return NextResponse.json({ error: 'Lien non généré (secret manquant).' }, { status: 500 })
        }

        const url = `${SITE_URL}/p/${proposal.secret_key}/paiement`

        let emailSent = false
        if (send_email && base.client_email) {
            const result = await sendEmail({
                to: base.client_email,
                subject: `${COMPANY.name} — Lien de paiement sécurisé : ${base.destination}`,
                html: buildLinkEmail(base.client_name, base.destination, xofAmount, 'XOF', url),
                context: 'payment_link',
                relatedId: proposal.id,
            })
            emailSent = result.success
        }

        return NextResponse.json({ success: true, url, id: proposal.id, emailSent })
    } catch (err) {
        console.error('[payment-links POST]', err)
        const msg = err instanceof Error ? err.message : 'Création impossible'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
        const supabase = createClient(supabaseUrl, serviceKey)
        // Sécurité : ne supprime que des liens de paiement, jamais une proposition voyage
        const { data: link } = await supabase.from('ai_client_proposals').select('id, notes, status').eq('id', id).single()
        if (!link || !String(link.notes || '').startsWith('LIEN-PAIEMENT')) {
            return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 })
        }
        if (link.status === 'paid') {
            return NextResponse.json({ error: 'Ce lien a été payé — suppression interdite (traçabilité comptable).' }, { status: 400 })
        }
        // Nettoyage : supprimer les commandes NON PAYÉES issues de ce lien
        // (sinon un ordre « en attente » orphelin reste visible en comptabilité
        //  Boutique après suppression du lien). Les commandes payées sont
        //  conservées (traçabilité) — mais un lien payé n'est pas supprimable.
        await supabase.from('orders').delete().eq('shipping_address', id).eq('shipping_zone', 'proposal').neq('payment_status', 'completed')
        await supabase.from('ai_proposal_items').delete().eq('proposal_id', id)
        const { error } = await supabase.from('ai_client_proposals').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[payment-links DELETE]', err)
        return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
    }
}
