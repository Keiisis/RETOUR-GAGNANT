import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import Groq from 'groq-sdk'
import { getGroqApiKey } from '@/lib/groq'
import { executerCron } from '@/lib/cron-journal'
import { requireCron } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const apiKey = getGroqApiKey()
const groq = apiKey ? new Groq({ apiKey }) : null

// ─── Seuils de rappels (jours depuis la soumission) ────────────────────────────
// Semaine 3 = 21j, Semaine 5 = 35j, Semaine 7 = 49j (deadline)
const THRESHOLDS = [
    { minDays: 20, maxDays: 22, week: 3, tone: 'gentle' },
    { minDays: 34, maxDays: 36, week: 5, tone: 'firm' },
    { minDays: 48, maxDays: 50, week: 7, tone: 'final' },
]

type Tone = 'gentle' | 'firm' | 'final'

// ─── SMTP ─────────────────────────────────────────────────────────────────────
async function getSmtp(): Promise<Record<string, string>> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'contact_email', 'hero_title'])
    const s: Record<string, string> = {}
    for (const row of data || []) s[row.key] = row.value
    return s
}

async function sendMail(smtp: Record<string, string>, to: string, subject: string, html: string) {
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) return false
    const transporter = nodemailer.createTransport({
        host: smtp.smtp_host,
        port: Number(smtp.smtp_port) || 465,
        secure: Number(smtp.smtp_port) === 465,
        auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
    })
    await transporter.sendMail({
        from: `"${smtp.smtp_from_name || 'Retour Gagnant Bénin'}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
        to,
        subject,
        html,
    })
    return true
}

function wrapHtml(smtp: Record<string, string>, ref: string, body: string) {
    const siteName = smtp.hero_title || 'Retour Gagnant Bénin'
    return `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:650px;margin:0 auto;background:#fff;border:1px solid #d4d4d4;">
        <div style="background:linear-gradient(135deg,#006b40,#008751);padding:26px 40px;text-align:center;">
            <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">${siteName}</h1>
            <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:5px 0 0;font-weight:600;">Suivi de dossier</p>
        </div>
        <div style="background:#f0fdf6;padding:14px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Dossier N°</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:3px;">${ref}</p>
        </div>
        <div style="padding:32px 40px;color:#1a1a1a;font-size:14px;line-height:1.85;">${body}</div>
        <div style="padding:14px 40px;background:#0d1117;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:11px;">&copy; ${new Date().getFullYear()} ${siteName} — <a href="${SITE_URL}" style="color:#008751;text-decoration:none;">${SITE_URL.replace('https://','')}</a></p>
        </div>
    </div>`
}

// ─── Génération email via Groq ─────────────────────────────────────────────────
async function generateReminderBody(
    prenom: string,
    nom: string,
    ref: string,
    deadline: string,
    missingDocs: { label: string; ancestral: boolean }[],
    tone: Tone,
    needsRechercheAncestrale: boolean
): Promise<string> {
    const toneDesc = tone === 'gentle'
        ? 'bienveillant et encourageant — c\'est un premier rappel amical'
        : tone === 'firm'
            ? 'ferme mais respectueux — le dossier risque d\'être suspendu si rien n\'est transmis'
            : 'urgent et solennel — c\'est la dernière chance avant suspension du dossier'

    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Tu es le rédacteur institutionnel de "Retour Gagnant Bénin". Rédige un email de relance ${toneDesc} pour rappeler au demandeur de compléter son dossier de nationalité béninoise. Format HTML, corps uniquement (balises <p>, <strong>, <ul>). Aucun emoji. Pas de répétition.`
                    },
                    {
                        role: 'user',
                        content: `Demandeur : ${prenom} ${nom} — Référence : ${ref} — Deadline : ${deadline}. Pièces encore manquantes : ${missingDocs.map(d => d.label).join(', ')}. ${needsRechercheAncestrale ? 'Des documents ancestraux sont toujours manquants — mentionne brièvement notre service Recherche Ancestrale (250 €).' : ''} Rédige le corps de l'email de rappel.`
                    }
                ],
                model: 'mixtral-8x7b-32768',
                temperature: 0.3,
            })
            return completion.choices[0]?.message?.content || ''
        } catch { /* fallback */ }
    }

    // Fallback statique selon le ton
    const toneIntro = tone === 'gentle'
        ? `<p>Nous espérons que vous allez bien. Nous vous contactons car votre dossier de nationalité béninoise sous la référence <strong>${ref}</strong> nécessite encore quelques documents.</p>`
        : tone === 'firm'
            ? `<p>Nous vous rappelons que votre dossier sous la référence <strong>${ref}</strong> est en attente de pièces justificatives importantes. Sans réception de ces documents avant le <strong>${deadline}</strong>, votre dossier sera suspendu.</p>`
            : `<p><strong>RAPPEL FINAL</strong> — Votre dossier de nationalité béninoise (<strong>${ref}</strong>) est en attente depuis plusieurs semaines. Passé la date du <strong>${deadline}</strong>, votre dossier sera suspendu sans possibilité de traitement immédiat.</p>`

    return `${toneIntro}
        <p>Documents encore attendus :</p>
        <ul style="padding-left:20px;line-height:2;">${missingDocs.map(d => `<li${d.ancestral ? ' style="color:#d97706;"' : ''}>${d.label}${d.ancestral ? ' <em>(document ancestral)</em>' : ''}</li>`).join('')}</ul>
        <p>Merci de nous les faire parvenir dès que possible via votre espace ou en répondant à cet email.</p>
        <p>Très respectueusement,<br>L'équipe Retour Gagnant Bénin</p>`
}

