import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Page HTML de confirmation (charte RGB, bande tricolore)
function page(title: string, message: string, ok: boolean): Response {
    const color = ok ? '#008751' : '#E8112D'
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} : Retour Gagnant Bénin</title></head>
<body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f8faf9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px">
  <div style="max-width:480px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.08)">
    <div style="display:flex;height:6px"><div style="flex:1;background:#008751"></div><div style="flex:1;background:#FCD116"></div><div style="flex:1;background:#E8112D"></div></div>
    <div style="padding:36px 32px;text-align:center">
      <h1 style="margin:0 0 12px;font-size:20px;color:${color}">${title}</h1>
      <p style="margin:0;color:#4A5568;font-size:14px;line-height:1.6">${message}</p>
      <a href="https://www.retourgagnantbenin.bj" style="display:inline-block;margin-top:24px;padding:11px 28px;background:#008751;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:13px">Retour au site</a>
    </div>
    <div style="display:flex;height:6px"><div style="flex:1;background:#008751"></div><div style="flex:1;background:#FCD116"></div><div style="flex:1;background:#E8112D"></div></div>
  </div>
</body></html>`
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// GET /api/newsletter/unsubscribe?token=UUID
export async function GET(request: NextRequest) {
    const token = new URL(request.url).searchParams.get('token')
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
        return page('Lien invalide', "Ce lien de désinscription n'est pas valide. Contactez-nous si besoin.", false)
    }
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .select('email')
        .maybeSingle()

    if (error || !data) {
        return page('Lien introuvable', "Aucun abonnement ne correspond à ce lien (peut-être déjà désinscrit).", false)
    }
    return page(
        'Désinscription confirmée',
        `L'adresse <strong>${data.email}</strong> ne recevra plus nos communications. Vous pouvez vous réabonner à tout moment depuis notre site.`,
        true,
    )
}
