// ══════════════════════════════════════════════════════════════
// 📊 CRON — Rapport KPI Hebdomadaire (chaque lundi matin)
// Destinataires : contact@retourgagnantbenin.bj + pdg.retourgagnantbenin@gmail.com
// Contenu : visiteurs de la semaine (volume + évolution vs semaine
// précédente), localisations, pages consultées, appareils et sources,
// messages reçus (« ce que les clients ont dit »), services demandés,
// rendez-vous, prospects et encaissements. Présentation email soignée,
// compatible Gmail/Outlook (tables + styles inline).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
const RECIPIENTS = ['contact@retourgagnantbenin.bj', 'pdg.retourgagnantbenin@gmail.com']

function verifyAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
    if (process.env.NODE_ENV === 'development') return true
    return false
}

/* ── Helpers ─────────────────────────────────────────────────── */
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const nf = (n: number) => n.toLocaleString('fr-FR')
const frDay = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Porto-Novo' })

function topN<T extends string>(rows: Array<T | null | undefined>, n: number): Array<{ key: string; count: number }> {
    const m = new Map<string, number>()
    for (const r of rows) {
        const k = (r || '').trim()
        if (!k) continue
        m.set(k, (m.get(k) || 0) + 1)
    }
    return [...m.entries()].map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count).slice(0, n)
}

function delta(cur: number, prev: number): { txt: string; color: string } {
    if (prev === 0) return cur > 0 ? { txt: 'nouveau', color: '#047857' } : { txt: 'stable', color: '#8B94A6' }
    const pct = Math.round(((cur - prev) / prev) * 100)
    if (pct > 0) return { txt: `+${pct}% vs sem. précédente`, color: '#047857' }
    if (pct < 0) return { txt: `${pct}% vs sem. précédente`, color: '#DC2626' }
    return { txt: 'stable vs sem. précédente', color: '#8B94A6' }
}

/** Barre horizontale compatible email (table + fond coloré). */
function bar(label: string, count: number, max: number, color = '#008751'): string {
    const pct = Math.max(4, Math.round((count / Math.max(1, max)) * 100))
    return `
    <tr>
      <td style="padding:5px 0;width:170px;font-size:12.5px;color:#1B2A4A;font-weight:600;vertical-align:middle;">${esc(label)}</td>
      <td style="padding:5px 0 5px 10px;vertical-align:middle;">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:${pct}%;background:${color};border-radius:6px;height:14px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding-left:8px;font-size:12px;color:#5B6478;font-weight:700;white-space:nowrap;">${nf(count)}</td>
          <td style="width:${100 - pct}%;"></td>
        </tr></table>
      </td>
    </tr>`
}

function sectionTitle(title: string, subtitle: string): string {
    return `
    <tr><td style="padding:30px 32px 6px;">
      <p style="margin:0;font-size:17px;font-weight:800;color:#1B2A4A;">${esc(title)}</p>
      <p style="margin:3px 0 0;font-size:12px;color:#8B94A6;line-height:1.5;">${esc(subtitle)}</p>
    </td></tr>`
}

