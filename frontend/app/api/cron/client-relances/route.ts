// ══════════════════════════════════════════════════════════════
// 🔔 CRON — Relances Classement Client
// Chaque jour : pour chaque client, si un jalon (15/20/30/45/60/75/90 j)
// est atteint et pas encore notifié, envoie un email de rappel (à l'équipe)
// avec l'état du dossier (statut + notes/problèmes) ET des suggestions
// professionnelles générées par l'IA selon le service et les notes.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getEmailConfig } from '@/lib/email'
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq'
import { daysSince, dueMilestones, getCategory, getStatus } from '@/lib/classement/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// Destinataires fixes des relances (+ email admin configuré)
const FIXED_RECIPIENTS = [
    'kevinrtgagnant@gmail.com',
    'pdg.retourgagnantbenin@gmail.com',
    'ornelmitchai6@gmail.com',
    'jeanbaptiste01rgb@gmail.com',
    'tiamiounadjathrgb@gmail.com',
]

const SKIP_STATUSES = ['perdu', 'termine']

function verifyAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
    if (process.env.NODE_ENV === 'development') return true
    return false
}

interface ClientRow {
    id: string; email: string; full_name: string | null; phone: string | null
    service_category: string; service_label: string | null; status: string
    notes: string | null; first_contact_at: string; relances_sent: number[] | null
}

async function aiSuggestions(c: ClientRow, days: number, milestone: number): Promise<string> {
    const fallback = `Faites le point sur ce dossier (${milestone} jours). Recontactez le client, confirmez l'étape en cours et planifiez la prochaine action concrète.`
    try {
        if (GROQ_KEYS.length === 0) return fallback
        const cat = getCategory(c.service_category).label
        const statut = getStatus(c.status).label
        const res = await fetchWithGroqRotation({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `Tu es un conseiller senior de Retour Gagnant Bénin (accompagnement diaspora). On te donne l'état d'un dossier client en attente de relance. Donne 3 suggestions d'actions CONCRÈTES, professionnelles et priorisées pour faire avancer ce dossier, en tenant compte du service et des problèmes notés. Sois précis et actionnable. Réponds en français, sous forme de 3 puces courtes commençant par "• ". Pas de markdown autre que les puces. Pas de blabla introductif.`,
                },
                {
                    role: 'user',
                    content: `Service : ${cat}\nStatut actuel : ${statut}\nJours depuis le 1er contact : ${days} (jalon de relance : ${milestone}j)\nNotes / problèmes rencontrés : ${c.notes?.trim() || '(aucune note renseignée)'}\nNom client : ${c.full_name || '—'}`,
                },
            ],
            temperature: 0.5,
            max_tokens: 320,
        })
        const data = await res.json()
        const txt = data.choices?.[0]?.message?.content?.trim()
        return txt && txt.length > 10 ? txt : fallback
    } catch {
        return fallback
    }
}

function buildEmail(c: ClientRow, days: number, milestone: number, suggestions: string): string {
    const cat = getCategory(c.service_category)
    const statut = getStatus(c.status)
    const suggestionsHtml = suggestions
        .split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => `<li style="margin:4px 0;color:#3E4A65;font-size:13.5px;line-height:1.6">${l.replace(/^•\s*/, '').replace(/</g, '&lt;')}</li>`).join('')

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
      <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
      <div style="padding:26px 28px">
        <p style="margin:0 0 4px;color:#047857;font-size:13px;font-weight:800">Retour Gagnant Bénin — Suivi Client</p>
        <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:20px;font-weight:800">Relance à ${milestone} jours — ${c.full_name || c.email}</h1>
        <p style="margin:0 0 18px;color:#8B94A6;font-size:13px">Il est temps de faire le point sur ce dossier.</p>

        <table style="width:100%;border-collapse:collapse;background:#F8FAF9;border-radius:10px;overflow:hidden;margin:0 0 18px">
          <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px;width:150px">Service</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cat.color};margin-right:7px"></span>${cat.label}</td></tr>
          <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Statut</td><td style="padding:9px 14px;color:${statut.color};font-size:13px;font-weight:700">${statut.label}</td></tr>
          <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Depuis le 1er contact</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${days} jours</td></tr>
          <tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Email</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px">${c.email}</td></tr>
          ${c.phone ? `<tr><td style="padding:9px 14px;color:#8B94A6;font-size:12px">Téléphone</td><td style="padding:9px 14px;color:#1B2A4A;font-size:13px">${String(c.phone).replace(/</g, '&lt;')}</td></tr>` : ''}
        </table>

        <div style="background:#FAF6EC;border:1px solid rgba(201,168,76,0.25);border-radius:10px;padding:14px 16px;margin:0 0 18px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:.15em">Où en est-on (notes)</p>
          <p style="margin:0;font-size:13.5px;color:#1B2A4A;line-height:1.7;white-space:pre-wrap">${(c.notes?.trim() || 'Aucune note renseignée pour ce client.').replace(/</g, '&lt;')}</p>
        </div>

        <div style="background:#F4FAF6;border-left:3px solid #008751;border-radius:0 10px 10px 0;padding:14px 16px;margin:0 0 20px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#008751;text-transform:uppercase;letter-spacing:.15em">Suggestions de l'assistant IA</p>
          <ul style="margin:0;padding-left:18px">${suggestionsHtml}</ul>
        </div>

        <a href="${SITE_URL}/agent/classement-client" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:13px">Ouvrir le Classement Client</a>
        <p style="margin:18px 0 0;color:#9aa5b1;font-size:11px;text-align:center">Rappel automatique — Retour Gagnant Bénin</p>
      </div>
    </div>`
}

async function run() {
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('client_classement')
        .select('id, email, full_name, phone, service_category, service_label, status, notes, first_contact_at, relances_sent')
    if (error) throw error

    const config = await getEmailConfig()
    const recipients = [...new Set([...FIXED_RECIPIENTS, ...(config.adminEmail ? [config.adminEmail] : [])])]
    const toLine = recipients.join(', ')

    let sentCount = 0
    const report: string[] = []

    for (const c of (data || []) as ClientRow[]) {
        if (SKIP_STATUSES.includes(c.status)) continue
        const days = daysSince(c.first_contact_at)
        const sent = Array.isArray(c.relances_sent) ? c.relances_sent : []
        const due = dueMilestones(days, sent)
        if (due.length === 0) continue

        const milestone = Math.max(...due) // jalon le plus élevé atteint
        const suggestions = await aiSuggestions(c, days, milestone)

        try {
            await sendEmail({
                to: toLine,
                subject: `Relance ${milestone}j — ${c.full_name || c.email} (${getCategory(c.service_category).label})`,
                html: buildEmail(c, days, milestone, suggestions),
                context: 'client_relance',
                relatedId: c.id,
            })
            // Marque tous les jalons dûs comme envoyés
            await supabase.from('client_classement')
                .update({ relances_sent: [...sent, ...due] })
                .eq('id', c.id)
            sentCount++
            report.push(`${c.email} → ${milestone}j`)
        } catch (e) {
            console.error('[CRON relances] envoi échoué', c.email, e instanceof Error ? e.message : e)
        }
    }

    return { sentCount, report }
}

export async function GET(request: NextRequest) {
    if (!verifyAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
        const result = await run()
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
    } catch (err) {
        console.error('[CRON client-relances]', err)
        return NextResponse.json({ error: 'Relances failed' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) { return GET(request) }
