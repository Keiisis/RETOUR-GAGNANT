import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
import { notifyStaffNationalityPayment, sendNationalityPaymentReceipt } from '@/lib/nationality-payment-emails'
import { recordNationalityIncome } from '@/lib/nationality-income'
import { toXOFStrict } from '@/lib/server-rates'
import { ttcFromHt } from '@/lib/tax'
import { logWebhookFailure } from '@/lib/payment-integrity'
import { createErpInvoiceForOrder } from '@/lib/erp-invoice'
import { markClientConverted } from '@/lib/classement/track'
import { confirmDocumentPayment } from '@/lib/document-payment'
import { lireBrouillon, ecrireBrouillon, colonnesDepuisBrouillon } from '@/lib/nationality-brouillon'

/* Client SERVEUR (service role). Ce webhook importait le client du NAVIGATEUR
   (clé anonyme) : il ne fonctionnait qu'aussi longtemps que les règles d'accès
   laissaient la clé publique lire les clés privées de paiement — ce qui est
   précisément une faille à fermer. */
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

/* ══════════════════════════════════════════════════════════════
   FILET DE SÉCURITÉ NATIONALITÉ : paiement confirmé côté serveur.
   Le widget du formulaire passe `data: {"context":"nationality","email":…}`.
   Si le navigateur du client meurt après le paiement (fiche jamais créée par
   le formulaire : incident 2026-06), ce webhook :
     1. vérifie la transaction auprès de Kkiapay (anti-fraude),
     2. crée une fiche minimale (identité récupérée depuis le lead
        `eligibility_results` capturé AVANT paiement) marquée
        `last_step_completed = 0`,
     3. alerte l'équipe + envoie le reçu client + statut Classement « Payé ».
   Si le formulaire aboutit ensuite, /api/nationality COMPLÈTE cette fiche
   (même payment_ref) au lieu d'en créer une seconde. Un cron envoie le lien
   de complément aux fiches restées incomplètes 2h+.
   ══════════════════════════════════════════════════════════════ */

interface TxKkiapay {
    ok: boolean
    amount?: number
    status: string
    /** Données passées au widget (`data`), telles que Kkiapay les a conservées (champ `state`). */
    etat: Record<string, unknown>
    client?: { fullname?: string; email?: string; phone?: string }
}

/** `data` du widget : objet, chaîne JSON, ou absent. */
function lireDonneesWidget(v: unknown): Record<string, unknown> {
    if (!v) return {}
    if (typeof v === 'object') return v as Record<string, unknown>
    try { const o = JSON.parse(String(v)); return o && typeof o === 'object' ? o : {} } catch { return {} }
}