/* ── Collecte + rapport ─────────────────────────────────────── */
async function buildReport() {
    const now = new Date()
    const weekStart = new Date(now.getTime() - 7 * 864e5)
    const prevStart = new Date(now.getTime() - 14 * 864e5)
    const iso = (d: Date) => d.toISOString()

    // 1. Visiteurs (sessions) — semaine courante + précédente
    const { data: sessions } = await supabase
        .from('visitor_sessions')
        .select('session_id, country, city, page, device_type, referrer, utm_source, created_at')
        .gte('created_at', iso(weekStart)).limit(20000)
    const { count: prevSessionsCount } = await supabase
        .from('visitor_sessions').select('*', { count: 'exact', head: true })
        .gte('created_at', iso(prevStart)).lt('created_at', iso(weekStart))

    const sess = sessions || []
    const uniqueVisitors = new Set(sess.map(s => s.session_id)).size
    const countries = topN(sess.map(s => s.country), 6)
    const cities = topN(sess.map(s => s.city), 6)
    const pages = topN(sess.map(s => s.page), 8)
    const devices = topN(sess.map(s => s.device_type), 4)
    const refHost = (ref: string | null | undefined): string => {
        if (!ref) return 'Accès direct'
        try { return new URL(ref.startsWith('http') ? ref : `https://${ref}`).hostname.replace('www.', '') || 'Accès direct' }
        catch { return 'Autre' }
    }
    const sources = topN(sess.map(s => s.utm_source || refHost(s.referrer)), 6)

    // 2. Messages de la semaine (« ce que les clients ont dit »)
    const { data: weekMessages } = await supabase
        .from('messages')
        .select('nom, email, sujet, message, type, created_at')
        .gte('created_at', iso(weekStart))
        .order('created_at', { ascending: false }).limit(60)

    // 3. RDV + prospects + dossiers nationalité
    const { data: rdvs } = await supabase
        .from('rdv_requests').select('motif, client_email, created_at')
        .gte('created_at', iso(weekStart)).limit(500)
    const { count: prevRdv } = await supabase
        .from('rdv_requests').select('*', { count: 'exact', head: true })
        .gte('created_at', iso(prevStart)).lt('created_at', iso(weekStart))
    const { count: leadsCount } = await supabase
        .from('eligibility_results').select('*', { count: 'exact', head: true })
        .gte('created_at', iso(weekStart))
    const { data: natApps } = await supabase
        .from('nationality_applications').select('payment_status, amount, currency, created_at')
        .gte('created_at', iso(weekStart)).limit(200)

    // 4. Encaissements : commandes payées + factures/devis payés
    const { data: paidOrders } = await supabase
        .from('orders').select('amount, currency, product_title, customer_name, created_at')
        .eq('payment_status', 'completed')
        .gte('created_at', iso(weekStart)).limit(300)
    const { data: paidDocs } = await supabase
        .from('documents_financiers').select('total, currency, type, numero, client_nom, client_prenom, paid_at')
        .eq('status', 'paye')
        .gte('paid_at', iso(weekStart)).limit(300)

    // Agrégats revenus par devise
    const revenue = new Map<string, number>()
    for (const o of paidOrders || []) revenue.set(o.currency || 'XOF', (revenue.get(o.currency || 'XOF') || 0) + Number(o.amount || 0))
    for (const d of paidDocs || []) revenue.set(d.currency || 'XOF', (revenue.get(d.currency || 'XOF') || 0) + Number(d.total || 0))
    for (const n of natApps || []) if (n.payment_status === 'payé') revenue.set(n.currency || 'EUR', (revenue.get(n.currency || 'EUR') || 0) + Number(n.amount || 0))
    const revenueTxt = revenue.size
        ? [...revenue.entries()].map(([c, v]) => `${nf(Math.round(v))} ${c === 'XOF' ? 'FCFA' : c}`).join(' + ')
        : '0 FCFA'
    const paymentsCount = (paidOrders?.length || 0) + (paidDocs?.length || 0) + (natApps || []).filter(n => n.payment_status === 'payé').length

    // Services demandés (motifs RDV + commandes)
    const servicesAsked = topN([
        ...(rdvs || []).map(r => r.motif),
        ...(paidOrders || []).map(o => o.product_title?.split(' — ')[0] || ''),
        ...(natApps || []).map(() => 'Reconnaissance de Nationalité'),
    ], 8)

    const dSess = delta(sess.length, prevSessionsCount || 0)
    const dRdv = delta((rdvs || []).length, prevRdv || 0)

    /* ── HTML ── */
    const kpiTile = (value: string, label: string, sub: string, subColor: string) => `
      <td style="width:50%;padding:8px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAF9;border:1px solid #EEF2F1;border-radius:14px;border-collapse:separate;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0;font-size:30px;font-weight:900;color:#008751;line-height:1;">${value}</p>
            <p style="margin:7px 0 0;font-size:12.5px;font-weight:700;color:#1B2A4A;">${esc(label)}</p>
            <p style="margin:3px 0 0;font-size:11px;font-weight:700;color:${subColor};">${esc(sub)}</p>
          </td></tr>
        </table>
      </td>`

    const messagesRows = (weekMessages || []).slice(0, 12).map(m => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #F1F4F3;">
          <p style="margin:0;font-size:13px;font-weight:800;color:#1B2A4A;">${esc(m.nom || m.email)}
            <span style="font-weight:600;color:#8B94A6;font-size:11px;"> · ${esc(new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Porto-Novo' }))}${m.type ? ` · ${esc(m.type)}` : ''}</span>
          </p>
          <p style="margin:3px 0 0;font-size:12px;font-weight:700;color:#047857;">${esc(m.sujet || 'Sans sujet')}</p>
          <p style="margin:4px 0 0;font-size:12.5px;color:#5B6478;line-height:1.55;">${esc(String(m.message || '').slice(0, 180))}${String(m.message || '').length > 180 ? '…' : ''}</p>
        </td>
      </tr>`).join('')

    const html = `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;background:#F4F6F5;padding:18px 10px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border-collapse:separate;border:1px solid #E8ECEA;">

        <!-- EN-TÊTE -->
        <tr><td style="height:6px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%);font-size:0;">&nbsp;</td></tr>
        <tr><td style="background:linear-gradient(135deg,#045032,#008751);padding:30px 32px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
            <td>
              <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:3px;color:#FCD116;text-transform:uppercase;">Retour Gagnant Bénin</p>
              <p style="margin:6px 0 0;font-size:24px;font-weight:900;color:#ffffff;">Rapport hebdomadaire</p>
              <p style="margin:5px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Semaine du ${esc(frDay(weekStart))} au ${esc(frDay(now))} — l'évolution de votre site en un coup d'œil.</p>
            </td>
            <td style="width:64px;text-align:right;vertical-align:top;">
              <img src="${SITE}/logo.jpg" alt="RGB" width="56" height="56" style="border-radius:12px;border:2px solid rgba(255,255,255,0.35);" />
            </td>
          </tr></table>
        </td></tr>

        <!-- KPI TILES -->
        <tr><td style="padding:18px 24px 4px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              ${kpiTile(nf(sess.length), 'Visites cette semaine', dSess.txt, dSess.color)}
              ${kpiTile(nf(uniqueVisitors), 'Visiteurs uniques', 'sessions distinctes sur 7 jours', '#8B94A6')}
            </tr>
            <tr>
              ${kpiTile(nf((rdvs || []).length), 'Rendez-vous demandés', dRdv.txt, dRdv.color)}
              ${kpiTile(revenueTxt, 'Encaissé cette semaine', `${nf(paymentsCount)} paiement(s) confirmé(s)`, '#8B94A6')}
            </tr>
          </table>
        </td></tr>

        <!-- LOCALISATIONS -->
        ${sectionTitle("D'où viennent vos visiteurs", 'Pays et villes de connexion des visiteurs de la semaine (géolocalisation des sessions).')}
        <tr><td style="padding:8px 32px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${countries.map(c => bar(c.key, c.count, countries[0]?.count || 1, '#008751')).join('') || '<tr><td style="font-size:12px;color:#8B94A6;padding:6px 0;">Aucune donnée cette semaine.</td></tr>'}
          </table>
          ${cities.length ? `<p style="margin:12px 0 0;font-size:12px;color:#5B6478;line-height:1.6;"><span style="font-weight:800;color:#1B2A4A;">Principales villes :</span> ${cities.map(c => `${esc(c.key)} (${nf(c.count)})`).join(', ')}.</p>` : ''}
        </td></tr>

        <!-- PAGES -->
        ${sectionTitle('Pages les plus consultées', 'Là où vos visiteurs passent leur temps — utile pour savoir quels services attirent le plus.')}
        <tr><td style="padding:8px 32px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${pages.map(p => bar(p.key === '/' ? 'Accueil' : p.key, p.count, pages[0]?.count || 1, '#C9A84C')).join('') || '<tr><td style="font-size:12px;color:#8B94A6;padding:6px 0;">Aucune donnée cette semaine.</td></tr>'}
          </table>
        </td></tr>

        <!-- APPAREILS + SOURCES -->
        ${sectionTitle('Appareils et provenance', 'Comment vos visiteurs arrivent sur le site et depuis quel type d’appareil.')}
        <tr><td style="padding:8px 32px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>
            <td style="width:50%;vertical-align:top;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:1px;">Appareils</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                ${devices.map(d => bar(d.key, d.count, devices[0]?.count || 1, '#0EA5E9')).join('') || ''}
              </table>
            </td>
            <td style="width:50%;vertical-align:top;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:1px;">Sources de trafic</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                ${sources.map(s => bar(s.key, s.count, sources[0]?.count || 1, '#7C5CCA')).join('') || ''}
              </table>
            </td>
          </tr></table>
        </td></tr>

        <!-- SERVICES DEMANDÉS -->
        ${sectionTitle('Services demandés cette semaine', 'Rendez-vous, commandes et dossiers : ce que vos clients sont venus chercher.')}
        <tr><td style="padding:8px 32px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${servicesAsked.map(s => bar(s.key, s.count, servicesAsked[0]?.count || 1, '#008751')).join('') || '<tr><td style="font-size:12px;color:#8B94A6;padding:6px 0;">Aucune demande cette semaine.</td></tr>'}
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#5B6478;line-height:1.6;">
            <span style="font-weight:800;color:#1B2A4A;">${nf(leadsCount || 0)}</span> nouveau(x) prospect(s) capturé(s) ·
            <span style="font-weight:800;color:#1B2A4A;">${nf((natApps || []).length)}</span> dossier(s) de nationalité déposé(s) ·
            <span style="font-weight:800;color:#1B2A4A;">${nf((paidOrders || []).length)}</span> commande(s) payée(s).
          </p>
        </td></tr>

        <!-- MESSAGES -->
        ${sectionTitle('Ce que vos clients ont dit', `${nf((weekMessages || []).length)} message(s) reçu(s) cette semaine — extraits des plus récents.`)}
        <tr><td style="padding:4px 32px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            ${messagesRows || '<tr><td style="font-size:12px;color:#8B94A6;padding:6px 0;">Aucun message reçu cette semaine.</td></tr>'}
          </table>
          ${(weekMessages || []).length > 12 ? `<p style="margin:10px 0 0;font-size:11px;color:#8B94A6;">+ ${nf((weekMessages || []).length - 12)} autre(s) message(s) consultable(s) dans le panel.</p>` : ''}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:28px 32px;text-align:center;">
          <a href="${SITE}/admin" style="display:inline-block;background:#008751;color:#ffffff;text-decoration:none;padding:13px 34px;border-radius:12px;font-weight:800;font-size:13.5px;">Ouvrir le tableau de bord complet</a>
        </td></tr>

        <!-- PIED -->
        <tr><td style="background:#0d1117;padding:18px 32px;text-align:center;">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.7;">
            Rapport généré automatiquement chaque lundi matin à partir des données réelles du site.<br>
            &copy; ${now.getFullYear()} Retour Gagnant Bénin — <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
          </p>
        </td></tr>
      </table>
    </div>`

    const subject = `📊 Rapport hebdomadaire — ${nf(sess.length)} visites, ${nf((rdvs || []).length)} RDV, ${revenueTxt} encaissés`
    return { html, subject, stats: { sessions: sess.length, rdv: (rdvs || []).length, messages: (weekMessages || []).length, paymentsCount } }
}

export async function GET(request: NextRequest) {
    if (!verifyAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
        const { html, subject, stats } = await buildReport()
        const res = await sendEmail({
            to: RECIPIENTS.join(', '),
            subject,
            html,
            context: 'weekly_kpi_report',
        })
        if (!res.success) return NextResponse.json({ error: res.error || 'Envoi échoué' }, { status: 500 })
        return NextResponse.json({ success: true, sentTo: RECIPIENTS, ...stats, timestamp: new Date().toISOString() })
    } catch (err) {
        console.error('[CRON weekly-kpi]', err)
        return NextResponse.json({ error: 'Rapport KPI échoué' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) { return GET(request) }
