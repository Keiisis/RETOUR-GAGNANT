import { NextResponse } from 'next/server'

/* ══════════════════════════════════════════════════════════════
   /.well-known/assetlinks.json

   Pendant Android du fichier Apple. Les `intentFilters` de app.json
   portent `autoVerify: true` : au premier lancement, Android vient
   lire cette adresse et n'ouvre les liens dans l'app QUE si elle
   répond avec l'empreinte du certificat de signature. Elle répondait
   404, donc la vérification échouait — et le retour de paiement
   `/mobile-payment` s'ouvrait dans le navigateur au lieu de rendre la
   main à l'application.

   ANDROID_CERT_SHA256 : empreinte SHA-256 du certificat de signature
   de PRODUCTION, en majuscules séparées par des deux-points. On
   l'obtient avec `eas credentials` (plateforme Android → production),
   ou dans la Play Console → Intégrité de l'app → signature de l'app.

   ⚠ Si Google signe l'app pour vous (Play App Signing, le cas par
   défaut), c'est l'empreinte du certificat de SIGNATURE DE L'APP
   qu'il faut, pas celle du certificat d'importation. Mettre les deux
   est autorisé et évite l'erreur : ANDROID_CERT_SHA256 accepte une
   liste séparée par des virgules.
   ══════════════════════════════════════════════════════════════ */

const PACKAGE_NAME = 'bj.retourgagnantbenin.app'

export const dynamic = 'force-dynamic'

export async function GET() {
    const brut = process.env.ANDROID_CERT_SHA256
    if (!brut) {
        return NextResponse.json(
            { error: 'ANDROID_CERT_SHA256 non configuré' },
            { status: 503 },
        )
    }

    const empreintes = brut
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)

    return new NextResponse(
        JSON.stringify([
            {
                relation: [
                    'delegate_permission/common.handle_all_urls',
                    /* Permet aussi au gestionnaire de mots de passe Google de
                       partager les identifiants entre le site et l'app. */
                    'delegate_permission/common.get_login_creds',
                ],
                target: {
                    namespace: 'android_app',
                    package_name: PACKAGE_NAME,
                    sha256_cert_fingerprints: empreintes,
                },
            },
        ]),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
            },
        },
    )
}
