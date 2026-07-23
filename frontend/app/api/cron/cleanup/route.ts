// ══════════════════════════════════════════════════════════════
//  CRON — Purge automatique des dossiers de nationalité (24h)
// ──────────────────────────────────────────────────────────────
// Ce endpoint s'exécute chaque nuit via Vercel Cron.
//
// FLUX :
//  1. Récupère tous les dossiers traités/archivés de + de 24h
//  2. Pour chaque dossier, télécharge les fichiers joints depuis Storage
//  3. Compile un email récapitulatif avec les fichiers en pièce jointe
//  4. Envoie l'email à l'adresse admin (Cold Storage / Sauvegarde à froid)
//  5. Supprime définitivement le dossier ET ses fichiers du serveur
//  6. Journalise l'opération dans security_logs
//
//  Utilise SUPABASE_SERVICE_ROLE_KEY pour bypasser le RLS
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTransporter, getEmailConfig } from '@/lib/email'
import { executerCron } from '@/lib/cron-journal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const RETENTION_HOURS = 24 // Durée de rétention avant purge

// ── Vérification d'authentification ──────────────────────────

// ── Fonction principale de purge ─────────────────────────────
async function runPurge() {
    const supabase = createClient(supabaseUrl, serviceKey)
    const now = new Date()
    const threshold = new Date(now.getTime() - RETENTION_HOURS * 60 * 60 * 1000)

    const results = {
        dossiersArchived: 0,
        dossiersDeleted: 0,
        filesDeleted: 0,
        emailsSent: 0,
        errors: [] as string[],
    }

    // ── 1. Récupérer les dossiers expirés ────────────────────
    // Table réelle = 'dossiers' (pas 'nationality_requests')
    // Colonne réelle = 'status' (pas 'statut')
    const { data: expiredDossiers, error: fetchErr } = await supabase
        .from('dossiers')
        .select('*')
        .lt('created_at', threshold.toISOString())
        .in('status', ['traite', 'archive', 'termine', 'processed'])

    if (fetchErr) {
        results.errors.push(`Erreur récupération dossiers: ${fetchErr.message}`)
        return results
    }

    if (!expiredDossiers || expiredDossiers.length === 0) {
        return results // Rien à purger
    }

    // ── 2. Pour chaque dossier : archiver par email puis supprimer ──
    const emailConfig = await getEmailConfig()
    const transporter = await createTransporter()

    for (const dossier of expiredDossiers) {
        try {
            // 2a. Récupérer les documents liés
            const { data: documents } = await supabase
                .from('dossier_documents')
                .select('*')
                .eq('dossier_id', dossier.id)

            // 2b. Télécharger les fichiers depuis Storage pour les joindre à l'email
            const attachments: { filename: string; content: Buffer; contentType: string }[] = []

            if (documents && documents.length > 0) {
                for (const doc of documents) {
                    if (doc.file_url) {
                        try {
                            // Extraire le chemin relatif du fichier dans le bucket
                            // Supporte : URL publique, URL signée, et chemin brut
                            let storagePath = doc.file_url as string
                            if (storagePath.includes('/storage/v1/object/public/dossier-documents/')) {
                                storagePath = storagePath.split('/storage/v1/object/public/dossier-documents/')[1]
                            } else if (storagePath.includes('/storage/v1/object/sign/dossier-documents/')) {
                                // Signed URL : extraire le path avant les query params (?token=...)
                                storagePath = storagePath.split('/storage/v1/object/sign/dossier-documents/')[1]?.split('?')[0]
                            } else if (storagePath.includes('dossier-documents/')) {
                                storagePath = storagePath.split('dossier-documents/')[1]?.split('?')[0]
                            }
                            // Sinon : c'est déjà un chemin brut (ex: "uuid/dossier_id/file.pdf")

                            if (storagePath) {
                                const { data: fileData } = await supabase.storage
                                    .from('dossier-documents')
                                    .download(storagePath)

                                if (fileData) {
                                    const arrayBuf = await fileData.arrayBuffer()
                                    attachments.push({
                                        filename: doc.file_name || `document_${doc.id}`,
                                        content: Buffer.from(arrayBuf),
                                        contentType: doc.file_type || 'application/octet-stream',
                                    })
                                }
                            }
                        } catch (dlErr) {
                            // Fichier peut-être déjà supprimé — on continue
                            console.warn(`[PURGE] Fichier introuvable: ${doc.file_name}`)
                        }
                    }
                }
            }

            // 2c. Compiler le récapitulatif HTML du dossier
            const dossierHtml = buildDossierArchiveEmail(dossier, documents || [], now)

            // 2d. Envoyer l'email d'archivage (Cold Storage)
            if (transporter && emailConfig.adminEmail) {
                try {
                    await transporter.sendMail({
                        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
                        to: emailConfig.adminEmail,
                        subject: `[ARCHIVE] Dossier ${dossier.numero || dossier.id} — Purge automatique ${now.toLocaleDateString('fr-FR')}`,
                        html: dossierHtml,
                        attachments: attachments.map(a => ({
                            filename: a.filename,
                            content: a.content,
                            contentType: a.contentType,
                        })),
                    })
                    results.emailsSent++
                    results.dossiersArchived++
                } catch (mailErr) {
                    const msg = mailErr instanceof Error ? mailErr.message : 'Erreur email inconnue'
                    results.errors.push(`Email échoué pour dossier ${dossier.id}: ${msg}`)
                    //  NE PAS supprimer si l'email a échoué — on réessaiera demain
                    continue
                }
            }

            // 2e. Supprimer les fichiers du Storage
            if (documents && documents.length > 0) {
                const storagePaths = documents
                    .filter(d => d.file_url)
                    .map(d => {
                        let p = d.file_url as string
                        if (p.includes('/storage/v1/object/public/dossier-documents/')) {
                            return p.split('/storage/v1/object/public/dossier-documents/')[1]
                        } else if (p.includes('/storage/v1/object/sign/dossier-documents/')) {
                            return p.split('/storage/v1/object/sign/dossier-documents/')[1]?.split('?')[0]
                        } else if (p.includes('dossier-documents/')) {
                            return p.split('dossier-documents/')[1]?.split('?')[0]
                        }
                        return p // chemin brut
                    })
                    .filter(Boolean)

                if (storagePaths.length > 0) {
                    const { error: storageErr } = await supabase.storage
                        .from('dossier-documents')
                        .remove(storagePaths)

                    if (!storageErr) {
                        results.filesDeleted += storagePaths.length
                    }
                }
            }

            // 2f. Supprimer les enregistrements de la base de données
            // Supprimer les documents liés
            await supabase.from('dossier_documents').delete().eq('dossier_id', dossier.id)
            // Supprimer le dossier tracking associé (sync bidirectionnelle)
            await supabase.from('dossier_tracking').delete().eq('dossier_ref_id', dossier.id)
            // Supprimer le dossier principal
            await supabase.from('dossiers').delete().eq('id', dossier.id)
            results.dossiersDeleted++

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erreur inconnue'
            results.errors.push(`Dossier ${dossier.id}: ${msg}`)
        }
    }

    // ── 3. Journaliser la purge dans security_logs ───────────
    try {
        await supabase.from('security_logs').insert({
            action: 'auto_purge_24h',
            details: {
                timestamp: now.toISOString(),
                retention_hours: RETENTION_HOURS,
                dossiers_found: expiredDossiers.length,
                dossiers_archived_by_email: results.dossiersArchived,
                dossiers_deleted: results.dossiersDeleted,
                files_deleted: results.filesDeleted,
                errors: results.errors,
            },
            records_affected: results.dossiersDeleted,
        })
    } catch { /* fail silently */ }

    // ── 4. Envoyer un rapport de purge à l'admin ─────────────
    if (transporter && emailConfig.adminEmail && results.dossiersDeleted > 0) {
        const reportHtml = buildPurgeReportEmail(results, now)
        await transporter.sendMail({
            from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
            to: emailConfig.adminEmail,
            subject: `[SÉCURITÉ] Purge 24h — ${results.dossiersDeleted} dossier(s) supprimé(s) · ${now.toLocaleDateString('fr-FR')}`,
            html: reportHtml,
        }).catch(() => { /* fail silently */ })
    }

    return results
}

