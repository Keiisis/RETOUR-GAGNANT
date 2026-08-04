import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import Groq from 'groq-sdk'
import { requireStaff } from '@/lib/api-guard'
import { generateFicheAnalysePdf, type FicheAnalyseData, type FichePiece } from '@/lib/fiche-analyse-pdf'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

const groqKeys = [
    process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6,
].filter(Boolean) as string[]

const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])

// Pièces attendues d'un dossier de nationalité + mots-clés de reconnaissance.
const REQUIRED = [
    { doc: 'Acte de naissance (Client)', keys: ['acte de naissance', 'naissance', 'birth'] },
    { doc: "Passeport / Pièce d'identité", keys: ['passeport', 'passport', 'identite', 'cni', 'carte'] },
    { doc: 'Casier judiciaire', keys: ['casier', 'judiciaire'] },
    { doc: 'Justificatif de domicile', keys: ['domicile', 'facture', 'residence'] },
    { doc: 'Preuve de profession', keys: ['profession', 'emploi', 'travail', 'employeur'] },
    { doc: "Actes d'état civil des parents", keys: ['parent', 'pere', 'père', 'mere', 'mère'] },
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface AppRow {
    id: string; nom: string; prenom: string; genre?: string; email: string | null
    documents_uploaded: string[] | null; application_ref: string
}

// Analyse automatique : compare les pièces requises aux pièces déposées et
// détecte les formats « photo » (non conformes). Renvoie une FicheAnalyseData.
function buildAutoFiche(app: AppRow): FicheAnalyseData {
    const uploaded = (app.documents_uploaded || []).map(line => {
        const idx = line.indexOf(': ')
        if (idx === -1) return null
        const label = line.slice(0, idx).trim()
        const path = line.slice(idx + 2).trim()
        const ext = (path.split('.').pop() || '').toLowerCase()
        return { label, ext, isImage: IMG_EXT.has(ext) }
    }).filter((x): x is { label: string; ext: string; isImage: boolean } => !!x && x.label.length > 0)

    const pieces: FichePiece[] = []
    let hasPhoto = false
    for (const req of REQUIRED) {
        const match = uploaded.find(u => req.keys.some(k => norm(u.label).includes(norm(k))))
        if (!match) {
            pieces.push({ document: req.doc, statut: 'Manquant', motif: 'Pièce manquante à fournir au format PDF.' })
        } else if (match.isImage) {
            hasPhoto = true
            pieces.push({ document: req.doc, statut: 'Format Photo', motif: 'Non conforme. À transmettre obligatoirement au format PDF.' })
        }
        // pièce présente et déjà en PDF → conforme, non listée
    }

    const missing = pieces.filter(p => p.statut === 'Manquant')
    const civ = (app.genre || '').toLowerCase().startsWith('f') ? 'Mme' : 'M.'
    const clientName = `${app.prenom || ''} ${app.nom || ''}`.trim().toUpperCase() || 'Client'
    const base = {
        clientName, civilite: civ,
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        gestionnaire: 'Pôle Instruction RGB',
    }

    // Est-ce un dossier bloqué UNIQUEMENT sur la généalogie (aucun problème de
    // format) ? Alors on propose l'option payante recherche généalogique (250 €).
    const parentsMissing = missing.some(p => norm(p.document).includes('parent'))
    const genealogieMode = !hasPhoto && parentsMissing

    if (genealogieMode) {
        // Fiche « dossier incomplet » — inventaire d'état civil + 2 options.
        const GENEALOGY = [
            { document: "Extrait d'acte de naissance", filiation: 'Titulaire du dossier (Client)' },
            { document: "Extrait d'acte de naissance", filiation: "Père de l'intéressé" },
            { document: "Extrait d'acte de naissance", filiation: "Mère de l'intéressé" },
            { document: "Extraits d'acte de naissance", filiation: 'Grands-parents paternels (grand-père & grand-mère)' },
            { document: "Extraits d'acte de naissance", filiation: 'Grands-parents maternels (grand-père & grand-mère)' },
        ]
        return {
            ...base,
            objet: "Preuve d'Afro-descendance",
            statutBadge: 'DOSSIER INCOMPLET',
            formatWarning: null,
            diagnostic: "Constat de vérification : après étude attentive des pièces fournies, le dossier présente une absence des actes d'état civil requis pour constituer la filiation ascendante nécessaire à l'établissement formel de la preuve d'afro-descendance.",
            piecesTitle: 'INVENTAIRE DES PIÈCES MANQUANTES',
            piecesColMode: 'filiation' as const,
            pieces: GENEALOGY.map(g => ({ document: g.document, filiation: g.filiation, statut: 'Manquant', motif: g.filiation })),
            nextStepsTitle: 'MODALITÉS DE RÉGULARISATION',
            nextStepsIntro: "Pour permettre le traitement et la validation finale de votre dossier, deux options s'offrent à vous :",
            nextStepsBoxes: [
                { title: 'Option 1 — Transmission directe', body: "Vous rassemblez par vos propres moyens l'ensemble des extraits d'acte de naissance listés ci-dessus et nous les transmettez directement dans les meilleurs délais.", tone: 'blue' as const },
                { title: 'Option 2 — Accompagnement RGB', body: "Si vous rencontrez des difficultés à obtenir ces documents, RGB propose de réaliser la recherche généalogique complète pour vous. Forfait Recherche Généalogique : 250 €.", tone: 'yellow' as const },
            ],
            finalNote: "Merci de bien vouloir informer l'équipe RGB de l'option retenue (fourniture directe des pièces ou souscription au service de recherche généalogique à 250 €) afin de poursuivre l'instruction de votre dossier.",
        }
    }

    // Fiche « conformité » — non-conformités de format / pièces manquantes + RDV.
    const diagParts: string[] = ['Après vérification des pièces transmises, votre dossier ne peut être validé en l\'état.']
    if (hasPhoto) diagParts.push('Certains documents ont été fournis au format photo, non exploitable par nos services : ils doivent être transmis en PDF officiel.')
    if (missing.length > 0) diagParts.push('Plusieurs pièces indispensables à la preuve d\'afro-descendance sont manquantes.')

    return {
        ...base,
        objet: "Preuve d'Afro-descendance & Conformité",
        statutBadge: hasPhoto ? 'NON CONFORME - ACTION REQUISE' : (missing.length > 0 ? 'DOSSIER INCOMPLET' : 'DOSSIER A VERIFIER'),
        formatWarning: hasPhoto
            ? 'Exigence impérative de format : tout document transmis en mode « photo » n\'est pas utilisable. Chaque pièce doit être fournie au format PDF officiel.'
            : null,
        diagnostic: diagParts.join(' '),
        piecesTitle: 'DÉTAIL DES PIÈCES À RÉGULARISER',
        piecesColMode: 'motif' as const,
        pieces: pieces.length > 0 ? pieces : [{ document: 'Dossier', statut: 'À vérifier', motif: 'Aucune non-conformité automatique détectée.' }],
        nextStepsTitle: 'PROCHAINES ÉTAPES & RENDEZ-VOUS',
        nextStepsIntro: 'Afin de vous accompagner dans la mise en conformité de votre dossier :',
        nextStepsBoxes: [{
            title: 'Proposition d\'échange téléphonique',
            body: 'Nous vous suggérons d\'organiser un rendez-vous téléphonique selon vos disponibilités afin de passer en revue ces éléments et de vous guider pour la régularisation.',
            tone: 'blue',
        }],
    }
}

// Email intelligent rédigé par l'IA (Groq). Repli sur un gabarit si indispo.
async function writeEmail(app: AppRow, fiche: FicheAnalyseData): Promise<{ subject: string; body: string }> {
    const civ = fiche.civilite || 'M./Mme'
    const nom = app.nom || fiche.clientName
    const issues = fiche.pieces.map(p => `- ${p.document} : ${p.statut}`).join('\n')
    const fallback = {
        subject: `Votre dossier de nationalité — pièces à régulariser (${app.application_ref})`,
        body: `Bonjour ${civ} ${nom},\n\nAprès l'analyse de votre dossier de demande de nationalité béninoise, quelques pièces doivent être régularisées pour poursuivre l'instruction. Vous trouverez le détail complet dans la fiche d'analyse jointe (PDF).\n\nPièces concernées :\n${issues}\n\nNotre équipe reste à votre entière disposition pour vous accompagner. N'hésitez pas à répondre à cet e-mail ou à demander un rendez-vous téléphonique.\n\nCordialement,\nPôle Instruction — Retour Gagnant Bénin`,
    }
    if (groqKeys.length === 0) return fallback
    try {
        const groq = new Groq({ apiKey: groqKeys[Math.floor(Math.random() * groqKeys.length)] })
        const prompt = `Tu es conseiller au Pôle Instruction de "Retour Gagnant Bénin" (accompagnement à la nationalité béninoise).
Rédige un e-mail EN FRANÇAIS, chaleureux, professionnel, clair et rassurant, adressé à ${civ} ${nom}, pour l'informer que quelques pièces de son dossier doivent être régularisées. Une fiche d'analyse PDF est jointe.
Pièces concernées :
${issues}

Contraintes : ton bienveillant et pro, 120-160 mots, pas de jargon, invite à répondre ou à demander un rendez-vous téléphonique, signe "Pôle Instruction — Retour Gagnant Bénin". Réponds STRICTEMENT en JSON : {"subject": "...", "body": "..."} (body en texte simple avec sauts de ligne \\n).`
        const c = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            temperature: 0.6,
        })
        const j = JSON.parse(c.choices[0].message.content || '{}')
        if (j.subject && j.body) return { subject: String(j.subject), body: String(j.body) }
        return fallback
    } catch {
        return fallback
    }
}