async function verifyKkiapayTx(transactionId: string): Promise<TxKkiapay> {
    const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox', 'kkiapay_sandbox_public_key', 'kkiapay_sandbox_private_key'])
    const sm: Record<string, string> = {}
    for (const s of settingsData || []) sm[s.key] = s.value

    const isSandbox = sm.kkiapay_sandbox === 'true'
    const privateKey = isSandbox
        ? (sm.kkiapay_sandbox_private_key || sm.kkiapay_private_key || '')
        : (sm.kkiapay_private_key || '')
    const base = isSandbox ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'

    try {
        const res = await fetch(`${base}/api/v1/transactions/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': isSandbox ? (sm.kkiapay_sandbox_public_key || sm.kkiapay_public_key || '') : (sm.kkiapay_public_key || ''),
                'x-private-key': privateKey,
                'x-secret-key': sm.kkiapay_secret_key || '',
            },
            body: JSON.stringify({ transactionId }),
        })
        const data = await res.json()
        return {
            ok: data?.status === 'SUCCESS',
            amount: data?.amount,
            status: data?.status || 'unknown',
            etat: lireDonneesWidget(data?.state ?? data?.stateData),
            client: data?.client || undefined,
        }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed', etat: {} }
    }
}

async function handleNationalityPayment(
    transactionId: string,
    status: string,
    widgetData: Record<string, unknown>,
): Promise<NextResponse> {
    // Statuts non finaux / échecs : rien à faire (aucune fiche à marquer)
    if (status !== 'SUCCESS' && status !== 'TRANSACTION_APPROVED') {
        return NextResponse.json({ ok: true, message: 'Statut non finalisé : ignoré' })
    }

    // Idempotence : fiche déjà présente (créée par le formulaire ou une
    // livraison webhook précédente) → rien à faire.
    const { data: existing } = await supabase
        .from('nationality_applications')
        .select('id')
        .eq('payment_ref', transactionId)
        .maybeSingle()
    if (existing) {
        return NextResponse.json({ ok: true, message: 'Dossier déjà enregistré' })
    }

    // Vérification serveur (anti-fraude : ne jamais créer sur simple webhook)
    const verify = await verifyKkiapayTx(transactionId)
    if (!verify.ok) {
        console.warn(`[Kkiapay Webhook][nationality] transaction non confirmée: ${verify.status}`)
        return NextResponse.json({ ok: true, message: 'Transaction non confirmée : ignorée' })
    }

    const email = String(widgetData.email || verify.client?.email || '').toLowerCase().trim()
    if (!email) {
        // Paiement réel mais non identifiable → alerte humaine, pas de fiche fantôme
        await supabase.from('messages').insert([{
            nom: 'Webhook Kkiapay',
            email: 'contact@retourgagnantbenin.bj',
            sujet: `Paiement nationalité NON IDENTIFIABLE : TX ${transactionId}`,
            message: `Un paiement nationalité a été confirmé par Kkiapay (transaction ${transactionId}, ${verify.amount ?? '?'} XOF) mais le webhook ne contient pas l'email du client. Retrouvez la transaction dans le tableau de bord Kkiapay et créez la fiche manuellement.`,
            type: 'nationality',
            lu: false,
        }])
        return NextResponse.json({ ok: true, message: 'Paiement sans identité : équipe alertée' })
    }

    // Identité depuis le lead capturé avant paiement (pré-inscription du formulaire)
    const { data: lead } = await supabase
        .from('eligibility_results')
        .select('client_nom, client_prenom, client_whatsapp')
        .eq('client_email', email)
        .eq('objective', 'nationalite')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    /* Brouillon déposé AVANT le paiement (formulaire + pièces) : c'est la
       source la plus complète. Il n'est pris que si son e-mail est celui du
       paiement — un jeton seul ne suffit pas à rattacher un dossier. */
    const brouillon = widgetData.draft ? await lireBrouillon(supabase, String(widgetData.draft)) : null
    const brouillonValide = brouillon && String(brouillon.form.email || '').toLowerCase().trim() === email ? brouillon : null

    /* Identité, de la plus sûre à la plus pauvre : brouillon, données du
       widget, pré-inscription, puis nom du porteur de la carte chez Kkiapay.
       La fiche du 15/09 aurait été créée « sans nom » : le lead n'était
       interrogé que par e-mail et le widget ne transmettait pas le nom. */
    const porteur = String(verify.client?.fullname || '').trim()
    const nom = String(brouillonValide?.form.nom || widgetData.nom || lead?.client_nom || porteur.split(/\s+/).slice(1).join(' ') || '')
    const prenom = String(brouillonValide?.form.prenom || widgetData.prenom || lead?.client_prenom || porteur.split(/\s+/)[0] || '')
    const telephone = String(brouillonValide?.form.telephone || widgetData.telephone || lead?.client_whatsapp || verify.client?.phone || '') || null

    // Montant officiel du formulaire (admin) pour le reçu ; le XOF encaissé va en note
    let amount = 250
    let currency = 'USD'
    const { data: fs } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'nationalite').eq('section_key', 'form_settings').maybeSingle()
    const c = fs?.content as Record<string, unknown> | undefined
    if (c?.amount) amount = Number(c.amount)
    if (c?.currency) currency = String(c.currency)

    // ── Le montant encaissé couvre-t-il le tarif ? ────────────────────
    // Le webhook créait une fiche « payé » sans jamais confronter la somme
    // reçue au tarif officiel : un règlement de 250 FCFA entrait en
    // comptabilité comme un dossier complet. On n'annule rien (l'argent EST
    // arrivé), mais la fiche part signalée pour que l'équipe régularise.
    const attenduXof = await (async () => {
        if (!isFinite(amount) || amount <= 0) return null
        const x = await toXOFStrict(amount, currency)
        return x === null ? null : ttcFromHt(x, 'XOF')
    })()
    const encaisseXof = Number(verify.amount)
    const sousPaiement = attenduXof !== null && isFinite(encaisseXof) && encaisseXof > 0
        && encaisseXof < attenduXof * 0.98

    const ref = `RG-NAT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`
    const note = (sousPaiement
        ? `⚠️ SOUS-PAIEMENT À RÉGULARISER : ${encaisseXof} XOF encaissés pour ${attenduXof} XOF attendus. `
        + `NE PAS TRAITER le dossier avant régularisation ou remboursement. `
        : '')
        + (brouillonValide
            ? `[WEBHOOK-KKIAPAY] Dossier RECONSTITUÉ depuis le brouillon enregistré avant le paiement `
            + `(${brouillonValide.documents.length} pièce(s), étape ${brouillonValide.etape}/6) : le navigateur du client n'a pas renvoyé le formulaire après paiement. `
            + `Transaction ${transactionId} : encaissé ${verify.amount ?? '?'} XOF. Vérifier le dossier puis le traiter normalement.`
            : `[WEBHOOK-KKIAPAY] Fiche créée automatiquement à la confirmation du paiement : le client n'a pas (encore) finalisé le formulaire. `
            + `Transaction ${transactionId} : encaissé ${verify.amount ?? '?'} XOF. `
            + `DOCUMENTS : si le formulaire n'aboutit pas, un lien de complément sera envoyé automatiquement au client (ou utilisez « Relancer (documents) »).`)

    const { error: insErr } = await supabase.from('nationality_applications').insert([{
        ...(brouillonValide ? colonnesDepuisBrouillon(brouillonValide) : {}),
        application_ref: ref,
        status: 'soumis',
        submitted_at: new Date().toISOString(),
        nom, prenom, email,
        telephone,
        nationalite: String(brouillonValide?.form.nationalite || '') || 'Non spécifiée',
        documents_uploaded: brouillonValide?.documents || [],
        amount, currency,
        payment_status: 'payé',
        payment_ref: transactionId,
        payment_method: 'kkiapay',
        /* 0 = fiche vide à compléter (le cron envoie un lien de complément) ;
           5 = reconstituée depuis le brouillon, pièces comprises : rien à
           redemander au client. */
        last_step_completed: brouillonValide ? 5 : 0,
        agent_notes: note,
    }])
    if (insErr) {
        console.error('[Kkiapay Webhook][nationality] insert error:', insErr.message)
        // Argent encaisse mais fiche non creee -> trace exploitable pour rejeu
        await logWebhookFailure(supabase, {
            provider: 'kkiapay', eventType: 'nationality', reference: transactionId,
            payload: { email, nom, prenom, amount, currency, ref, verifiedAmount: verify.amount },
            error: insErr.message,
        })
        return NextResponse.json({ error: 'Erreur enregistrement' }, { status: 500 })
    }

    // Traçabilité comptable : facture (payée) dans facturation + comptabilité
    // (idempotent par référence de dossier)
    void recordNationalityIncome(supabase, {
        ref, nom, prenom, email, phone: telephone,
        amount, currency, paymentMethod: 'kkiapay', txId: transactionId, isMyafro: false,
    })

    // Suivi de dossier + notification in-app (miroir de /api/nationality)
    await supabase.from('dossier_tracking').insert({
        num_dossier: ref,
        client_nom: nom, client_prenom: prenom,
        client_email: email,
        client_whatsapp: telephone || '', client_phone: telephone || '',
        service_type: 'Reconnaissance de Nationalité', service: 'nationalite',
        statut: 'reception',
        etapes: [{ id: 1, label: 'Réception du dossier', status: 'completed', date: new Date().toISOString().split('T')[0], note: 'Paiement confirmé (webhook)' }],
        progression: 14,
        notes_internes: note,
    }).then(({ error }) => { if (error) console.error('[Kkiapay Webhook][nationality] tracking:', error.message) })

    await supabase.from('messages').insert([{
        nom: `${prenom} ${nom}`.trim() || email,
        email, telephone,
        sujet: `Demande de nationalité #${ref} (paiement confirmé : webhook)`,
        message: `Paiement nationalité confirmé côté serveur.\n\nClient: ${prenom} ${nom}\nEmail: ${email}\nRéférence: ${ref}\nMontant: ${amount} ${currency} (encaissé ${verify.amount ?? '?'} XOF)\nTransaction: ${transactionId}\n\n${note}`,
        type: 'nationality',
        lu: false,
    }])

    // Alerte équipe + reçu client + statut Classement « Payé » (fire-and-forget)
    const paymentInfo = {
        nom, prenom, email, telephone,
        refDossier: ref,
        amount, currency,
        paymentMethod: 'kkiapay',
        paymentRef: transactionId,
    }
    void notifyStaffNationalityPayment(paymentInfo)
    void sendNationalityPaymentReceipt(paymentInfo)
    void markClientConverted({ email, full_name: `${prenom} ${nom}`.trim() || null, phone: telephone, serviceLabel: 'nationalite-vip', source: 'nationalite' })

    // Le navigateur du client, s'il revient, saura que son dossier existe.
    if (brouillonValide) await ecrireBrouillon(supabase, { ...brouillonValide, dossier_ref: ref, maj_le: new Date().toISOString() })

    return NextResponse.json({ ok: true, message: brouillonValide ? 'Dossier reconstitué depuis le brouillon (filet webhook)' : 'Dossier nationalité créé (filet webhook)', reference: ref })
}

