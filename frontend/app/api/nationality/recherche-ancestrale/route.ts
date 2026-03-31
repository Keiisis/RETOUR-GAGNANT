import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// POST /api/nationality/recherche-ancestrale
// Enregistre le paiement Recherche Ancestrale lié à un dossier nationalité
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { ref, payment_provider, payment_tx_id, amount, amount_xof } = body

        if (!ref) return NextResponse.json({ error: 'Référence manquante' }, { status: 400 })

        // Générer une référence pour ce service de recherche
        const searchRef = `RG-ANC-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

        // Récupérer les infos du demandeur
        const { data: app, error: fetchErr } = await supabase
            .from('nationality_applications')
            .select('email, prenom, nom, missing_docs')
            .eq('application_ref', ref)
            .single()

        if (fetchErr || !app) {
            return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
        }

        // Mettre à jour le dossier nationalité
        await supabase
            .from('nationality_applications')
            .update({
                recherche_ancestrale_paid: true,
                recherche_ancestrale_ref: searchRef,
                needs_recherche_ancestrale: false, // plus besoin de relances ancestrales
            })
            .eq('application_ref', ref)

        // Créer un suivi dossier pour la recherche ancestrale
        await supabase.from('dossier_tracking').insert({
            num_dossier: searchRef,
            client_nom: app.nom,
            client_prenom: app.prenom,
            client_email: app.email.toLowerCase(),
            service_type: 'Recherche Ancestrale',
            service: 'recherche-ancestrale',
            statut: 'reception',
            etapes: [
                { id: 1, label: 'Paiement reçu', status: 'completed', date: new Date().toISOString().split('T')[0], note: `Lié au dossier nationalité ${ref}` },
                { id: 2, label: 'Consultation des archives', status: 'pending', date: null, note: '' },
                { id: 3, label: 'Recherche dans les bases de données', status: 'pending', date: null, note: '' },
                { id: 4, label: 'Contact associations spécialisées', status: 'pending', date: null, note: '' },
                { id: 5, label: 'Compilation des résultats', status: 'pending', date: null, note: '' },
                { id: 6, label: 'Transmission au dossier nationalité', status: 'pending', date: null, note: '' },
            ],
            progression: Math.round((1 / 6) * 100),
            notes_internes: `Recherche Ancestrale déclenchée depuis le dossier nationalité ${ref}.\nMontant: ${amount} EUR (${amount_xof} XOF)\nPaiement: ${payment_provider} — TX: ${payment_tx_id}`,
        })

        // Créer un message admin
        await supabase.from('messages').insert([{
            nom: `${app.prenom} ${app.nom}`,
            email: app.email,
            sujet: `Recherche Ancestrale commandée — Dossier ${ref}`,
            message: `${app.prenom} ${app.nom} a commandé le service Recherche Ancestrale.\n\nDossier nationalité : ${ref}\nRéférence recherche : ${searchRef}\nMontant payé : ${amount} EUR (${amount_xof} XOF)\nProvider : ${payment_provider} — TX: ${payment_tx_id}\n\nDocuments ancestraux à retrouver :\n${(app.missing_docs || []).filter((d: { ancestral: boolean; label: string }) => d.ancestral).map((d: { label: string }) => `• ${d.label}`).join('\n')}`,
            type: 'recherche-ancestrale',
            lu: false,
        }])

        // Envoyer email de confirmation au client
        const { data: smtpData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'hero_title'])

        const smtp: Record<string, string> = {}
        for (const s of smtpData || []) smtp[s.key] = s.value

        if (smtp.smtp_host && smtp.smtp_user && smtp.smtp_pass) {
            const siteName = smtp.hero_title || 'Retour Gagnant Bénin'
            const transporter = nodemailer.createTransport({
                host: smtp.smtp_host,
                port: Number(smtp.smtp_port) || 465,
                secure: Number(smtp.smtp_port) === 465,
                auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
            })
            await transporter.sendMail({
                from: `"${smtp.smtp_from_name || siteName}" <${smtp.smtp_from_email || smtp.smtp_user}>`,
                to: app.email,
                subject: `Recherche Ancestrale confirmée — Référence ${searchRef}`,
                html: `
                <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:650px;margin:0 auto;background:#fff;border:1px solid #d4d4d4;">
                    <div style="background:linear-gradient(135deg,#006b40,#008751);padding:26px 40px;text-align:center;">
                        <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">${siteName}</h1>
                        <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:5px 0 0;">Service Recherche Ancestrale</p>
                    </div>
                    <div style="background:#f0fdf6;padding:14px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
                        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Référence Recherche</p>
                        <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:3px;">${searchRef}</p>
                    </div>
                    <div style="padding:32px 40px;color:#1a1a1a;font-size:14px;line-height:1.85;">
                        <p>Cher(e) ${app.prenom} ${app.nom},</p>
                        <p>Nous confirmons la bonne réception de votre paiement pour le service <strong>Recherche Ancestrale</strong>, rattaché à votre dossier de nationalité béninoise <strong>${ref}</strong>.</p>
                        <p>Notre équipe va immédiatement mobiliser ses ressources — archives officielles, bases de données spécialisées et associations partenaires — pour retrouver les actes de vos ancêtres.</p>
                        <p>Vous recevrez les résultats de nos recherches dès qu'ils seront disponibles. Ces documents seront directement intégrés à votre dossier de nationalité.</p>
                        <div style="margin:20px 0;padding:14px 20px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                            <p style="margin:0;font-size:12px;color:#6b7280;">Référence dossier nationalité : <strong style="color:#1a1a1a;">${ref}</strong></p>
                            <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Référence recherche ancestrale : <strong style="color:#008751;">${searchRef}</strong></p>
                        </div>
                        <p>Suivez l'avancement de votre recherche depuis votre espace de suivi.</p>
                        <div style="text-align:center;margin:24px 0;">
                            <a href="${SITE_URL}/suivi-dossier" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:13px;">Suivre ma Recherche Ancestrale</a>
                        </div>
                        <p>Très respectueusement,<br>L'équipe Retour Gagnant Bénin</p>
                    </div>
                    <div style="padding:14px 40px;background:#0d1117;text-align:center;">
                        <p style="margin:0;color:#6b7280;font-size:11px;">&copy; ${new Date().getFullYear()} ${siteName}</p>
                    </div>
                </div>`,
            })
        }

        return NextResponse.json({ success: true, search_ref: searchRef })
    } catch (error) {
        console.error('[RECHERCHE-ANCESTRALE] Erreur:', error)
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
}
