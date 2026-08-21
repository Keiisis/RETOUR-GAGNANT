/* ═══════════════════════════════════════════════════════════
   Le billet en IMAGE et en PDF, rendus côté serveur.

   POURQUOI CÔTÉ SERVEUR. Les boutons « Télécharger l'image » et « Imprimer »
   de la page HTML ne font rien dans l'application : une WebView React Native
   n'a pas de gestionnaire de téléchargement, et `window.print()` n'y existe
   pas. Le bouton natif, lui, ne partageait qu'une URL — donc un lien, pas un
   billet. Un fichier réel doit venir de quelque part : il vient d'ici.

   POURQUOI PAS `sharp` + SVG (première tentative, ABANDONNÉE).
   `sharp` rastérise le texte SVG avec les polices du SYSTÈME. Une fonction
   serverless Vercel n'en embarque AUCUNE : le billet produit sortait avec
   chaque lettre remplacée par un carré vide (□□□□), QR intact et texte
   illisible. Un contrôle statistique ne l'avait pas vu — les carrés sont des
   pixels comme les autres ; il a fallu regarder l'image.

   CE QU'ON UTILISE À LA PLACE. `next/og` (Satori + resvg, déjà fourni par
   Next.js) rend une image à partir de polices qu'on lui DONNE explicitement.
   Les deux graisses d'Inter vivent dans `public/fonts/` : le rendu ne dépend
   donc plus de ce que l'hôte a installé. `jspdf` pose ensuite cette image sur
   une page A4.

   ⚠️ Satori ne comprend qu'un sous-ensemble de CSS : `display:flex` partout
   (jamais `block`), pas de `gap` sur certains axes, pas de position absolue
   complexe. Toute évolution doit rester dans ce sous-ensemble.
═══════════════════════════════════════════════════════════ */
import fs from 'node:fs'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { jsPDF } from 'jspdf'

export interface DonneesBillet {
    ticket_code: string
    full_name: string
    email: string
    phone: string
    ticket_type: string
    event_title: string
    event_date: string
    event_location: string
    /** PNG du QR, en data URI. */
    qr_uri: string
}

const VERT = '#008751'
const JAUNE = '#FCD116'
const ROUGE = '#E8112D'
const ENCRE = '#17201C'
const GRIS = '#8A8A8A'
const NUIT = '#111A15'

const L = 720
const H = 1120

/** Chargées une seule fois par instance : un fichier de 330 Ko ne se relit pas
 *  à chaque billet. `public/` est déployé avec la fonction. */
let policesCache: Array<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' }> | null = null

function polices() {
    if (policesCache) return policesCache
    const dossier = path.join(process.cwd(), 'assets', 'fonts')
    policesCache = [
        { name: 'Inter', data: fs.readFileSync(path.join(dossier, 'Inter-Regular.ttf')), weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: fs.readFileSync(path.join(dossier, 'Inter-Bold.ttf')), weight: 700 as const, style: 'normal' as const },
    ]
    return policesCache
}