// ══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════════════════

function buildDossierArchiveEmail(
    dossier: Record<string, unknown>,
    documents: Record<string, unknown>[],
    date: Date
): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px;text-align:center">
            <h1 style="color:#f59e0b;margin:0;font-size:18px"> Archive de Dossier — Purge Automatique</h1>
            <p style="color:#94a3b8;margin:6px 0 0;font-size:12px">${date.toLocaleString('fr-FR')} UTC</p>
        </div>
        <!-- Infos dossier -->
        <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse">
                <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">N° Dossier</td>
                    <td style="padding:10px 0;text-align:right;color:#1e293b;font-weight:700;font-size:14px;border-bottom:1px solid #f1f5f9">${dossier.numero || dossier.id}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">Service</td>
                    <td style="padding:10px 0;text-align:right;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9">${dossier.service_type || 'Nationalité'}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">Statut final</td>
                    <td style="padding:10px 0;text-align:right;color:#10b981;font-weight:700;font-size:13px;border-bottom:1px solid #f1f5f9">${dossier.statut || dossier.status}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9">Créé le</td>
                    <td style="padding:10px 0;text-align:right;color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9">${dossier.created_at ? new Date(dossier.created_at as string).toLocaleString('fr-FR') : '—'}</td>
                </tr>
                <tr>
                    <td style="padding:10px 0;color:#64748b;font-size:13px">Documents joints</td>
                    <td style="padding:10px 0;text-align:right;color:#f59e0b;font-weight:700;font-size:14px">${documents.length} fichier(s)</td>
                </tr>
            </table>
            ${documents.length > 0 ? `
            <div style="margin-top:16px;background:#fffbeb;border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px">
                <p style="margin:0 0 8px;font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:1px">Fichiers archivés en pièce jointe :</p>
                <ul style="margin:0;padding-left:18px;color:#78716c;font-size:13px">
                    ${documents.map(d => `<li>${(d as Record<string, unknown>).file_name || 'Document'}</li>`).join('')}
                </ul>
            </div>` : ''}
            <div style="margin-top:20px;background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0">
                <p style="margin:0;color:#991b1b;font-size:12px;font-weight:700"> Ce dossier a été définitivement supprimé de la base de données de production.</p>
                <p style="margin:4px 0 0;color:#7f1d1d;font-size:11px">Cet email constitue l'unique copie de sauvegarde (Cold Storage).</p>
            </div>
        </div>
    </div>