async function sendMail(to: string, subject: string, textBody: string, pdfBase64: string, filename: string) {
    const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', [
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name',
    ])
    const s: Record<string, string> = {}
    for (const row of settingsData || []) s[row.key] = row.value
    if (!s.smtp_host) throw new Error('Configuration SMTP manquante (admin).')

    const transporter = nodemailer.createTransport({
        host: s.smtp_host,
        port: Number(s.smtp_port) || 465,
        secure: Number(s.smtp_port) === 465,
        auth: { user: s.smtp_user, pass: s.smtp_pass },
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    })
    const from = `"${s.smtp_from_name || 'Retour Gagnant Bénin'}" <${s.smtp_from_email || s.smtp_user}>`
    const html = textBody.split('\n').map(l => l.trim() ? `<p style="margin:0 0 10px 0;color:#3C3C3C;font-family:Arial,sans-serif;font-size:14px;line-height:20px;">${l}</p>` : '<br/>').join('')

    await transporter.sendMail({
        from, to, subject,
        text: textBody,
        html: `<div style="max-width:600px;margin:0 auto;">${html}</div>`,
        attachments: [{ filename, content: Buffer.from(pdfBase64, 'base64'), contentType: 'application/pdf' }],
    })
}

// POST /api/admin/nationalite/[id]/fiche-analyse
// { action:'preview'|'send', mode:'auto'|'manual', data?:FicheAnalyseData, email?:{subject,body} }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action === 'send' ? 'send' : 'preview'
    const mode = body.mode === 'manual' ? 'manual' : 'auto'

    const { data: app, error } = await supabase
        .from('nationality_applications')
        .select('id, nom, prenom, genre, email, documents_uploaded, application_ref')
        .eq('id', id)
        .maybeSingle()
    if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    const a = app as AppRow

    // Données de la fiche : calculées (auto) ou fournies par l'admin (manuel/send).
    const fiche: FicheAnalyseData = (mode === 'manual' || action === 'send') && body.data
        ? (body.data as FicheAnalyseData)
        : buildAutoFiche(a)

    let pdfBase64: string
    try {
        pdfBase64 = generateFicheAnalysePdf(fiche)
    } catch (e) {
        return NextResponse.json({ error: 'Erreur de génération du PDF : ' + (e instanceof Error ? e.message : '') }, { status: 500 })
    }
    const filename = `Fiche-Analyse-${(a.nom || 'client').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    if (action === 'preview') {
        const email = await writeEmail(a, fiche)
        return NextResponse.json({ success: true, pdfBase64, email, fiche, filename })
    }

    // action === 'send'
    if (!a.email) return NextResponse.json({ error: 'Ce dossier n\'a pas d\'adresse e-mail client.' }, { status: 400 })
    const email = body.email?.subject && body.email?.body
        ? { subject: String(body.email.subject), body: String(body.email.body) }
        : await writeEmail(a, fiche)
    try {
        await sendMail(a.email, email.subject, email.body, pdfBase64, filename)
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Envoi impossible' }, { status: 502 })
    }
    return NextResponse.json({ success: true, sentTo: a.email })
}