// Kkiapay sends POST webhook notifications when payment status changes
export async function POST(request: Request) {
    try {
        const body = await request.json()

        /* ── Signature ────────────────────────────────────────────────
           Kkiapay signe ses appels par l'en-tête `x-kkiapay-secret` (valeur
           définie dans son tableau de bord). Si le secret est renseigné dans
           nos réglages, un appel qui ne le porte pas est refusé. Chaque
           branche revérifie de toute façon la transaction auprès de Kkiapay :
           un faux webhook ne peut rien marquer payé. */
        const { data: secretRow } = await supabase.from('settings').select('value').eq('key', 'kkiapay_webhook_secret').maybeSingle()
        const secretAttendu = String(secretRow?.value || '').trim()
        if (secretAttendu) {
            const recu = Buffer.from(String(request.headers.get('x-kkiapay-secret') || ''))
            const attendu = Buffer.from(secretAttendu)
            if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) {
                console.warn('[Kkiapay Webhook] signature absente ou invalide')
                return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
            }
        }

        /* ── Format RÉEL du webhook Kkiapay (docs.kkiapay.me, « Webhook ») ──
             { transactionId, isPaymentSucces, event: 'transaction.success',
               amount, method, stateData: <données du widget>, … }
           Ce code lisait `status` et `data`, qui n'existent pas dans cet
           envoi : le contexte était toujours vide, aucune branche ne
           reconnaissait le paiement, et le filet de sécurité nationalité n'a
           jamais tourné (cas du 15/09/2026, 170 549 FCFA encaissés, aucune
           fiche). On lit désormais les deux formats. */
        const transactionId = body.transactionId
        const data = body.stateData ?? body.data ?? body.state
        const status = body.isPaymentSucces === true || body.event === 'transaction.success'
            ? 'SUCCESS'
            : body.isPaymentSucces === false || body.event === 'transaction.failed'
                ? 'FAILED'
                : String(body.status || '')

        let widgetData = lireDonneesWidget(data)

        /* Données vides dans l'envoi : Kkiapay les conserve sur la
           transaction (champ `state`). On les y relit — c'est la même source
           que celle que la vérification anti-fraude interroge. */
        if (transactionId && !widgetData.context && !widgetData.doc_id && !widgetData.order_id) {
            const tx = await verifyKkiapayTx(String(transactionId))
            widgetData = { ...tx.etat }
            if (!widgetData.email && tx.client?.email) widgetData.email = tx.client.email
        }

        // ── Branche NATIONALITÉ (widget du formulaire, pas de commande boutique) ──
        if (transactionId && widgetData.context === 'nationality') {
            return handleNationalityPayment(String(transactionId), status, widgetData)
        }

        // ── Branche DEVIS / FACTURES (portail /portail/[id] et panel client) ──
        // Le widget passe { doc_id, type } (portail) ou { context:'client-facture',
        // doc_id } (panel). confirmDocumentPayment vérifie la transaction, marque
        // le document payé (garde atomique) et envoie alerte staff + reçu client.
        if (transactionId && widgetData.doc_id && (status === 'SUCCESS' || status === 'TRANSACTION_APPROVED')) {
            const result = await confirmDocumentPayment({
                docId: String(widgetData.doc_id),
                provider: 'kkiapay',
                transactionId: String(transactionId),
            })
            return NextResponse.json(
                result.success
                    ? { ok: true, message: result.alreadyPaid ? 'Document déjà payé' : 'Document marqué payé (filet webhook)' }
                    : { ok: false, error: result.error },
                { status: result.success ? 200 : (result.status || 500) },
            )
        }

        // ── Branche RECHERCHE ANCESTRALE (complément du dossier nationalité) ──
        // Le widget passe { context:'recherche-ancestrale', ref }. La route interne
        // /api/nationality/recherche-ancestrale est idempotente (flag payé) et fait
        // tout : flag + suivi + message + alerte staff + email client.
        if (transactionId && widgetData.context === 'recherche-ancestrale' && widgetData.ref
            && (status === 'SUCCESS' || status === 'TRANSACTION_APPROVED')) {
            const verify = await verifyKkiapayTx(String(transactionId))
            if (!verify.ok) {
                return NextResponse.json({ ok: true, message: 'Transaction non confirmée : ignorée' })
            }
            try {
                await fetch(`${SITE}/api/nationality/recherche-ancestrale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ref: String(widgetData.ref),
                        payment_provider: 'kkiapay',
                        payment_tx_id: String(transactionId),
                        amount: 250,
                        amount_xof: verify.amount,
                    }),
                })
            } catch (e) {
                console.error('[Kkiapay Webhook][ancestrale] relai interne échoué:', e instanceof Error ? e.message : e)
            }
            return NextResponse.json({ ok: true, message: 'Recherche ancestrale enregistrée (filet webhook)' })
        }

        const orderId = (widgetData as { order_id?: string }).order_id

        if (!transactionId || !orderId) {
            return NextResponse.json({ error: 'Missing transactionId or order_id' }, { status: 400 })
        }

        // Fetch order to verify it exists and is still pending
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // Vérifier que la commande est bien une commande Kkiapay (non falsifiable : défini côté serveur)
        // Empêche d'utiliser cet endpoint pour manipuler des commandes d'autres gateways
        if (order.payment_method !== 'kkiapay') {
            console.warn(`[Kkiapay Webhook] Tentative sur commande ${orderId} (méthode: ${order.payment_method})`)
            return NextResponse.json({ error: 'Méthode de paiement incorrecte' }, { status: 400 })
        }

        // Idempotency: skip if already processed
        if (order.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Already processed' })
        }

        if (status === 'SUCCESS' || status === 'TRANSACTION_APPROVED') {
            // Charger la clé privée depuis la DB (comme dans verify/route.ts)
            const { data: settingsData } = await supabase
                .from('settings')
                .select('key, value')
                .in('key', ['kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox', 'kkiapay_sandbox_public_key', 'kkiapay_sandbox_private_key'])

            const sm: Record<string, string> = {}
            for (const s of settingsData || []) sm[s.key] = s.value

            const isSandbox = sm.kkiapay_sandbox === 'true'
            const privateKey = isSandbox
                ? (sm.kkiapay_sandbox_private_key || sm.kkiapay_private_key || '')
                : (sm.kkiapay_private_key || '')
            const kkiapayBase = isSandbox
                ? 'https://api-sandbox.kkiapay.me'
                : 'https://api.kkiapay.me'

            // Server-side verification : le SDK officiel envoie les 3 headers
            const verifyRes = await fetch(`${kkiapayBase}/api/v1/transactions/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': isSandbox ? (sm.kkiapay_sandbox_public_key || sm.kkiapay_public_key || '') : (sm.kkiapay_public_key || ''),
                    'x-private-key': privateKey,
                    'x-secret-key': sm.kkiapay_secret_key || '',
                },
                body: JSON.stringify({ transactionId }),
            })

            const verifyData = await verifyRes.json()

            if (verifyData.status === 'SUCCESS' && verifyData.amount >= order.amount) {
                // Anti-replay : vérifier que ce transactionId n'a pas déjà servi pour une autre commande complétée.
                // Empêche un attaquant de rejouer une transaction Kkiapay valide via un faux webhook.
                const { data: existingTx } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('transaction_id', transactionId)
                    .eq('payment_status', 'completed')
                    .neq('id', orderId)
                    .maybeSingle()

                if (existingTx) {
                    console.error(`[Kkiapay Webhook] Transaction ${transactionId} déjà utilisée : commande ${existingTx.id}`)
                    return NextResponse.json({ error: 'Transaction déjà utilisée pour une autre commande' }, { status: 400 })
                }

                // Garde atomique + vérification du résultat pour éviter la double-décrémentation du stock.
                // Kkiapay peut re-livrer le même webhook. Deux livraisons simultanées peuvent toutes deux
                // passer le check en mémoire (payment_status !== 'completed') avant que l'une n'écrive.
                // Seule la livraison qui obtient 1 ligne mise à jour doit décrémenter le stock.
                const { data: updatedOrder } = await supabase
                    .from('orders')
                    .update({
                        payment_status: 'completed',
                        transaction_id: transactionId,
                    })
                    .eq('id', orderId)
                    .eq('payment_status', 'pending')
                    .select('id')

                // Aucune ligne mise à jour = déjà traité par une autre livraison → ne pas décrémenter
                if (!updatedOrder || updatedOrder.length === 0) {
                    return NextResponse.json({ ok: true, message: 'Already processed (concurrent delivery)' })
                }

                // Decrement product stock
                if (order.product_id) {
                    await supabase.rpc('decrement_stock', {
                        p_id: order.product_id,
                        qty: order.quantity || 1,
                    })
                }

                // Send notification (email admin + facture client)
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/notifications/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, type: 'payment_success' }),
                }).catch(() => { })

                // Facture ERP → compta (idempotent : skip si verify l'a déjà créée)
                await createErpInvoiceForOrder({ orderId, method: 'kkiapay', transactionId })

                return NextResponse.json({ ok: true, message: 'Paiement vérifié et confirmé' })
            }
        }

        // Payment failed : garde atomique : ne pas écraser une commande déjà complétée
        await supabase
            .from('orders')
            .update({ payment_status: 'failed', transaction_id: transactionId })
            .eq('id', orderId)
            .eq('payment_status', 'pending')

        return NextResponse.json({ ok: true, message: 'Payment status updated to failed' })
    } catch {
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
