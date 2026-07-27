import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import Groq from 'groq-sdk'
import { getGroqApiKey } from '@/lib/groq'
import { guardPublic, AI_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const apiKey = getGroqApiKey()
const groq = apiKey ? new Groq({ apiKey }) : null

interface SlotInfo {
    key: string
    label: string
    required: boolean
    ancestral: boolean
}

// ─── Récupère la config SMTP depuis la DB ─────────────────────────────────────
async function getSmtp(): Promise<Record<string, string>> {
    const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
            'smtp_from_email', 'smtp_from_name', 'contact_email',
            'contact_phone', 'contact_address', 'hero_title',
        ])
    const s: Record<string, string> = {}
    for (const row of data || []) s[row.key] = row.value
    return s
}

// ─── Envoi d'email SMTP ───────────────────────────────────────────────────────
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

// ─── Email HTML wrapper ───────────────────────────────────────────────────────
function wrapHtml(smtp: Record<string, string>, ref: string, body: string, baseUrl: string) {
    const siteName = smtp.hero_title || 'Retour Gagnant Bénin'
    const logoUrl = `${baseUrl}/logo.jpg`
    return `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:650px;margin:0 auto;background:#fff;border:1px solid #d4d4d4;">
        <div style="background:linear-gradient(135deg,#006b40,#008751);padding:28px 40px;text-align:center;">
            <img src="${logoUrl}" alt="${siteName}" width="56" height="56" style="border-radius:12px;border:3px solid rgba(255,255,255,.4);margin-bottom:10px;object-fit:cover;" />
            <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">${siteName}</h1>
            <p style="color:#FCD116;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:5px 0 0;font-weight:600;">Service de Reconnaissance de Nationalité</p>
        </div>
        <div style="background:#f0fdf6;padding:14px 40px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Dossier N°</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#008751;font-family:monospace;letter-spacing:3px;">${ref}</p>
        </div>
        <div style="padding:32px 40px;color:#1a1a1a;font-size:14px;line-height:1.85;text-align:justify;">${body}</div>
        <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1a1a1a;">Nous contacter</p>
            <p style="margin:0;font-size:12px;color:#4b5563;">
                <a href="mailto:${smtp.contact_email || smtp.smtp_from_email}" style="color:#008751;text-decoration:none;">${smtp.contact_email || smtp.smtp_from_email || ''}</a>
                ${smtp.contact_phone ? ' · ' + smtp.contact_phone : ''}
            </p>
        </div>
        <div style="padding:14px 40px;background:#0d1117;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:11px;">&copy; ${new Date().getFullYear()} ${siteName} — <a href="${baseUrl}" style="color:#008751;text-decoration:none;">${baseUrl.replace('https://','')}</a></p>
        </div>
    </div>`
}

