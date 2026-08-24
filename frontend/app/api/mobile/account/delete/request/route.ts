import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'
import { getMobileUserId } from '@/lib/mobile-auth'
import { sendEmail } from '@/lib/email'
import { empreinteCodeSuppression, VALIDITE_CODE_MINUTES } from '@/lib/suppression-compte'

/* ═══════════════════════════════════════════════════════════
   POST /api/mobile/account/delete/request
   Envoie par e-mail un code à six chiffres qui autorisera l'effacement.

   Deux confirmations dans l'application ne prouvent rien : un téléphone
   déverrouillé et posé sur une table suffirait à détruire un dossier
   constitué pendant des mois. Le code prouve que la personne contrôle la
   boîte du compte — la même preuve qu'à l'inscription, en sens inverse.

   Le code n'est jamais stocké en clair : seule son empreinte SHA-256 est
   conservée, et il expire au bout de dix minutes.
   ═══════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const VALIDITE_MINUTES = VALIDITE_CODE_MINUTES

function corpsEmail(code: string, prenom: string): string {
    return `
<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#3C3C3C">
  <div style="height:6px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
  <div style="padding:28px 24px">
    <p style="font-size:15px;line-height:22px;margin:0 0 16px">Bonjour${prenom ? ' ' + prenom : ''},</p>
    <p style="font-size:15px;line-height:22px;margin:0 0 20px">
      Vous avez demandé la <strong>suppression définitive</strong> de votre compte Retour Gagnant Bénin
      depuis l'application mobile. Saisissez ce code pour confirmer :
    </p>
    <p style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#008751;text-align:center;margin:24px 0">
      ${code}
    </p>
    <p style="font-size:13px;line-height:20px;color:#505050;margin:0 0 18px">
      Ce code expire dans ${VALIDITE_MINUTES} minutes et ne sert qu'une fois.
    </p>
    <p style="font-size:14px;line-height:21px;margin:0 0 8px">
      <strong>Ce que la suppression efface :</strong> votre compte, vos dossiers, vos documents
      et votre historique. Vos pièces comptables sont anonymisées, comme la loi l'exige,
      et vous ne pourrez plus vous connecter.
    </p>
    <p style="font-size:13px;line-height:20px;color:#B31E28;margin:18px 0 0">
      Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne sera
      supprimé, et changez votre mot de passe par précaution.
    </p>
  </div>
</div>`
}

export async function POST(request: NextRequest) {
    const userId = await getMobileUserId(request)
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: userData } = await admin.auth.admin.getUserById(userId)
    const email = (userData?.user?.email || '').toLowerCase().trim()
    if (!email) return NextResponse.json({ error: 'Compte sans adresse e-mail.' }, { status: 400 })

    const { data: profil } = await admin
        .from('client_profiles')
        .select('prenom')
        .eq('id', userId)
        .maybeSingle()

    /* `randomInt` du module crypto, pas `Math.random` : un code de sécurité
       ne se tire pas avec un générateur prévisible. */
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const expiration = new Date(Date.now() + VALIDITE_MINUTES * 60_000).toISOString()

    /* Les codes précédents de ce compte sont neutralisés : un seul code
       valable à la fois, sinon un ancien e-mail resterait exploitable. */
    await admin
        .from('account_deletion_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('used_at', null)

    const { error } = await admin.from('account_deletion_codes').insert({
        user_id: userId,
        email,
        code_hash: empreinteCodeSuppression(code),
        expires_at: expiration,
    })
    if (error) {
        console.error('[account/delete/request]', error.message)
        return NextResponse.json({ error: 'Envoi impossible pour le moment.' }, { status: 500 })
    }

    const envoi = await sendEmail({
        to: email,
        subject: 'Code de suppression de votre compte',
        html: corpsEmail(code, String(profil?.prenom || '')),
        context: 'suppression_compte',
    })
    if (!envoi.success) {
        return NextResponse.json({ error: "L'e-mail n'a pas pu partir. Réessayez." }, { status: 502 })
    }

    /* L'adresse est renvoyée partiellement masquée : l'écran peut dire OÙ le
       code est parti sans exposer l'adresse complète sur un téléphone
       éventuellement partagé. */
    const [avant, apres] = email.split('@')
    const masque = `${avant.slice(0, 2)}${'•'.repeat(Math.max(avant.length - 2, 1))}@${apres}`

    return NextResponse.json({ success: true, email: masque, validiteMinutes: VALIDITE_MINUTES })
}