// ─── POST /api/cron/nationality-followup ──────────────────────────────────────
export async function POST(request: NextRequest) {
    // Auth via CRON_SECRET
    return executerCron('nationality-followup', request, async () => {

        const now = new Date()
        const results: { ref: string; week: number; sent: boolean; reason?: string }[] = []

        try {
            // Récupérer tous les dossiers avec des docs manquants et non clôturés
            const { data: applications, error } = await supabase
                .from('nationality_applications')
                .select('application_ref, email, prenom, nom, submitted_at, docs_deadline, missing_docs, needs_recherche_ancestrale, last_reminder_week')
                .not('missing_docs', 'is', null)
                .not('docs_deadline', 'is', null)
                .in('status', ['soumis', 'en_cours'])
                .gt('docs_deadline', now.toISOString()) // pas encore expiré

            if (error) {
                console.error('[FOLLOWUP] Erreur DB:', error.message)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            const smtp = await getSmtp()

            for (const app of applications || []) {
                const submittedAt = new Date(app.submitted_at)
                const daysSinceSubmission = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24))
                const deadline = new Date(app.docs_deadline)
                const deadlineStr = deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                const missingDocs: { label: string; ancestral: boolean }[] = app.missing_docs || []
                const lastReminderWeek: number = app.last_reminder_week || 0

                // Trouver le seuil applicable
                const threshold = THRESHOLDS.find(t =>
                    daysSinceSubmission >= t.minDays &&
                    daysSinceSubmission <= t.maxDays &&
                    lastReminderWeek < t.week
                )

                if (!threshold) continue

                // Générer et envoyer l'email
                const body = await generateReminderBody(
                    app.prenom,
                    app.nom,
                    app.application_ref,
                    deadlineStr,
                    missingDocs,
                    threshold.tone as Tone,
                    app.needs_recherche_ancestrale || false
                )

                // Ajouter section Recherche Ancestrale pour les relances semaine 5 et 7
                const ancestralSection = app.needs_recherche_ancestrale && threshold.week >= 5 ? `
                    <div style="margin:20px 0;padding:16px 22px;background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;">
                        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">Laissez-nous retrouver vos documents ancestraux</p>
                        <p style="margin:0 0 12px;font-size:13px;color:#78350f;line-height:1.7;">Notre service Recherche Ancestrale mobilise archives officielles, bases de données spécialisées et associations expertes pour retrouver la trace de vos ancêtres.</p>
                        <p style="margin:0 0 12px;font-size:13px;color:#78350f;"><strong>Investissement : 250 €</strong></p>
                        <a href="${SITE_URL}/nationalite/complement-ancestral?ref=${app.application_ref}" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;">
                            Déléguer ma Recherche Ancestrale →
                        </a>
                    </div>` : ''

                const fullBody = body + ancestralSection
                const html = wrapHtml(smtp, app.application_ref, fullBody)

                const subjectByTone = {
                    gentle: `Rappel — Documents manquants pour votre dossier ${app.application_ref}`,
                    firm: `URGENT — Complétez votre dossier avant le ${deadlineStr}`,
                    final: `DERNIER RAPPEL — Dossier ${app.application_ref} en danger de suspension`,
                }

                const sent = await sendMail(smtp, app.email, subjectByTone[threshold.tone as Tone], html)

                // Mettre à jour le dernier rappel envoyé
                if (sent) {
                    await supabase
                        .from('nationality_applications')
                        .update({ last_reminder_week: threshold.week })
                        .eq('application_ref', app.application_ref)

                    // Semaine 7 → escalade admin
                    if (threshold.week === 7) {
                        const adminEmail = smtp.contact_email || smtp.smtp_from_email
                        if (adminEmail) {
                            await sendMail(smtp, adminEmail,
                                `[ADMIN] Dossier ${app.application_ref} — Deadline atteinte`,
                                wrapHtml(smtp, app.application_ref, `
                                    <p>Le dossier de <strong>${app.prenom} ${app.nom}</strong> (${app.email}) a atteint sa deadline de 7 semaines.</p>
                                    <p>Documents toujours manquants : ${missingDocs.map(d => d.label).join(', ')}</p>
                                    <p>Action recommandée : contacter le client directement ou suspendre le dossier.</p>
                                `)
                            )
                        }
                    }
                }

                results.push({ ref: app.application_ref, week: threshold.week, sent })
            }

            return NextResponse.json({
                success: true,
                processed: results.length,
                results,
                timestamp: now.toISOString(),
            })
        } catch (error) {
            console.error('[FOLLOWUP] Erreur:', error)
            return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
        }
    })
}

// GET pour les pings de santé (Vercel Cron)
export async function GET(request: NextRequest) {
    const refus = requireCron(request)
    if (refus) return refus
    return POST(request)
}
