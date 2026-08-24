import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { eraseByEmail } from '@/lib/rgpd/erase'
import { getMobileUserId } from '@/lib/mobile-auth'
import { empreinteCodeSuppression } from '@/lib/suppression-compte'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ══════════════════════════════════════════════════════════════
// POST /api/mobile/account/delete
//
// Suppression de compte DEPUIS L'APPLICATION, sans passer par un
// lien e-mail : Apple (directive 5.1.1(v)) et Google exigent que la
// suppression puisse être menée à son terme dans l'app dès lors que
// celle-ci permet de créer un compte. Le parcours web par jeton
// (/api/rgpd/request → /api/rgpd/delete) reste en place pour les
// personnes qui n'ont pas de compte, ou plus accès à l'app.
//
// Deux différences avec le parcours web, et elles comptent :
//   1. l'identité vient du JETON de session (Bearer), pas d'un e-mail
//      saisi : rien à vérifier par courriel, l'utilisateur est déjà
//      authentifié ;
//   2. le compte d'AUTHENTIFICATION est supprimé, pas seulement les
//      données. `eraseByEmail` anonymise `client_profiles` mais laisse
//      l'utilisateur Supabase intact — il pourrait donc encore se
//      connecter, ce qui ne serait pas une suppression de compte.
//
// Irréversible et volontairement sans confirmation serveur : la
// confirmation est demandée dans l'app avant l'appel.
// ══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const userId = await getMobileUserId(request)
    if (!userId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    /* ── Code reçu par e-mail ──────────────────────────────────
       Le jeton de session prouve qu'on est connecté ; il ne prouve pas que
       le titulaire décide. Un téléphone déverrouillé et posé sur une table
       suffirait à détruire un dossier constitué pendant des mois. Le code
       prouve le contrôle de la boîte du compte. */
    const corps = await request.json().catch(() => ({}))
    const code = String(corps?.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Code à six chiffres requis.' }, { status: 400 })
    }

    const { data: ligne } = await admin
        .from('account_deletion_codes')
        .select('id, code_hash, expires_at, attempts')
        .eq('user_id', userId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!ligne) {
        return NextResponse.json({ error: 'Aucun code en cours. Demandez-en un nouveau.' }, { status: 400 })
    }
    if (new Date(String(ligne.expires_at)).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Code expiré. Demandez-en un nouveau.' }, { status: 400 })
    }
    if (Number(ligne.attempts || 0) >= 3) {
        return NextResponse.json({ error: 'Trop d’essais. Demandez un nouveau code.' }, { status: 429 })
    }

    if (empreinteCodeSuppression(code) !== String(ligne.code_hash)) {
        /* L'essai raté est compté AVANT de répondre : sans ce compteur, six
           chiffres se devinent par force brute en quelques minutes. */
        await admin
            .from('account_deletion_codes')
            .update({ attempts: Number(ligne.attempts || 0) + 1 })
            .eq('id', ligne.id)
        return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 })
    }

    // Consommé : il ne servira plus, quoi qu'il arrive ensuite.
    await admin
        .from('account_deletion_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', ligne.id)

    // L'e-mail sert de clé d'effacement dans toutes les tables métier.
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
    const email = userData?.user?.email || ''
    if (userErr || !email) {
        return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }

    // 1. Données métier : suppression ou anonymisation selon la table
    //    (mêmes règles que le parcours RGPD web, une seule source).
    const report = await eraseByEmail(admin, email)

    // 2. Compte d'authentification. Sans cette étape, la personne
    //    resterait capable de se connecter à un compte « supprimé ».
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
        return NextResponse.json(
            { error: "La suppression du compte a échoué. Vos données n'ont pas été entièrement effacées, réessayez.", report },
            { status: 500 },
        )
    }

    // 3. Preuve de traitement, sans conserver l'e-mail ailleurs que
    //    dans le journal de sécurité (obligation de traçabilité RGPD).
    try {
        await admin.from('security_logs').insert({
            action: 'rgpd_erasure_self',
            details: { email, report, at: new Date().toISOString(), source: 'mobile-app' },
        })
    } catch { /* table optionnelle */ }

    return NextResponse.json({ success: true, report })
}
