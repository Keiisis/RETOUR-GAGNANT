// ══════════════════════════════════════════════════════════════
//  CRON — Cycle de vie des données sensibles
// Déclenché chaque nuit à 02h00 UTC
// 1. Suppression automatique des fichiers sensibles traités
// 2. Nettoyage des logs WAF anciens (> 90 jours)
// 3. Rapport quotidien par email à l'admin
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTransporter, getEmailConfig } from '@/lib/email'
import { requireCron } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Seuils de rétention des données
const SENSITIVE_DOC_RETENTION_DAYS = 90    // Documents sensibles traités → supprimés après 90j
const WAF_LOG_RETENTION_DAYS       = 90    // Logs WAF → supprimés après 90j
const BLOCKED_IP_EXPIRED_DAYS      = 30    // IPs bloquées expirées → purgées après 30j
const PROSPECT_RETENTION_DAYS      = 1095  // Prospects/leads non convertis → 3 ans (reco CNIL)


async function runLifecycle() {
    const supabase = createClient(supabaseUrl, serviceKey)
    const now = new Date()
    const report: string[] = []
    let totalDeleted = 0

    // ── 1. Supprimer les documents sensibles traités anciens ──
    const docThreshold = new Date(now.getTime() - SENSITIVE_DOC_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const { data: deletedDocs, error: docsErr } = await supabase
        .from('client_documents')
        .delete()
        .lt('created_at', docThreshold.toISOString())
        .in('status', ['traite', 'archive', 'processed'])
        .select('id, client_email, file_name')

    if (!docsErr && deletedDocs) {
        totalDeleted += deletedDocs.length
        report.push(` Documents traités supprimés : <strong>${deletedDocs.length}</strong> (> ${SENSITIVE_DOC_RETENTION_DAYS}j)`)
    } else if (docsErr) {
        report.push(` Erreur suppression documents : ${docsErr.message}`)
    }

    // ── 2. Supprimer les métadonnées de fichiers chiffrés orphelins ──
    const { data: deletedEncFiles } = await supabase
        .from('encrypted_files')
        .delete()
        .lt('created_at', docThreshold.toISOString())
        .is('document_id', null)
        .select('id')

    if (deletedEncFiles?.length) {
        report.push(` Fichiers chiffrés orphelins supprimés : <strong>${deletedEncFiles.length}</strong>`)
    }

    // ── 2bis. Purger les prospects/leads non convertis (> 3 ans, reco CNIL) ──
    const prospectThreshold = new Date(now.getTime() - PROSPECT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    for (const table of ['leads', 'nationality_leads']) {
        try {
            const { data: del } = await supabase
                .from(table)
                .delete()
                .lt('created_at', prospectThreshold.toISOString())
                .select('id')
            if (del?.length) {
                totalDeleted += del.length
                report.push(` Prospects « ${table} » supprimés : <strong>${del.length}</strong> (> 3 ans)`)
            }
        } catch { /* table absente : ignorer silencieusement */ }
    }

    // ── 3. Purger les anciens logs WAF ────────────────────────
    const wafThreshold = new Date(now.getTime() - WAF_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const { count: wafDeleted } = await supabase
        .from('waf_logs')
        .delete({ count: 'exact' })
        .lt('created_at', wafThreshold.toISOString())

    if (wafDeleted) {
        totalDeleted += wafDeleted
        report.push(` Logs WAF purgés : <strong>${wafDeleted}</strong> (> ${WAF_LOG_RETENTION_DAYS}j)`)
    }

    // ── 4. Purger les IPs débloquées depuis > 30j ─────────────
    const ipThreshold = new Date(now.getTime() - BLOCKED_IP_EXPIRED_DAYS * 24 * 60 * 60 * 1000)
    const { count: ipDeleted } = await supabase
        .from('ip_blocks')
        .delete({ count: 'exact' })
        .not('unblocked_at', 'is', null)
        .lt('unblocked_at', ipThreshold.toISOString())

    if (ipDeleted) {
        report.push(` Historique IP purgé : <strong>${ipDeleted}</strong> entrées`)
    }

    // ── 5. Statistiques du jour ───────────────────────────────
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const [
        { count: newDocs },
        { count: wafEvents },
        { count: newBlocks },
        { count: newOrders },
    ] = await Promise.all([
        supabase.from('client_documents').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()),
        supabase.from('waf_logs').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()),
        supabase.from('ip_blocks').select('*', { count: 'exact', head: true }).gte('blocked_at', yesterday.toISOString()),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()),
    ])

    const statsHtml = `
    <table style="border-collapse:collapse;width:100%;margin-top:12px">
        <tr style="background:#1a1a2e">
            <th style="padding:8px 12px;text-align:left;color:#9ca3af;font-size:12px">Métrique</th>
            <th style="padding:8px 12px;text-align:right;color:#9ca3af;font-size:12px">24h</th>
        </tr>
        <tr>
            <td style="padding:8px 12px;color:#e5e7eb">Nouveaux documents</td>
            <td style="padding:8px 12px;text-align:right;color:#f59e0b;font-weight:bold">${newDocs ?? 0}</td>
        </tr>
        <tr style="background:#111827">
            <td style="padding:8px 12px;color:#e5e7eb">Événements WAF</td>
            <td style="padding:8px 12px;text-align:right;color:${(wafEvents ?? 0) > 0 ? '#ef4444' : '#10b981'};font-weight:bold">${wafEvents ?? 0}</td>
        </tr>
        <tr>
            <td style="padding:8px 12px;color:#e5e7eb">Nouvelles IPs bloquées</td>
            <td style="padding:8px 12px;text-align:right;color:${(newBlocks ?? 0) > 0 ? '#f97316' : '#10b981'};font-weight:bold">${newBlocks ?? 0}</td>
        </tr>
        <tr style="background:#111827">
            <td style="padding:8px 12px;color:#e5e7eb">Nouvelles commandes</td>
            <td style="padding:8px 12px;text-align:right;color:#10b981;font-weight:bold">${newOrders ?? 0}</td>
        </tr>
    </table>`

    const cleanupHtml = report.length > 0
        ? `<ul style="margin:8px 0;padding-left:20px">${report.map(r => `<li style="color:#d1d5db;font-size:14px;margin:4px 0">${r}</li>`).join('')}</ul>`
        : '<p style="color:#6b7280;font-size:14px">Aucun nettoyage nécessaire aujourd\'hui.</p>'

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0f172a;font-family:Arial,sans-serif;margin:0;padding:20px">
        <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:20px 24px">
                <h1 style="color:#0f172a;margin:0;font-size:18px"> Rapport Quotidien — Sécurité & Données</h1>
                <p style="color:#0f172a;margin:4px 0 0;font-size:13px;opacity:0.8">Retour Gagnant Bénin · ${now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="padding:24px">
                <h2 style="color:#f59e0b;font-size:15px;margin:0 0 12px"> Activité des 24 dernières heures</h2>
                ${statsHtml}

                <h2 style="color:#f59e0b;font-size:15px;margin:20px 0 8px"> Nettoyage automatique</h2>
                ${cleanupHtml}

                <div style="margin-top:20px;padding:12px;background:#0f172a;border-radius:8px;border-left:3px solid #f59e0b">
                    <p style="color:#9ca3af;font-size:12px;margin:0">
                        Total supprimé aujourd'hui : <strong style="color:#f59e0b">${totalDeleted}</strong> enregistrement(s)<br>
                        Généré le ${now.toLocaleString('fr-FR')} UTC
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>`

    // ── 6. Envoyer le rapport par email ───────────────────────
    try {
        const emailConfig = await getEmailConfig()
        const transporter = await createTransporter()

        if (transporter && emailConfig.adminEmail) {
            await transporter.sendMail({
                from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
                to: emailConfig.adminEmail,
                subject: `[Retour Gagnant] Rapport sécurité ${now.toLocaleDateString('fr-FR')}`,
                html: emailHtml,
            })
        }
    } catch (emailErr) {
        console.error('[CRON] Erreur envoi rapport:', emailErr)
    }

    return { totalDeleted, report, stats: { newDocs, wafEvents, newBlocks, newOrders } }
}

export async function GET(request: NextRequest) {
    const refus = requireCron(request)
    if (refus) return refus
    try {
        const result = await runLifecycle()
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
    } catch (err) {
        console.error('[CRON data-lifecycle]', err)
        return NextResponse.json({ error: 'Lifecycle failed' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    return GET(request)
}
