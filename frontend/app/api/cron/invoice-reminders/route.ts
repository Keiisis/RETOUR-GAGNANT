import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getEmailTemplates, getEmailConfig } from '@/lib/email'
import { toXOFStrict } from '@/lib/server-rates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET = process.env.CRON_SECRET || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// Seuils de rappel en jours
const REMINDER_THRESHOLDS = [
    { days: 7, level: 'reminder_1' },
    { days: 15, level: 'reminder_2' },
    { days: 30, level: 'reminder_3' },
] as const

type ReminderLevel = typeof REMINDER_THRESHOLDS[number]['level']

/**
 * POST /api/cron/invoice-reminders
 *
 * Endpoint appelé par Vercel Cron (ou manuellement) pour envoyer des
 * rappels de paiement automatiques pour les factures impayées.
 *
 * Sécurité : vérifie CRON_SECRET dans le header Authorization.
 * Idempotence : stocke le dernier rappel envoyé dans les notes du document.
 *
 * Flux :
 * 1. Récupère toutes les factures avec status IN ('accepte', 'envoye')
 * 2. Calcule l'ancienneté (jours depuis created_at)
 * 3. Détermine le niveau de rappel approprié
 * 4. Vérifie que ce niveau n'a pas déjà été envoyé (via notes)
 * 5. Envoie l'email au client
 * 6. Notifie l'admin/agent
 * 7. Met à jour les notes du document avec le rappel envoyé
 */
