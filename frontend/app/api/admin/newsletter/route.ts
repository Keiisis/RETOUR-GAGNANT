import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { sendEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// ── Coque email RGB (bande tricolore + logo + pied désinscription légal) ──
function wrapEmail(subject: string, bodyHtml: string, unsubUrl: string): string {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f8faf9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff">
    <div style="display:flex;height:7px"><div style="flex:1;background:#008751"></div><div style="flex:1;background:#FCD116"></div><div style="flex:1;background:#E8112D"></div></div>
    <div style="padding:22px 28px;text-align:center;border-bottom:1px solid #eef2f1">
      <img src="${SITE_URL}/logo.jpg" alt="Retour Gagnant Bénin" width="54" height="54" style="border-radius:10px;object-fit:cover" />
      <div style="font-size:17px;font-weight:800;color:#1a2332;margin-top:8px;letter-spacing:.3px">RETOUR GAGNANT BÉNIN</div>
    </div>
    <div style="padding:30px 28px;color:#1a2332;font-size:15px;line-height:1.7">
      ${bodyHtml}
    </div>
    <div style="padding:20px 28px;background:#f8faf9;border-top:1px solid #eef2f1;text-align:center">
      <p style="margin:0 0 6px;font-size:11px;color:#718096">Retour Gagnant Bénin · contact@retourgagnantbenin.bj · +229 01 60 32 21 21</p>
      <p style="margin:0;font-size:11px;color:#a0aec0">Vous recevez cet email car vous êtes abonné à notre newsletter.
        <a href="${unsubUrl}" style="color:#008751;text-decoration:underline">Se désinscrire</a></p>
    </div>
    <div style="display:flex;height:7px"><div style="flex:1;background:#008751"></div><div style="flex:1;background:#FCD116"></div><div style="flex:1;background:#E8112D"></div></div>
  </div>
</body></html>`
}

// GET /api/admin/newsletter : stats + dernières campagnes
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    const supabase = createClient(supabaseUrl, serviceKey)

    const [{ count: active }, { count: total }, { data: campaigns }, { data: subscribers }] = await Promise.all([
        supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }),
        supabase.from('newsletter_campaigns').select('id, subject, status, recipient_count, sent_count, failed_count, sent_by_nom, created_at').order('created_at', { ascending: false }).limit(20),
        // Liste nominative des abonnés (qui est inscrit, depuis quand, d'où)
        supabase.from('newsletter_subscribers').select('id, email, status, source, subscribed_at, unsubscribed_at').order('subscribed_at', { ascending: false }).limit(500),
    ])

    return NextResponse.json({
        activeSubscribers: active || 0,
        totalSubscribers: total || 0,
        campaigns: campaigns || [],
        subscribers: subscribers || [],
    })
}

// POST /api/admin/newsletter : envoi d'une campagne à tous les abonnés actifs
// Body : { subject: string, html: string }
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const subject = String(body.subject || '').trim()
    const html = String(body.html || '').trim()
    if (!subject || !html) {
        return NextResponse.json({ error: 'Sujet et contenu requis' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: subs, error } = await supabase
        .from('newsletter_subscribers')
        .select('email, unsubscribe_token')
        .eq('status', 'active')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!subs || subs.length === 0) {
        return NextResponse.json({ error: 'Aucun abonné actif' }, { status: 400 })
    }

    const { data: profile } = await supabase
        .from('user_profiles').select('full_name').eq('id', auth.userId!).maybeSingle()

    let sent = 0
    let failed = 0
    // Envoi par lots (concurrence limitée) pour ménager le SMTP
    const BATCH = 5
    for (let i = 0; i < subs.length; i += BATCH) {
        const slice = subs.slice(i, i + BATCH)
        const results = await Promise.all(slice.map(async (s) => {
            const unsubUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${s.unsubscribe_token}`
            const r = await sendEmail({
                to: s.email,
                subject,
                html: wrapEmail(subject, html, unsubUrl),
                context: 'newsletter',
            }).catch(() => ({ success: false }))
            return r.success
        }))
        sent += results.filter(Boolean).length
        failed += results.filter(r => !r).length
    }

    const status = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'
    await supabase.from('newsletter_campaigns').insert({
        subject, html, status,
        recipient_count: subs.length,
        sent_count: sent,
        failed_count: failed,
        sent_by: auth.userId,
        sent_by_nom: profile?.full_name || null,
    })

    return NextResponse.json({ success: true, recipients: subs.length, sent, failed, status })
}