</body>
</html>`
}

function buildPurgeReportEmail(
    results: { dossiersArchived: number; dossiersDeleted: number; filesDeleted: number; emailsSent: number; errors: string[] },
    date: Date
): string {
    const hasErrors = results.errors.length > 0
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#dc2626,#f59e0b);padding:20px 24px">
            <h1 style="color:#fff;margin:0;font-size:18px"> Rapport de Purge Automatique — 24h</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:12px">Retour Gagnant Bénin · ${date.toLocaleString('fr-FR')}</p>
        </div>
        <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse">
                <tr style="background:#0f172a">
                    <td style="padding:10px 14px;color:#94a3b8;font-size:13px">Dossiers archivés par email</td>
                    <td style="padding:10px 14px;text-align:right;color:#10b981;font-weight:700;font-size:16px">${results.dossiersArchived}</td>
                </tr>
                <tr>
                    <td style="padding:10px 14px;color:#94a3b8;font-size:13px">Dossiers supprimés de la BDD</td>
                    <td style="padding:10px 14px;text-align:right;color:#f59e0b;font-weight:700;font-size:16px">${results.dossiersDeleted}</td>
                </tr>
                <tr style="background:#0f172a">
                    <td style="padding:10px 14px;color:#94a3b8;font-size:13px">Fichiers supprimés du Storage</td>
                    <td style="padding:10px 14px;text-align:right;color:#f59e0b;font-weight:700;font-size:16px">${results.filesDeleted}</td>
                </tr>
                <tr>
                    <td style="padding:10px 14px;color:#94a3b8;font-size:13px">Emails d'archive envoyés</td>
                    <td style="padding:10px 14px;text-align:right;color:#10b981;font-weight:700;font-size:16px">${results.emailsSent}</td>
                </tr>
            </table>
            ${hasErrors ? `
            <div style="margin-top:16px;background:#450a0a;border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px">
                <p style="margin:0 0 8px;color:#fca5a5;font-size:12px;font-weight:700"> Erreurs rencontrées :</p>
                <ul style="margin:0;padding-left:18px;color:#fca5a5;font-size:12px">
                    ${results.errors.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>` : `
            <div style="margin-top:16px;background:#052e16;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:14px;text-align:center">
                <p style="margin:0;color:#6ee7b7;font-size:13px;font-weight:700"> Purge complète — Aucune erreur</p>
            </div>`}
        </div>
    </div>
</body>
</html>`
}

// ══════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    return executerCron('cleanup', request, async () => {
        try {
            const result = await runPurge()
            return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
        } catch (err) {
            console.error('[CRON/cleanup]', err)
            return NextResponse.json({ error: 'Purge failed' }, { status: 500 })
        }
    })
}

export async function POST(request: NextRequest) {
    return GET(request)
}