export async function POST(request: Request) {
    try {
        // ═══ AUTHENTICATION ════════════════════════════════════════════
        // Protéger cet endpoint — uniquement accessible via Vercel Cron
        // ou avec le secret correct dans le header.
        const authHeader = request.headers.get('authorization') || ''
        const querySecret = new URL(request.url).searchParams.get('secret') || ''

        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const templates = await getEmailTemplates('fr')
        const config = await getEmailConfig()

        // ═══ RÉCUPÉRER LES FACTURES IMPAYÉES ═══════════════════════════
        const { data: unpaidInvoices, error: fetchErr } = await supabase
            .from('documents_financiers')
            .select('id, numero, client_nom, client_email, client_phone, total, currency, notes, created_at, agent_id')
            .eq('type', 'facture')
            .in('status', ['accepte', 'envoye'])
            .order('created_at', { ascending: true })

        if (fetchErr) {
            console.error('[CRON/Reminders] Erreur fetch:', fetchErr.message)
            return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
        }

        if (!unpaidInvoices || unpaidInvoices.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Aucune facture impayée à relancer.',
                processed: 0,
            })
        }

        // ── SOLDE RÉEL : déduire les encaissements déjà enregistrés ──────
        // Sans cela, une facture partiellement (ou totalement) réglée par
        // virement/espèces était relancée pour la TOTALITÉ du montant.
        const invoiceIds = unpaidInvoices.map(i => i.id)
        const encaisse: Record<string, number> = {}
        if (invoiceIds.length > 0) {
            const { data: pms } = await supabase
                .from('paiements_manuels')
                .select('document_id, montant')
                .in('document_id', invoiceIds)
            for (const pm of pms || []) {
                if (pm.document_id) {
                    encaisse[pm.document_id] = (encaisse[pm.document_id] || 0) + Number(pm.montant || 0)
                }
            }
        }

        const now = new Date()
        const results: {
            invoiceId: string
            numero: string
            level: ReminderLevel
            success: boolean
            error?: string
        }[] = []

        const formatPrice = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

        for (const invoice of unpaidInvoices) {
            // Calculer l'ancienneté en jours
            const createdAt = new Date(invoice.created_at)
            const daysOverdue = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

            // Déterminer le niveau de rappel approprié
            let targetLevel: ReminderLevel | null = null
            for (const threshold of REMINDER_THRESHOLDS) {
                if (daysOverdue >= threshold.days) {
                    targetLevel = threshold.level
                }
            }

            // Pas encore éligible pour un rappel (< 7 jours)
            if (!targetLevel) continue

            // Solde restant dû (les paiements sont stockés en XOF)
            const totalXOF = await toXOFStrict(Number(invoice.total) || 0, invoice.currency)
            if (totalXOF === null) {
                console.warn(`[CRON/Reminders] taux ${invoice.currency} indisponible — ${invoice.numero} ignorée`)
                continue
            }
            const soldeXOF = totalXOF - (encaisse[invoice.id] || 0)
            // Facture déjà soldée : JAMAIS de relance (même si le statut
            // n'a pas encore été basculé à « payé »).
            if (soldeXOF <= 0) continue

            // Vérifier que ce rappel n'a pas déjà été envoyé (idempotence via notes)
            const currentNotes = invoice.notes || ''
            if (currentNotes.includes(`[${targetLevel}]`)) {
                continue // Déjà envoyé ce niveau
            }

            // Vérifier que le client a un email
            if (!invoice.client_email) {
                results.push({
                    invoiceId: invoice.id,
                    numero: invoice.numero,
                    level: targetLevel,
                    success: false,
                    error: 'Pas d\'email client',
                })
                continue
            }

            // ═══ ENVOYER LE RAPPEL ═══════════════════════════════════════
            try {
                // On relance sur le SOLDE restant dû (en XOF, devise des encaissements)
                const montantFormatted = formatPrice(soldeXOF)
                const currency = invoice.currency || 'XOF'

                // Construire le lien portail (s'il existe un portail client)
                const portalUrl = `${SITE_URL}/portail/${invoice.id}`

                // Générer le HTML du rappel
                const reminderHtml = await templates.invoiceReminder(
                    invoice.client_nom,
                    invoice.numero,
                    montantFormatted,
                    currency,
                    daysOverdue,
                    portalUrl,
                )

                // Sujet adapté au niveau
                const subjectMap: Record<ReminderLevel, string> = {
                    reminder_1: ` Rappel — Facture ${invoice.numero} en attente`,
                    reminder_2: `⏳ 2ème Rappel — Facture ${invoice.numero} impayée`,
                    reminder_3: ` Dernier Rappel — Facture ${invoice.numero} — Action requise`,
                }

                // Envoyer au client
                const emailResult = await sendEmail({
                    to: invoice.client_email,
                    subject: subjectMap[targetLevel],
                    html: reminderHtml,
                    context: 'invoice_reminder',
                    relatedId: invoice.id,
                })

                if (emailResult.success) {
                    // Mettre à jour les notes pour marquer le rappel
                    const reminderLog = `\n[${targetLevel}] Rappel envoyé le ${now.toLocaleDateString('fr-FR')} (J+${daysOverdue})`
                    await supabase.from('documents_financiers').update({
                        notes: currentNotes + reminderLog,
                    }).eq('id', invoice.id)

                    // Notifier l'admin/agent
                    if (config.adminEmail) {
                        const levelLabel = targetLevel === 'reminder_1' ? '1er' : (targetLevel === 'reminder_2' ? '2ème' : 'DERNIER')
                        await sendEmail({
                            to: config.adminEmail,
 subject: `${levelLabel} rappel envoyé — ${invoice.numero} (${invoice.client_nom})`,
                            html: await (await getEmailTemplates('fr')).newLeadNotification(
                                invoice.client_nom,
                                invoice.client_email,
                                Math.min(100, Math.round(daysOverdue * 3.3)),
                                `Facture ${invoice.numero} — ${montantFormatted} ${currency}`,
                                `Rappel automatique (${levelLabel})`,
                            ),
                            context: 'admin_notification',
                            relatedId: invoice.id,
                        })
                    }

                    results.push({
                        invoiceId: invoice.id,
                        numero: invoice.numero,
                        level: targetLevel,
                        success: true,
                    })
                } else {
                    results.push({
                        invoiceId: invoice.id,
                        numero: invoice.numero,
                        level: targetLevel,
                        success: false,
                        error: emailResult.error,
                    })
                }
            } catch (sendErr) {
                const errMsg = sendErr instanceof Error ? sendErr.message : 'Erreur inconnue'
                console.error(`[CRON/Reminders] Erreur envoi ${invoice.numero}:`, errMsg)
                results.push({
                    invoiceId: invoice.id,
                    numero: invoice.numero,
                    level: targetLevel,
                    success: false,
                    error: errMsg,
                })
            }
        }

        const sent = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length

        console.log(`[CRON/Reminders] Terminé — ${sent} rappels envoyés, ${failed} échecs, ${unpaidInvoices.length} factures analysées`)

        return NextResponse.json({
            success: true,
            message: `${sent} rappel(s) envoyé(s), ${failed} échec(s)`,
            processed: unpaidInvoices.length,
            sent,
            failed,
            details: results,
        })
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erreur serveur'
        console.error('[CRON/Reminders] Erreur globale:', errMsg)
        return NextResponse.json({ error: errMsg }, { status: 500 })
    }
}

/**
 * GET — Permet à Vercel Cron de vérifier que l'endpoint est live.
 * Utile aussi pour le monitoring.
 */
export async function GET(request: Request) {
    // Vérification auth pour GET aussi
    const authHeader = request.headers.get('authorization') || ''
    const querySecret = new URL(request.url).searchParams.get('secret') || ''

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Appeler la logique POST
    return POST(request)
}
