import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

// Destinataire partenaire SIMAU (les leads lui sont transmis).
const SIMAU_EMAIL = process.env.SIMAU_LEAD_EMAIL || 'info@simaubenin.com'

const esc = (s: unknown) => String(s ?? '').replace(/[<>]/g, '')

// POST /api/logements/lead : capture d'un lead + transmission à SIMAU + notif admin.
export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'logement-lead', EMAIL_LIMIT)
    if (trop) return trop

    const body = await request.json().catch(() => ({}))
    const nom = String(body.nom || '').trim()
    const email = String(body.email || '').trim()
    const telephone = String(body.telephone || '').trim()
    if (!nom || (!email && !telephone)) {
        return NextResponse.json({ error: 'Nom et un moyen de contact (email ou téléphone) requis.' }, { status: 400 })
    }

    const lead = {
        logement_id: body.logement_id || null,
        logement_nom: body.logement_nom || null,
        programme: body.programme || null,
        nom,
        prenom: String(body.prenom || '').trim() || null,
        email: email || null,
        telephone: telephone || null,
        pays_residence: String(body.pays_residence || '').trim() || null,
        diaspora: !!body.diaspora,
        formule_souhaitee: String(body.formule_souhaitee || '').trim() || null,
        eligibilite: body.eligibilite ?? null,
        message: String(body.message || '').trim() || null,
        statut: 'nouveau',
    }

    const { data: saved, error } = await supabase.from('logement_leads').insert(lead).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Transmission à SIMAU + copie interne (SMTP settings) ──
    let transmis = false
    try {
        const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'contact_email',
        ])
        const s: Record<string, string> = {}
        for (const row of settingsData || []) s[row.key] = row.value

        if (s.smtp_host) {
            const transporter = nodemailer.createTransport({
                host: s.smtp_host, port: Number(s.smtp_port) || 465, secure: Number(s.smtp_port) === 465,
                auth: { user: s.smtp_user, pass: s.smtp_pass },
                tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
            })
            const from = `"${s.smtp_from_name || 'Retour Gagnant Bénin'}" <${s.smtp_from_email || s.smtp_user}>`
            const rows = [
                ['Logement', lead.logement_nom], ['Programme', lead.programme],
                ['Nom', `${lead.prenom || ''} ${lead.nom}`.trim()], ['Email', lead.email], ['Téléphone', lead.telephone],
                ['Pays de résidence', lead.pays_residence], ['Diaspora', lead.diaspora ? 'Oui' : 'Non'],
                ['Formule souhaitée', lead.formule_souhaitee], ['Message', lead.message],
            ].filter(([, v]) => v)
            const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#3C3C3C;">
                <div style="height:6px;background:linear-gradient(90deg,#008751 46%,#FCD116 46% 73%,#E8112D 73%);border-radius:6px;"></div>
                <h2 style="color:#008751;">Nouveau prospect logement (Programme national)</h2>
                <p>Transmis par Retour Gagnant Bénin : accompagnement à la composition du dossier.</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                ${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#8A8A8A;width:170px;">${esc(k)}</td><td style="padding:6px 0;font-weight:bold;">${esc(v)}</td></tr>`).join('')}
                </table>
            </div>`
            const to = [SIMAU_EMAIL, s.contact_email || s.smtp_from_email || s.smtp_user].filter(Boolean).join(', ')
            await transporter.sendMail({ from, to, subject: `Nouveau prospect logement : ${lead.prenom || ''} ${lead.nom}`.trim(), html })
            transmis = true
            await supabase.from('logement_leads').update({ transmis_simau: true, statut: 'transmis' }).eq('id', saved.id)
        }
    } catch (e) {
        console.error('[logement-lead] transmission email échouée:', e)
        // Le lead est enregistré même si l'email échoue.
    }

    return NextResponse.json({ success: true, transmis })
}
