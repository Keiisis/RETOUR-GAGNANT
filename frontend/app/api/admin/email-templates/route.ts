import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// Templates par défaut à insérer si la table est vide
const DEFAULT_TEMPLATES = [
    {
        name: 'Confirmation de commande',
        slug: 'order_confirmation',
        subject: 'Retour Gagnant : Confirmation de votre commande #{{ref}}',
        html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Confirmation Commande</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#003d22,#008751);padding:32px;text-align:center">
    <h1 style="color:#FCD116;margin:0;font-size:28px">Retour Gagnant</h1>
    <p style="color:#fff;margin:8px 0 0">Votre partenaire vers le Bénin</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#1a1a1a">Bonjour {{prenom}} {{nom}},</h2>
    <p style="color:#555;line-height:1.6">Votre commande <strong>#{{ref}}</strong> a bien été confirmée. Notre équipe la traite dans les meilleurs délais.</p>
    <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0">
      <p style="margin:0;color:#888;font-size:14px">Référence de commande</p>
      <p style="margin:4px 0 0;color:#1a1a1a;font-size:20px;font-weight:bold">#{{ref}}</p>
    </div>
    <p style="color:#555;line-height:1.6">En cas de question, contactez-nous à <a href="mailto:contact@retourgagnantbenin.bj" style="color:#008751">contact@retourgagnantbenin.bj</a>.</p>
  </div>
  <div style="background:#f4f4f4;padding:20px;text-align:center">
    <p style="margin:0;color:#888;font-size:12px">© Retour Gagnant Bénin : Haie Vive, Cotonou</p>
  </div>
</div>
</body>
</html>`,
        variables: ['prenom', 'nom', 'ref'],
    },
    {
        name: 'Réponse à un Lead Oracle',
        slug: 'agent_reply',
        subject: 'Retour Gagnant : Suite à votre simulation',
        html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Réponse Lead</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#003d22,#008751);padding:32px;text-align:center">
    <h1 style="color:#FCD116;margin:0;font-size:28px">Retour Gagnant</h1>
    <p style="color:#fff;margin:8px 0 0">L'Oracle a parlé</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#1a1a1a">Bonjour {{prenom}},</h2>
    <p style="color:#555;line-height:1.6">{{message}}</p>
    <div style="border-left:4px solid #FCD116;padding-left:16px;margin:24px 0">
      <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Service recommandé</p>
      <p style="margin:4px 0 0;color:#1a1a1a;font-size:16px;font-weight:bold">{{service}}</p>
    </div>
  </div>
  <div style="background:#f4f4f4;padding:20px;text-align:center">
    <p style="margin:0;color:#888;font-size:12px">© Retour Gagnant Bénin : Haie Vive, Cotonou</p>
  </div>
</div>
</body>
</html>`,
        variables: ['prenom', 'message', 'service'],
    },
    {
        name: 'Notification de rendez-vous',
        slug: 'appointment_confirmation',
        subject: 'Retour Gagnant : Confirmation de votre rendez-vous',
        html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rendez-vous confirmé</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#003d22,#008751);padding:32px;text-align:center">
    <h1 style="color:#FCD116;margin:0;font-size:28px">Retour Gagnant</h1>
  </div>
  <div style="padding:32px">
    <h2 style="color:#1a1a1a">Bonjour {{prenom}} {{nom}},</h2>
    <p style="color:#555;line-height:1.6">Votre rendez-vous a été confirmé. Voici les détails :</p>
    <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#888;padding:8px 0;font-size:14px">Date</td><td style="color:#1a1a1a;font-weight:bold;padding:8px 0">{{date}}</td></tr>
        <tr><td style="color:#888;padding:8px 0;font-size:14px">Heure</td><td style="color:#1a1a1a;font-weight:bold;padding:8px 0">{{heure}}</td></tr>
        <tr><td style="color:#888;padding:8px 0;font-size:14px">Service</td><td style="color:#1a1a1a;font-weight:bold;padding:8px 0">{{service}}</td></tr>
      </table>
    </div>
  </div>
  <div style="background:#f4f4f4;padding:20px;text-align:center">
    <p style="margin:0;color:#888;font-size:12px">© Retour Gagnant Bénin : Haie Vive, Cotonou</p>
  </div>
</div>
</body>
</html>`,
        variables: ['prenom', 'nom', 'date', 'heure', 'service'],
    },
    {
        name: 'Bienvenue nouvel utilisateur',
        slug: 'welcome',
        subject: 'Bienvenue dans la famille Retour Gagnant !',
        html_body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Bienvenue</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#003d22,#008751);padding:48px 32px;text-align:center">
    <h1 style="color:#FCD116;margin:0;font-size:36px">Retour Gagnant</h1>
    <p style="color:#fff;margin:8px 0 0;font-size:16px">Bienvenue à bord 🇧🇯</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1a1a1a">Bienvenue {{prenom}} !</h2>
    <p style="color:#555;line-height:1.6">Nous sommes ravis de vous accueillir. Votre compte a été créé avec succès.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="https://www.retourgagnantbenin.bj" style="background:#008751;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Accéder à la plateforme</a>
    </div>
  </div>
  <div style="background:#f4f4f4;padding:20px;text-align:center">
    <p style="margin:0;color:#888;font-size:12px">© Retour Gagnant Bénin : Haie Vive, Cotonou</p>
  </div>
</div>
</body>
</html>`,
        variables: ['prenom'],
    },
]

// GET /api/admin/email-templates : liste tous les templates (avec seed si vide)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()

        let { data, error } = await supabase
            .from('email_templates')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Seed si table vide
        if (!data || data.length === 0) {
            const now = new Date().toISOString()
            const { error: insertErr } = await supabase.from('email_templates').insert(
                DEFAULT_TEMPLATES.map(t => ({ ...t, created_at: now, updated_at: now }))
            )
            if (!insertErr) {
                const { data: refreshed } = await supabase
                    .from('email_templates')
                    .select('*')
                    .order('created_at', { ascending: true })
                data = refreshed
            }
        }

        return NextResponse.json({ templates: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/admin/email-templates : créer un nouveau template
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { name, slug, subject, html_body, variables } = body

        if (!name || !slug || !subject || !html_body) {
            return NextResponse.json({ error: 'name, slug, subject et html_body sont obligatoires' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const { data, error } = await supabase
            .from('email_templates')
            .insert({
                name: name.trim(),
                slug: slug.trim().toLowerCase().replace(/\s+/g, '_'),
                subject: subject.trim(),
                html_body,
                variables: variables || [],
                created_at: now,
                updated_at: now,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ template: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
