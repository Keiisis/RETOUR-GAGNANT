import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { signMyafroToken } from '@/lib/nationality-token'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// GET /api/admin/documents — liste des dossiers MyAfroOrigins en attente de revue.
export async function GET() {
    const { data, error } = await supabase
        .from('nationality_applications')
        .select('*')
        .eq('status', 'revue_myafro')
        .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ applications: data || [] })
}

// POST /api/admin/documents — actions :
//   { action: 'invite', email, name }     → email d'invitation au client (lien 50 €)
//   { action: 'link', paid: boolean, invoice_id?: string }                    → génère juste le lien (copier/coller)
//   { action: 'approve', id }             → bascule le dossier vers la file Nationalité
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const paid = !!body.paid
    const invoiceId = body.invoice_id ? String(body.invoice_id) : undefined

    if (action === 'link') {
        const token = signMyafroToken(60, paid, invoiceId)
        return NextResponse.json({ success: true, link: `${SITE}/nationalite/formulaire?myafro=${encodeURIComponent(token)}` })
    }

    if (action === 'invite') {
        const email = String(body.email || '').trim().toLowerCase()
        const name = String(body.name || '').trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
        }
        const token = signMyafroToken(60, paid, invoiceId)
        const link = `${SITE}/nationalite/formulaire?myafro=${encodeURIComponent(token)}`
        const civil = name || 'Cher(e) client(e)'
        const html = `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
            <div style="background:linear-gradient(135deg,#006b40,#008751);padding:30px 40px;text-align:center;">
                <img src="${SITE}/logo.jpg" alt="Retour Gagnant Bénin" width="60" height="60" style="border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
                <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Retour Gagnant Bénin</h1>
                <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Reprise de dossier de nationalité</p>
            </div>
            <div style="padding:36px 40px;color:#1f2937;font-size:15px;line-height:1.85;">
                <p>${civil},</p>
                <p>Votre dossier de reconnaissance de la nationalité béninoise est resté sans suite sur la plateforme où vous l'aviez initié. Nous pouvons le reprendre et le mener à son terme.</p>
                <p>Pour cela, nous vous invitons à renseigner notre formulaire sécurisé et à y déposer l'ensemble des informations et pièces que vous aviez fournies. Vous pourrez ajouter autant de documents que nécessaire, et nommer librement chaque pièce.</p>
                <p style="background:#f0fdf6;border-left:4px solid #008751;padding:14px 18px;border-radius:6px;color:#065f46;">
                    <strong>Frais de reprise : 50 €</strong> (au lieu du tarif habituel). Ce montant couvre l'instruction complète de votre dossier par notre service juridique.
                </p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${link}" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:15px 42px;border-radius:10px;font-weight:700;font-size:15px;">Reprendre mon dossier</a>
                    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">Lien personnel et confidentiel — à n'utiliser que par vos soins.</p>
                </div>
                <p>Nos équipes restent à votre entière disposition. C'est une démarche importante, et nous sommes honorés de la mener à vos côtés.</p>
                <p style="margin-top:26px;">Avec tout notre dévouement,<br><strong>L'équipe Retour Gagnant Bénin</strong></p>
            </div>
            <div style="padding:18px 40px;background:#0d1117;text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.6;">
                    &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — Tous droits réservés<br>
                    <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
                </p>
            </div>
        </div>`
        const res = await sendEmail({ to: email, subject: 'Reprenez votre dossier de nationalité béninoise', html, context: 'myafro_invite' })
        if (!res.success) return NextResponse.json({ error: res.error || 'Envoi impossible' }, { status: 500 })
        return NextResponse.json({ success: true, sentTo: email, link })
    }

    if (action === 'approve') {
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
        const { data, error } = await supabase
            .from('nationality_applications')
            .update({ status: 'soumis' })
            .eq('id', id)
            .eq('status', 'revue_myafro')
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, application: data })
    }

    if (action === 'relance_ancestrale') {
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
        const { data: app, error: fetchError } = await supabase
            .from('nationality_applications')
            .select('application_ref, email, prenom, nom')
            .eq('id', id)
            .single()
        
        if (fetchError || !app) {
            return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
        }

        const link = `${SITE}/nationalite/complement-ancestral?ref=${app.application_ref}`
        const civil = `${app.prenom} ${app.nom}`
        
        const html = `
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;">
            <div style="background:linear-gradient(135deg,#006b40,#008751);padding:30px 40px;text-align:center;">
                <img src="${SITE}/logo.jpg" alt="Retour Gagnant Bénin" width="60" height="60" style="border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
                <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Retour Gagnant Bénin</h1>
                <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:6px 0 0;font-weight:600;">Recherche Ancestrale & Généalogique</p>
            </div>
            <div style="padding:36px 40px;color:#1f2937;font-size:15px;line-height:1.85;">
                <p>Cher(e) ${civil},</p>
                <p>Nous avons bien reçu vos documents pour la reprise de votre dossier de nationalité béninoise.</p>
                <p>Après analyse de vos pièces par notre service juridique, l'établissement formel de votre filiation nécessite le lancement d'une <strong>Recherche Ancestrale Approfondie</strong> dans les archives locales du Bénin.</p>
                <p>Cette recherche permettra de certifier le lien historique indispensable à l'octroi de votre certificat de nationalité sous la législation en vigueur.</p>
                <p style="background:#f9fafb;border-left:4px solid #FCD116;padding:14px 18px;border-radius:6px;">
                    <strong>Frais de recherche ancestrale : 250 €</strong>. Ce montant couvre les recherches d'archives, l'authentification généalogique et l'intégration des preuves à votre dossier de nationalité.
                </p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${link}" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:15px 42px;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 10px rgba(0,107,64,0.25);">Régler les frais de recherche</a>
                </div>
                <p>Nos équipes restent à votre entière disposition sur WhatsApp au <strong>+229 01 94 35 50 50</strong> pour toute question.</p>
                <p style="margin-top:26px;">Avec tout notre dévouement,<br><strong>L'équipe Retour Gagnant Bénin</strong></p>
            </div>
            <div style="padding:18px 40px;background:#0d1117;text-align:center;">
                <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.6;">
                    &copy; ${new Date().getFullYear()} Retour Gagnant Bénin — Tous droits réservés<br>
                    <a href="${SITE}" style="color:#008751;text-decoration:none;">${SITE.replace('https://', '')}</a>
                </p>
            </div>
        </div>`

        const emailRes = await sendEmail({ to: app.email, subject: 'Action requise : Lancement de votre Recherche Ancestrale (250 €)', html, context: 'recherche_ancestrale_invite' })
        if (!emailRes.success) return NextResponse.json({ error: emailRes.error || 'Envoi impossible' }, { status: 500 })

        // Update application state
        await supabase
            .from('nationality_applications')
            .update({ needs_recherche_ancestrale: true })
            .eq('id', id)

        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
