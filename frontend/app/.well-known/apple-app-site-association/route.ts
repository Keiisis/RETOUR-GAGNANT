import { NextResponse } from 'next/server'

/* ══════════════════════════════════════════════════════════════
   /.well-known/apple-app-site-association

   Sans ce fichier, `associatedDomains` déclaré dans app.json ne sert
   à rien : iOS interroge cette adresse à l'installation de l'app, et
   tant qu'elle répond 404 (c'était le cas), tout lien https ouvre
   Safari au lieu de l'application.

   Trois règles imposées par Apple, faciles à rater :
     · servi en `application/json` SANS extension .json dans l'URL ;
     · accessible en HTTPS, sans redirection ;
     · le fichier ne doit PAS être signé (ancien format abandonné).

   APPLE_TEAM_ID doit valoir l'identifiant d'équipe à 10 caractères
   (App Store Connect → Membership). Tant qu'il est absent, la route
   répond 503 plutôt que de publier un fichier invalide qu'iOS
   mettrait en cache.
   ══════════════════════════════════════════════════════════════ */

const BUNDLE_ID = 'bj.retourgagnantbenin.app'

/* Chemins réellement gérés par l'app (voir `linking.config` dans
   mobile/App.tsx) + le retour de paiement. Tout le reste doit rester
   au navigateur : capter des URL que l'app ne sait pas afficher
   donnerait un écran vide. */
const PATHS = [
    '/mobile-payment',
    '/mobile-payment/*',
    '/main',
    '/main/*',
    '/service/*',
    '/payments',
    'NOT /admin/*',
    'NOT /agent/*',
    'NOT /client/*',
    'NOT /api/*',
]

export const dynamic = 'force-dynamic'

export async function GET() {
    const teamId = process.env.APPLE_TEAM_ID
    if (!teamId) {
        return NextResponse.json(
            { error: 'APPLE_TEAM_ID non configuré' },
            { status: 503 },
        )
    }

    const appID = `${teamId}.${BUNDLE_ID}`

    return new NextResponse(
        JSON.stringify({
            applinks: {
                apps: [],
                details: [{ appID, appIDs: [appID], paths: PATHS }],
            },
            webcredentials: {
                /* Autorise le trousseau iOS à proposer le mot de passe du
                   site dans l'app, et inversement : c'est ce qui rend
                   `textContentType="password"` réellement utile. */
                apps: [appID],
            },
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
            },
        },
    )
}