/* Satori consomme une arborescence d'éléments. On l'écrit à la main plutôt
   qu'en JSX : ce fichier reste un `.ts`, sans étape de compilation à part. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const e = (type: string, props: Record<string, unknown>, ...enfants: any[]): any =>
    ({ type, props: { ...props, children: enfants.length === 1 ? enfants[0] : enfants } })

const microTitre = (texte: string) => e('div', {
    style: {
        display: 'flex', fontSize: 15, fontWeight: 700, letterSpacing: 3,
        color: GRIS, textTransform: 'uppercase', marginBottom: 6,
    },
}, texte)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function arbre(d: DonneesBillet): any {
    return e('div', {
        style: {
            display: 'flex', width: L, height: H, backgroundColor: '#FFFFFF',
            fontFamily: 'Inter',
        },
    },
        // Arête tricolore : signature de l'agence, en structure et non en ornement.
        e('div', { style: { display: 'flex', flexDirection: 'column', width: 18, height: H } },
            e('div', { style: { display: 'flex', backgroundColor: VERT, width: 18, height: Math.round(H * 0.42) } }),
            e('div', { style: { display: 'flex', backgroundColor: JAUNE, width: 18, height: Math.round(H * 0.16) } }),
            e('div', { style: { display: 'flex', backgroundColor: ROUGE, width: 18, height: Math.round(H * 0.14) } }),
        ),

        e('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, height: H } },
            // ── Corps ──
            e('div', { style: { display: 'flex', flexDirection: 'column', padding: '54px 56px 0 62px', flexGrow: 1 } },
                e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 46 } },
                    e('div', { style: { display: 'flex', fontSize: 18, fontWeight: 700, letterSpacing: 4, color: VERT } }, 'RETOUR GAGNANT BÉNIN'),
                    e('div', {
                        style: {
                            display: 'flex', border: `2px solid ${ENCRE}`, padding: '8px 20px',
                            fontSize: 17, fontWeight: 700, letterSpacing: 3, color: ENCRE,
                        },
                    }, d.ticket_type.toUpperCase()),
                ),

                microTitre('Au nom de'),
                e('div', { style: { display: 'flex', fontSize: 44, fontWeight: 700, color: ENCRE, marginBottom: 10 } }, d.full_name || 'Invité'),
                e('div', { style: { display: 'flex', fontSize: 23, color: GRIS } }, d.email),
                d.phone
                    ? e('div', { style: { display: 'flex', fontSize: 23, color: GRIS, marginTop: 4 } }, d.phone)
                    : e('div', { style: { display: 'flex' } }),

                e('div', { style: { display: 'flex', height: 2, backgroundColor: '#E4E4E4', margin: '38px 0' } }),

                microTitre('Événement'),
                e('div', { style: { display: 'flex', fontSize: 34, fontWeight: 700, color: ENCRE, marginBottom: 36, lineHeight: 1.2 } }, d.event_title),

                microTitre('Date'),
                e('div', { style: { display: 'flex', fontSize: 26, fontWeight: 700, color: ENCRE, marginBottom: 32 } }, d.event_date),

                microTitre('Lieu'),
                e('div', { style: { display: 'flex', fontSize: 26, fontWeight: 700, color: ENCRE } }, d.event_location),
            ),

            // ── Perforation : la souche se détache ici ──
            e('div', { style: { display: 'flex', height: 3, backgroundColor: '#FFFFFF', borderTop: '3px dashed #C9D2CC' } }),

            // ── Souche ──
            e('div', {
                style: {
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    backgroundColor: NUIT, padding: '34px 0 26px',
                },
            },
                e('div', { style: { display: 'flex', backgroundColor: '#FFFFFF', padding: 12 } },
                    e('img', { src: d.qr_uri, width: 236, height: 236 }),
                ),
                e('div', {
                    style: {
                        display: 'flex', marginTop: 22, fontSize: 29, fontWeight: 700,
                        letterSpacing: 2, color: '#FFFFFF',
                    },
                }, d.ticket_code),
            ),
        ),
    )
}

/** Le billet en PNG. */
export async function billetEnPng(d: DonneesBillet): Promise<Buffer> {
    const reponse = new ImageResponse(arbre(d), { width: L, height: H, fonts: polices() })
    return Buffer.from(await reponse.arrayBuffer())
}

/**
 * Le billet en PDF, format A4 portrait.
 *
 * L'image est posée dans la page plutôt que redessinée en vecteur : le PDF
 * reste RIGOUREUSEMENT identique à l'image, et un seul dessin est à maintenir.
 * Le PDF est ce qu'on garde et qu'on imprime — c'est aussi lui qu'on joint à
 * l'email, comme le fait toute billetterie.
 */
export async function billetEnPdf(d: DonneesBillet): Promise<Buffer> {
    const png = await billetEnPng(d)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

    const margeX = 20
    const largeur = 210 - margeX * 2
    const hauteur = largeur * (H / L)
    const y = (297 - hauteur) / 2

    pdf.addImage(
        `data:image/png;base64,${png.toString('base64')}`,
        'PNG', margeX, y, largeur, hauteur, undefined, 'FAST',
    )
    return Buffer.from(pdf.output('arraybuffer'))
}