// ─── POST /api/nationality/analyze ───────────────────────────────────────────
export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'nationality/analyze', AI_LIMIT)
    if (trop) return trop

    try {
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        const body = await request.json()
        const { ref, email, prenom, nom, uploaded_keys, all_slots } = body as {
            ref: string
            email: string
            prenom: string
            nom: string
            uploaded_keys: string[]
            all_slots: SlotInfo[]
        }

        if (!ref || !email || !all_slots) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // ── Pièces réellement présentes : on lit la VÉRITÉ en base
        //    (documents_uploaded), pas le tableau transitoire du client.
        //    - une ligne « (upload échoué) » ne compte PAS comme présente ;
        //    - la clé = préfixe avant le 1er « : » (ex. livret_parents).
        //    Robuste pour tous les cas : fraîche, reprise complète, reprise
        //    « documents seuls » (fusion serveur), upload partiellement échoué.
        const { data: appRow } = await supabase
            .from('nationality_applications')
            .select('documents_uploaded')
            .eq('application_ref', ref)
            .maybeSingle()

        const presentKeys = new Set<string>()
        const dbDocs: string[] = Array.isArray(appRow?.documents_uploaded) ? appRow!.documents_uploaded : []
        for (const line of dbDocs) {
            if (typeof line !== 'string' || line.includes('upload échoué')) continue
            const k = line.split(':')[0].trim()
            if (/^[a-z0-9_]+$/i.test(k)) presentKeys.add(k)
        }
        // Filet : si la base n'a encore rien (race), on retombe sur les clés
        // client — mais uniquement en dernier recours.
        if (presentKeys.size === 0 && Array.isArray(uploaded_keys)) {
            for (const k of uploaded_keys) if (typeof k === 'string') presentKeys.add(k)
        }

        // Identifier les slots manquants (réellement absents en base)
        const missingSlots = all_slots.filter(s => !presentKeys.has(s.key))
        const missingRequired = missingSlots.filter(s => s.required)
        const missingOptional = missingSlots.filter(s => !s.required)
        const missingAncestral = missingSlots.filter(s => s.ancestral)
        const needsRechercheAncestrale = missingAncestral.length > 0

        // Deadline : 7 semaines à partir de maintenant
        const deadline = new Date()
        deadline.setDate(deadline.getDate() + 7 * 7)
        const deadlineStr = deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

        // Mettre à jour la DB avec les infos de docs manquants
        await supabase
            .from('nationality_applications')
            .update({
                docs_deadline: deadline.toISOString(),
                missing_docs: missingSlots.map(s => ({ key: s.key, label: s.label, required: s.required, ancestral: s.ancestral })),
                needs_recherche_ancestrale: needsRechercheAncestrale,
            })
            .eq('application_ref', ref)

        // Si aucun doc manquant → pas d'email nécessaire
        if (missingSlots.length === 0) {
            return NextResponse.json({ success: true, missing: 0 })
        }

        // Générer le corps de l'email via Groq
        const smtp = await getSmtp()
        let emailBody = ''

        const missingListHtml = [
            ...missingRequired.map(s => `<li style="color:#dc2626;"><strong>${s.label}</strong> <em>(obligatoire)</em></li>`),
            ...missingOptional.filter(s => !s.ancestral).map(s => `<li>${s.label}</li>`),
            ...missingAncestral.map(s => `<li style="color:#d97706;">${s.label} <em>(document ancestral)</em></li>`),
        ].join('')

        const ancestralSection = needsRechercheAncestrale ? `
            <div style="margin:24px 0;padding:18px 22px;background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">Notre service Recherche Ancestrale peut vous aider</p>
                <p style="margin:0 0 12px;font-size:13px;color:#78350f;line-height:1.7;">
                    Retrouver les actes de naissance ou de décès de vos arrière-grands-parents peut s'avérer complexe, surtout pour des ascendants issus de la traite transatlantique. Notre équipe dispose des outils et partenariats pour effectuer cette recherche à votre place.
                </p>
                <p style="margin:0 0 12px;font-size:13px;color:#78350f;"><strong>Investissement : 250 €</strong> — recherche complète dans les archives, bases de données & associations spécialisées.</p>
                <a href="${baseUrl}/nationalite/complement-ancestral?ref=${ref}" style="display:inline-block;background:#008751;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;">
                    Déléguer ma Recherche Ancestrale →
                </a>
            </div>` : ''

        if (groq) {
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: `Tu es le rédacteur institutionnel de "Retour Gagnant Bénin". Rédige un email formel et bienveillant notifiant le demandeur que son dossier a été bien reçu, mais que certaines pièces sont manquantes. Tu dois être clair sur le délai de 7 semaines, rassurant, et encourageant. Format HTML, corps du message uniquement (balises <p>, <strong>, <ul>). Aucun emoji. Ton solennel mais chaleureux.`
                        },
                        {
                            role: 'user',
                            content: `Demandeur : ${prenom} ${nom} — Référence : ${ref} — Deadline : ${deadlineStr}. Pièces manquantes : ${missingSlots.map(s => s.label).join(', ')}. ${needsRechercheAncestrale ? 'Des documents ancestraux sont manquants. Mentionne brièvement notre service Recherche Ancestrale.' : ''} Rédige le corps de l'email.`
                        }
                    ],
                    model: 'mixtral-8x7b-32768',
                    temperature: 0.3,
                })
                emailBody = completion.choices[0]?.message?.content || ''
            } catch {
                // fallback ci-dessous
            }
        }

        if (!emailBody) {
            emailBody = `
                <p>Cher(e) ${prenom} ${nom},</p>
                <p>Nous avons bien enregistré votre demande de reconnaissance de la nationalité béninoise sous la référence <strong>${ref}</strong>.</p>
                <p>Après examen de votre dossier, nous constatons que les pièces suivantes sont manquantes ou n'ont pas encore été transmises :</p>
                <ul style="padding-left:20px;line-height:2;">${missingListHtml}</ul>
                <p>Nous vous invitons à nous faire parvenir ces documents <strong>avant le ${deadlineStr}</strong> afin que votre dossier puisse être instruit dans les meilleures conditions.</p>
                <p>Passé ce délai, votre dossier pourrait être suspendu dans l'attente de leur réception.</p>
            `
        }

        // Injecter la liste des docs manquants et la section ancestrale
        emailBody += `
            <div style="margin:20px 0;padding:16px 20px;background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:0 8px 8px 0;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;">Récapitulatif des pièces manquantes :</p>
                <ul style="margin:0;padding-left:18px;font-size:13px;color:#4b5563;line-height:2;">${missingListHtml}</ul>
                <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;"><strong>Deadline :</strong> ${deadlineStr}</p>
            </div>
            ${ancestralSection}
            <p>Pour toute question, n'hésitez pas à nous contacter. Nous restons à votre disposition.</p>
            <p>Très respectueusement,<br>L'équipe Retour Gagnant Bénin</p>
        `

        const html = wrapHtml(smtp, ref, emailBody, baseUrl)
        await sendMail(smtp, email, `Documents manquants — Dossier N° ${ref} (délai : ${deadlineStr})`, html)

        return NextResponse.json({
            success: true,
            missing: missingSlots.length,
            missing_required: missingRequired.length,
            missing_ancestral: missingAncestral.length,
            needs_recherche_ancestrale: needsRechercheAncestrale,
            deadline: deadline.toISOString(),
        })
    } catch (error) {
        console.error('[ANALYZE] Erreur:', error)
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
}
