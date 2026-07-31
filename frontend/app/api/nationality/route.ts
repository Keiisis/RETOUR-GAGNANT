import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import Groq from 'groq-sdk'
import { getGroqApiKey } from '@/lib/groq'
import { scanRequestBody } from '@/lib/waf'
import { notifyStaffNationalityPayment, sendNationalityPaymentReceipt } from '@/lib/nationality-payment-emails'
import { recordNationalityIncome } from '@/lib/nationality-income'
import { markClientConverted } from '@/lib/classement/track'
import { verifyMyafroToken, decodeMyafroToken } from '@/lib/nationality-token'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
// On préfère la clé Service Role côté serveur pour contourner les restrictions RLS (sécurité maximale)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Vérification serveur d'une transaction Kkiapay (anti-fraude) ──────────
async function verifyKkiapayTransaction(transactionId: string): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'

    if (!privateKey || !secretKey) return { ok: false, status: 'config_missing' }

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json()
        return { ok: data?.status === 'SUCCESS', status: data?.status || 'unknown', amount: data?.amount }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

const apiKey = getGroqApiKey()
const groq = apiKey ? new Groq({ apiKey }) : null

const sendConfirmationEmail = async (data: {
    nom: string
    prenom: string
    email: string
    nationalite: string
    refId: string
    baseUrl: string
}) => {
    try {
        let emailContent = ''

        if (groq) {
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: `Tu es le rédacteur institutionnel de "Retour Gagnant Bénin", la plateforme officielle de reconnaissance de la nationalité béninoise pour les afro-descendants. Ton rôle est de rédiger un email de confirmation de réception de dossier extrêmement formel, prestigieux, élégant et chaleureux. 
RÈGLES ABSOLUES :
1. AUCUN EMOJI. C'est strictement interdit.
2. Ton retour doit être au format HTML, uniquement la partie "corps du texte" (utilise des balises <p>, <strong>, <ul>... mais pas de <html> ni de <body>).
3. Adapte le discours à la personne (Nom, Nationalité d'origine).
4. Précise que le dossier est en cours de traitement par le service juridique et qu'ils peuvent suivre l'évolution via leur numéro de référence.
5. Sois solennel. C'est une démarche symbolique forte (le retour aux sources, la terre des ancêtres).`
                        },
                        {
                            role: 'user',
                            content: `Voici les informations du demandeur :\n- Nom complet : M/Mme ${data.prenom} ${data.nom}\n- Nationalité d'origine : ${data.nationalite}\n- Numéro de Référence : ${data.refId}\nRédige le corps de l'email de confirmation.`
                        }
                    ],
                    model: 'mixtral-8x7b-32768',
                    temperature: 0.3,
                })
                emailContent = completion.choices[0]?.message?.content || ''
            } catch (err) {
                console.error('[EMAIL] Erreur lors de la génération Groq, repli sur le texte par défaut.', err)
            }
        }

        // Fallback or Wrap inside a prestigious HTML container
        if (!emailContent) {
            emailContent = `
                <p>Cher(e) ${data.prenom} ${data.nom},</p>
                <p>Nous vous confirmons la bonne réception de votre demande de reconnaissance de la nationalité béninoise.</p>
                <p>Votre dossier porte la référence officielle : <strong>${data.refId}</strong>.</p>
                <p>Notre service juridique a d’ores et déjà entamé l’examen de vos pièces. Nous vous tiendrons informé(e) des prochaines étapes.</p>
                <p>La terre de vos ancêtres vous attend. Soyez le ou la bienvenu(e) au Bénin.</p>
                <p>Très respectueusement,<br>L'équipe Retour Gagnant Bénin</p>
            `
        }

        // 2. Fetch SMTP settings + agency info from DB
        const { data: settingsData } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', [
                'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
                'smtp_from_email', 'smtp_from_name', 'hero_title',
                'contact_email', 'contact_phone', 'contact_address'
            ])

        const settings: Record<string, string> = {}
        for (const s of settingsData || []) {
            settings[s.key] = s.value
        }

        const senderName = settings.smtp_from_name || 'Retour Gagnant Bénin'
        const siteName = settings.hero_title || 'Retour Gagnant Bénin'
        const logoUrl = `${data.baseUrl}/logo.jpg`
        const agencyEmail = settings.contact_email || settings.smtp_from_email || 'contact@retourgagnantbenin.bj'
        const agencyPhone = settings.contact_phone || ''
        const agencyAddress = settings.contact_address || 'Haie-Vive Cocotiers, Carré n°1158, Cotonou — République du Bénin'
        const trackingUrl = `${data.baseUrl}/suivi-dossier`

        // Email HTML professionnel avec infos agence complètes
        const htmlBody = `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d4d4d4;">

            <!-- EN-TETE AVEC LOGO ET NOM -->
            <div style="background: linear-gradient(135deg, #006b40, #008751); padding: 28px 40px; text-align: center;">
                <img src="${logoUrl}" alt="${siteName}" width="64" height="64" style="border-radius: 14px; object-fit: cover; border: 3px solid rgba(255,255,255,0.4); margin-bottom: 12px;" />
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 1px;">${siteName}</h1>
                <p style="color: #FCD116; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; margin: 6px 0 0 0; font-weight: 600;">Service de Reconnaissance de la Nationalite Beninoise</p>
            </div>

            <!-- REFERENCE DOSSIER -->
            <div style="background: #f0fdf6; padding: 16px 40px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Dossier N&deg;</p>
                <p style="margin: 4px 0 0; font-size: 22px; font-weight: 800; color: #008751; font-family: monospace; letter-spacing: 3px;">${data.refId}</p>
            </div>

            <!-- CORPS DU MESSAGE (Groq AI ou Fallback) -->
            <div style="padding: 36px 40px; color: #1a1a1a; font-size: 15px; line-height: 1.85; text-align: justify;">
                ${emailContent}
            </div>

            <!-- BOUTON SUIVI -->
            <div style="padding: 0 40px 32px; text-align: center;">
                <a href="${trackingUrl}" style="display: inline-block; background: #008751; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
                    Suivre l'avancement de mon dossier
                </a>
                <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af;">Utilisez votre reference ${data.refId} et votre email pour consulter l'etat de votre demande.</p>
            </div>

            <!-- INFORMATIONS DE L'AGENCE -->
            <div style="background: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #1a1a1a;">Nous contacter</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #4b5563;">
                    <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 80px; font-weight: 600; color: #6b7280;">Email</td>
                        <td style="padding: 4px 0;"><a href="mailto:${agencyEmail}" style="color: #008751; text-decoration: none;">${agencyEmail}</a></td>
                    </tr>
                    ${agencyPhone ? `<tr>
                        <td style="padding: 4px 0; vertical-align: top; font-weight: 600; color: #6b7280;">Tel.</td>
                        <td style="padding: 4px 0;">${agencyPhone}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="padding: 4px 0; vertical-align: top; font-weight: 600; color: #6b7280;">Adresse</td>
                        <td style="padding: 4px 0;">${agencyAddress}</td>
                    </tr>
                </table>
            </div>

            <!-- PIED DE PAGE -->
            <div style="padding: 16px 40px; background: #0d1117; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
                    &copy; ${new Date().getFullYear()} ${siteName}. Tous droits reserves.<br>
                    <a href="${data.baseUrl}" style="color: #008751; text-decoration: none;">${data.baseUrl.replace('https://', '')}</a>
                </p>
            </div>
        </div>`

        // Already fetched above, omitting re-fetch

        if (settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: Number(settings.smtp_port) || 465,
                secure: Number(settings.smtp_port) === 465,
                auth: {
                    user: settings.smtp_user,
                    pass: settings.smtp_pass
                }
            })

            const fromString = `"${senderName}" <${settings.smtp_from_email || settings.smtp_user}>`

            await transporter.sendMail({
                from: fromString,
                to: data.email,
                replyTo: settings.smtp_from_email || settings.smtp_user,
                subject: `Confirmation de reception - Dossier N° ${data.refId}`,
                html: htmlBody,
            })

            return true
        }

        console.log('[EMAIL] Mode simulation (SMTP non configuré) -> Envoi bloqué vers :', data.email)
        return false // On retourne false pour ne pas marquer "envoyé" s'il n'y a pas de vraie config SMTP
    } catch (error) {
        console.error('[EMAIL] Erreur fatale lors de l\'envoi via SMTP/Groq:', error)
        return false
    }
}

export async function POST(request: NextRequest) {
    try {
        const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'
        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any
        const { nom, prenom, email } = body

        if (!nom || !prenom || !email) {
            return NextResponse.json(
                { error: 'Nom, prénom et email sont requis' },
                { status: 400 }
            )
        }

        // ── Anti-fraude : vérification Kkiapay côté serveur si payment_ref fourni ──
        // Évite qu'un client envoie un faux transaction_id et obtienne un dossier
        // nationalité (150 000 FCFA) sans avoir vraiment payé.
        // Si payment_method = 'kkiapay' et payment_ref renseigné, on vérifie.
        // Fiche « filet webhook » à compléter (créée par /api/webhooks/kkiapay
        // AVANT que le formulaire n'aboutisse — marquée last_step_completed = 0).
        let stubToComplete: { id: string; application_ref: string } | null = null

        if (body.payment_method === 'kkiapay' && body.payment_ref) {
            // Idempotence : si une demande existe déjà avec ce payment_ref…
            const { data: existing } = await supabase
                .from('nationality_applications')
                .select('id, application_ref, last_step_completed')
                .eq('payment_ref', body.payment_ref)
                .maybeSingle()
            if (existing?.application_ref) {
                if (existing.last_step_completed === 0) {
                    // …fiche minimale créée par le webhook : on la COMPLÈTE avec les
                    // données du formulaire (paiement déjà vérifié par le webhook).
                    stubToComplete = { id: existing.id, application_ref: existing.application_ref }
                } else {
                    // …fiche complète : on la retourne telle quelle.
                    return NextResponse.json({
                        success: true,
                        reference: existing.application_ref,
                        message: 'Demande déjà enregistrée pour ce paiement.',
                    })
                }
            }

            // Vérification Kkiapay (inutile si le webhook a déjà validé la transaction)
            if (!stubToComplete) {
                const verify = await verifyKkiapayTransaction(body.payment_ref)
                if (!verify.ok) {
                    console.warn(`[nationality] Paiement Kkiapay non confirmé : ${verify.status}`)
                    return NextResponse.json(
                        { error: `Paiement non confirmé (${verify.status})` },
                        { status: 402 }
                    )
                }
            }
        }

        const ref = `RG-NAT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

        // ══════════════════════════════════════════════════════════════
        // WHITELIST: Only insert columns that exist in the DB table.
        // Using ...body caused PostgreSQL errors because the client
        // sends extra fields (documents, last_step_completed, etc.)
        // that don't exist as columns in nationality_applications.
        // ══════════════════════════════════════════════════════════════
        // ── Mode MyAfroOrigins : tarif réduit 50 € autorisé par jeton signé.
        //    Le montant est FIXÉ SERVEUR (jamais celui du client) et le dossier
        //    entre en file de revue documents (status 'revue_myafro') avant d'être
        //    approuvé vers la file nationalité standard.
        const myafroPayload = body.myafro_token ? decodeMyafroToken(String(body.myafro_token)) : null
        const isMyafro = !!myafroPayload
        const initialStatus = isMyafro ? 'revue_myafro' : 'soumis'
        const secureAmount = isMyafro ? 50 : (body.amount ?? 250)
        const secureCurrency = isMyafro ? 'EUR' : (body.currency || 'USD')

        const isPrepaid = myafroPayload?.paid ?? false
        const invoiceRef = myafroPayload?.invoice_id ? `facture_${myafroPayload.invoice_id}` : null

        const paymentStatus = isPrepaid ? 'payé' : (body.payment_ref ? 'payé' : 'en_attente')
        const paymentRef = isPrepaid ? (invoiceRef || 'manuel_prepaid') : (body.payment_ref || null)
        const paymentMethod = isPrepaid ? 'manuel' : (body.payment_method || null)

        const insertData: Record<string, unknown> = {
            application_ref: ref,
            status: initialStatus,
            submitted_at: new Date().toISOString(),
            // Identity
            nom,
            prenom,
            email,
            genre: body.genre || null,
            date_naissance: body.date_naissance || null,
            pays_naissance: body.pays_naissance || null,
            ville_naissance: body.ville_naissance || null,
            nationalite: body.nationalite || 'Non spécifiée',
            pays_residence: body.pays_residence || null,
            adresse_residence: body.adresse_residence || null,
            telephone: body.telephone || null,
            profession: body.profession || null,
            demande_depuis_benin: body.demande_depuis_benin ?? false,
            // Law
            knows_about_law: body.knows_about_law ?? false,
            is_afro_descendant: body.is_afro_descendant ?? null,
            afro_descendant_description: body.afro_descendant_description || body.motivation || '',
            // Ancestor 1
            ancestor1_nom: body.ancestor1_nom || null,
            ancestor1_prenom: body.ancestor1_prenom || null,
            ancestor1_date_naissance: body.ancestor1_date_naissance || null,
            ancestor1_lien_parente: body.ancestor1_lien_parente || null,
            ancestor1_vivant: body.ancestor1_vivant ?? null,
            ancestor1_nationalite: body.ancestor1_nationalite || null,
            ancestor1_pays_residence: body.ancestor1_pays_residence || null,
            ancestor1_autres_infos: body.ancestor1_autres_infos || null,
            // Ancestor 2
            ancestor2_nom: body.ancestor2_nom || null,
            ancestor2_prenom: body.ancestor2_prenom || null,
            ancestor2_date_naissance: body.ancestor2_date_naissance || null,
            ancestor2_lien_parente: body.ancestor2_lien_parente || null,
            ancestor2_vivant: body.ancestor2_vivant ?? null,
            ancestor2_nationalite: body.ancestor2_nationalite || null,
            ancestor2_pays_residence: body.ancestor2_pays_residence || null,
            ancestor2_autres_infos: body.ancestor2_autres_infos || null,
            // Document
            type_document_identite: body.type_document_identite || null,
            numero_document: body.numero_document || null,
            date_expiration_document: body.date_expiration_document || null,
            pays_delivrance: body.pays_delivrance || null,
            lieu_delivrance: body.lieu_delivrance || null,
            autorite_delivrance: body.autorite_delivrance || null,
            // Parents
            pere_nom: body.pere_nom || null,
            pere_prenom: body.pere_prenom || null,
            pere_date_naissance: body.pere_date_naissance || null,
            mere_nom: body.mere_nom || null,
            mere_prenom: body.mere_prenom || null,
            mere_date_naissance: body.mere_date_naissance || null,
            // Documents & Payment
            documents_uploaded: body.documents_uploaded || body.documents || [],
            amount: secureAmount,
            currency: secureCurrency,
            payment_status: paymentStatus,
            payment_ref: paymentRef,
            payment_method: paymentMethod,
            last_step_completed: body.last_step_completed ?? 6,
            admin_notes: isMyafro ? `[MYAFROORIGINS] Dossier bloqué sur MyAfroOrigins — reçu via le lien de complément (tarif 50 €).${isPrepaid ? ` Associé au paiement manuel de la facture ${invoiceRef || ''}.` : ''} À vérifier puis approuver vers la file Nationalité.` : null,
            // New fields
            situation_matrimoniale: body.situation_matrimoniale || null,
            nombre_enfants: body.nombre_enfants ?? 0,
            motivation_lettre: body.motivation_lettre || null,
            consentement_rgpd: body.consentement_rgpd ?? false,
            myafro_date: body.myafro_date || null,
        }

        // ── Complément d'une fiche « filet webhook » : UPDATE au lieu d'INSERT ──
        if (stubToComplete) {
            // On conserve application_ref, submitted_at et payment_* posés par le
            // webhook ; last_step_completed passe de 0 (stub) à 6 (complet).
            const {
                application_ref: _ref, submitted_at: _sub,
                payment_status: _pst, payment_ref: _pref,
                ...updateData
            } = insertData
            void _ref; void _sub; void _pst; void _pref

            let { error: updError } = await supabase
                .from('nationality_applications')
                .update(updateData)
                .eq('id', stubToComplete.id)
            // Filet : si la colonne myafro_date n'existe pas encore (migration
            // non appliquée), on réessaie sans elle — la soumission ne doit
            // JAMAIS échouer pour un champ optionnel.
            if (updError && updError.message?.includes('myafro_date')) {
                const { myafro_date: _md, ...withoutMyafro } = updateData as Record<string, unknown>
                void _md
                const retry = await supabase
                    .from('nationality_applications')
                    .update(withoutMyafro)
                    .eq('id', stubToComplete.id)
                updError = retry.error
            }
            if (updError) {
                console.error('Stub update error:', JSON.stringify(updError))
                return NextResponse.json({ error: `Erreur DB: ${updError.message}` }, { status: 500 })
            }

            // Aligne le suivi de dossier sur l'identité définitive du formulaire
            await supabase.from('dossier_tracking')
                .update({
                    client_nom: nom, client_prenom: prenom,
                    client_phone: body.telephone || '', client_whatsapp: body.telephone || '',
                })
                .eq('num_dossier', stubToComplete.application_ref)

            // Alerte paiement / reçu / Classement : DÉJÀ envoyés par le webhook.
            // On envoie uniquement la confirmation de réception du dossier complet.
            const emailSentStub = await sendConfirmationEmail({
                nom, prenom, email,
                nationalite: body.nationalite || 'Non spécifiée',
                refId: stubToComplete.application_ref,
                baseUrl,
            })

            return NextResponse.json({
                success: true,
                reference: stubToComplete.application_ref,
                emailSent: emailSentStub,
                message: 'Votre demande a été complétée avec succès.',
            })
        }

        let { error: insertError } = await supabase
            .from('nationality_applications')
            .insert([insertData])

        // Filet : colonne myafro_date absente (migration non appliquée) →
        // réessai sans elle, la soumission ne doit jamais échouer pour ça.
        if (insertError && insertError.message?.includes('myafro_date')) {
            const { myafro_date: _md, ...withoutMyafro } = insertData as Record<string, unknown>
            void _md
            const retry = await supabase.from('nationality_applications').insert([withoutMyafro])
            insertError = retry.error
        }

        if (insertError) {
            console.error('Insert error:', JSON.stringify(insertError))
            return NextResponse.json(
                { error: `Erreur DB: ${insertError.message}` },
                { status: 500 }
            )
        }

        // 2. Auto-create Nexus Tracker entry for this nationality dossier
        const nationalitySteps = [
            { id: 1, label: 'Réception du dossier', status: 'completed', date: new Date().toISOString().split('T')[0], note: 'Soumission en ligne' },
            { id: 2, label: 'Vérification des pièces justificatives', status: 'pending', date: null, note: '' },
            { id: 3, label: 'Contrôle de conformité juridique', status: 'pending', date: null, note: '' },
            { id: 4, label: 'Instruction du dossier (Ministère)', status: 'pending', date: null, note: '' },
            { id: 5, label: 'Commission de validation', status: 'pending', date: null, note: '' },
            { id: 6, label: 'Décision et notification', status: 'pending', date: null, note: '' },
            { id: 7, label: 'Délivrance du certificat', status: 'pending', date: null, note: '' },
        ]

        await supabase.from('dossier_tracking').insert({
            num_dossier: ref,
            client_nom: nom,
            client_prenom: prenom,
            client_email: email.toLowerCase(),
            client_whatsapp: body.telephone || '',
            client_phone: body.telephone || '',
            service_type: 'Reconnaissance de Nationalité',
            service: 'nationalite',
            statut: 'reception',
            etapes: nationalitySteps,
            progression: Math.round((1 / nationalitySteps.length) * 100),
            notes_internes: `Dossier créé automatiquement depuis le formulaire en ligne.\nMontant: ${body.amount || 250} ${body.currency || 'USD'}\nPaiement: ${body.payment_ref ? 'Payé (' + body.payment_ref + ')' : 'En attente'}`,
        }).then(({ error: trackError }) => {
            if (trackError) console.error('[TRACKER] Erreur création dossier_tracking:', trackError.message)
            else console.log(`[TRACKER] Dossier ${ref} créé dans le Nexus Tracker`)
        })

        // 3. Create message for admin/agents (only valid columns)
        await supabase.from('messages').insert([{
            nom: `${prenom} ${nom}`,
            email,
            telephone: body.telephone || null,
            sujet: `Demande de nationalité #${ref}`,
            message: `Nouvelle demande de nationalité béninoise.\n\nNom: ${prenom} ${nom}\nEmail: ${email}\nTéléphone: ${body.telephone || 'N/A'}\nRéférence: ${ref}\nMontant: ${body.amount || 250} ${body.currency || 'USD'}\n\nAfro-descendance: ${body.afro_descendant_description || 'Non précisée'}\n\nStatut Paiement: ${body.payment_ref ? 'Payé' : 'En attente'}`,
            type: 'nationality',
            lu: false,
        }])

        // 3b. Paiement confirmé → alerte équipe + reçu client + statut « Payé »
        //     au Classement. Fire-and-forget : ne bloque jamais la réponse.
        //     (Incident 2026-06 : paiements encaissés sans AUCUNE notification.)
        if (body.payment_ref) {
            const paymentInfo = {
                nom, prenom, email,
                telephone: body.telephone || null,
                refDossier: ref,
                amount: Number(body.amount ?? 250),
                currency: String(body.currency || 'USD'),
                paymentMethod: String(body.payment_method || 'en ligne'),
                paymentRef: String(body.payment_ref),
            }
            void notifyStaffNationalityPayment(paymentInfo)
            void sendNationalityPaymentReceipt(paymentInfo)

            /* ── Notification DANS l'application ──
               Le personnel recevait un courriel et le client son reçu, mais
               AUCUNE notification in-app n'était créée : l'écran Notifications
               du mobile lit la table `notifications`, qui restait vide après un
               dépôt de dossier. Le client payait, puis ne voyait rien.

               Même mécanisme que les rendez-vous : on résout l'utilisateur à
               partir de son adresse — le dépôt peut venir du site sans session
               mobile — puis on écrit la notification.

               Volontairement non bloquant : un dossier payé et enregistré ne
               doit jamais échouer parce qu'une notification n'est pas passée. */
            try {
                const { data: uid } = await supabase.rpc('resolve_client_user_id', {
                    p_client_id: null, p_email: email,
                })
                if (uid) {
                    await supabase.rpc('create_client_notification', {
                        p_user_id: uid,
                        p_title: 'Dossier de nationalité enregistré',
                        p_body: `Votre demande ${ref} a bien été reçue et votre paiement confirmé. `
                              + `Un conseiller la prend en charge et vous tiendra informé de son avancement.`,
                        p_type: 'dossier',
                    })
                }
            } catch (e) {
                console.warn('[nationality] notification in-app non créée :', e)
            }
            // Traçabilité comptable : facture (payée) dans facturation + comptabilité.
            // Le cas « facture manuelle sélectionnée » (isPrepaid) possède déjà sa
            // propre facture réelle → on ne double pas.
            if (!isPrepaid) {
                void recordNationalityIncome(supabase, {
                    ref, nom, prenom, email, phone: body.telephone || null,
                    amount: secureAmount, currency: secureCurrency,
                    paymentMethod: String(body.payment_method || 'en ligne'),
                    txId: String(body.payment_ref), isMyafro,
                })
            }
            void markClientConverted({
                email,
                full_name: `${prenom} ${nom}`.trim(),
                phone: body.telephone || null,
                serviceLabel: 'nationalite-vip',
                source: 'nationalite',
            })
        }

        // 3. Send auto email to client
        const emailSent = await sendConfirmationEmail({
            nom,
            prenom,
            email,
            nationalite: body.nationalite || 'Non spécifiée',
            refId: ref,
            baseUrl,
        })

        return NextResponse.json({
            success: true,
            reference: ref,
            emailSent,
            message: 'Votre demande a été reçue avec succès.',
        })
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Nationality API error:', errMsg)
        return NextResponse.json(
            { error: 'Une erreur est survenue lors du traitement. Veuillez réessayer.' },
            { status: 500 }
        )
    }
}
