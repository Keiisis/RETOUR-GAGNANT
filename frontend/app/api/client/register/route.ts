import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { validateStrongPassword } from '@/lib/password'
import { guardPublic, EMAIL_LIMIT } from '@/lib/api-guard'
import { buildConfirmEmail } from '@/lib/emails/confirm-email'

// Service role — bypass RLS pour créer le profil, lier les documents
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'client/register', EMAIL_LIMIT)
    if (trop) return trop

    try {
        const body = await req.json()
        const { email, password, nom, prenom, phone, pays, ville } = body

        if (!email || !password) {
            return NextResponse.json({ error: 'email et mot de passe requis' }, { status: 400 })
        }

        // Validation sécurité mot de passe (serveur — ne jamais faire confiance au client seul)
        const pwdErrors = validateStrongPassword(password)
        if (pwdErrors.length > 0) {
            return NextResponse.json({ error: `Mot de passe insuffisant : ${pwdErrors.join(', ')}` }, { status: 400 })
        }

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

        // 1. Créer le compte (non confirmé) + générer le lien de confirmation
        //    generateLink crée l'utilisateur ET retourne un hashed_token qu'on utilise
        //    dans notre propre endpoint /api/auth/verify-email — aucune dépendance
        //    envers la configuration "Site URL" de Supabase Dashboard.
        const { data: linkData, error: createError } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email: email.toLowerCase().trim(),
            password,
            options: {
                data: { nom: nom || '', prenom: prenom || '', phone: phone || '' },
                redirectTo: siteUrl, // requis mais ignoré — on utilise notre propre URL
            },
        })

        if (createError) {
            // "User already registered" → compte déjà existant
            if (createError.message.toLowerCase().includes('already registered')) {
                return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
            }
            throw new Error(`Erreur inscription: ${createError.message}`)
        }

        const user_id = linkData.user.id
        // hashed_token utilisé par notre endpoint /api/auth/verify-email (lien de secours)
        const token_hash = linkData.properties.hashed_token
        const confirmUrl = `${siteUrl}/api/auth/verify-email?token_hash=${encodeURIComponent(token_hash)}&type=signup`
        // Code à 8 chiffres saisi dans l'app mobile (vérifié via verifyOtp type 'signup')
        const emailOtp = linkData.properties.email_otp || ''

        let emailSent = false

        // 2. Envoyer l'email de confirmation via SMTP personnalisé
        try {
            const { data: settingsData } = await supabase.from('settings').select('key, value').in('key', [
                'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name'
            ])
            const settings: Record<string, string> = {}
            for (const s of settingsData || []) settings[s.key] = s.value

            if (settings.smtp_host) {
                const transporter = nodemailer.createTransport({
                    host: settings.smtp_host,
                    port: Number(settings.smtp_port) || 465,
                    secure: Number(settings.smtp_port) === 465,
                    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
                    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
                })

                const fromString = `"${settings.smtp_from_name || 'Retour Gagnant Bénin'}" <${settings.smtp_from_email || settings.smtp_user}>`

                // Email de confirmation « code d'abord » — le client saisit ce
                // code dans l'application mobile. Le lien reste en secours pour
                // ceux qui préfèrent confirmer depuis un navigateur.
                // Charte : blanc, accents drapeau (vert #008751), aucune autre couleur.
                const htmlContent = buildConfirmEmail({
                    prenom: prenom || nom || '',
                    code: emailOtp,
                    confirmUrl,
                })

                await transporter.sendMail({
                    from: fromString,
                    to: email,
                    subject: `Votre code de confirmation : ${emailOtp} — Retour Gagnant Bénin`,
                    html: htmlContent,
                })
                emailSent = true
            }
        } catch (mailErr) {
            console.error('Erreur envoi email confirmation :', mailErr)
            // On ne bloque pas l'inscription si l'email échoue — le compte est créé
        }

        // 3. Créer le profil client
        const { error: profileError } = await supabase
            .from('client_profiles')
            .upsert({
                id: user_id,
                email: email.toLowerCase().trim(),
                nom: nom || null,
                prenom: prenom || null,
                phone: phone || null,
                pays: pays || 'France',
                ville: ville || null,
            }, { onConflict: 'id' })

        if (profileError) {
            throw new Error(`Erreur création profil: ${profileError.message}`)
        }

        // 4. Lier les documents_financiers ayant le même client_email
        const { error: docError } = await supabase
            .from('documents_financiers')
            .update({ client_id: user_id })
            .eq('client_email', email.toLowerCase().trim())
            .is('client_id', null)

        if (docError) console.warn('Liaison documents:', docError.message)

        // 5. Lier les dossiers de suivi ayant le même client_email
        const { error: dossierError } = await supabase
            .from('dossier_tracking')
            .update({ client_id: user_id })
            .eq('client_email', email.toLowerCase().trim())
            .is('client_id', null)

        if (dossierError) console.warn('Liaison dossiers:', dossierError.message)

        // 6. Compter ce qui a été lié
        const { count: docsCount } = await supabase
            .from('documents_financiers')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', user_id)

        const { count: dossiersCount } = await supabase
            .from('dossier_tracking')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', user_id)

        return NextResponse.json({
            success: true,
            linked: {
                documents: docsCount || 0,
                dossiers: dossiersCount || 0,
            },
            needsEmailConfirm: true, // confirmation requise avant connexion
            emailSent,
        })

    } catch (err) {
        console.error('Erreur API client/register:', err)
        const message = err instanceof Error ? err.message : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
