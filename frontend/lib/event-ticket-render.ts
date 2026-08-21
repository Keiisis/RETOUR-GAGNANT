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

/* Format PAYSAGE, calqué sur la page web du billet : le panneau d'informations
   à gauche, la souche sombre détachable à droite. La première version était
   verticale — plus simple à écrire, mais elle ne ressemblait pas au billet que
   le client voit dans son navigateur, et deux dessins différents pour un même
   objet, c'est un objet qu'on ne reconnaît plus. */
const L = 1200
const H = 560
const SOUCHE = 380 // largeur de la souche à QR

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
        // Arête tricolore verticale : signature de l'agence, en structure.
        e('div', { style: { display: 'flex', flexDirection: 'column', width: 16, height: H } },
            e('div', { style: { display: 'flex', backgroundColor: VERT, width: 16, height: Math.round(H * 0.42) } }),
            e('div', { style: { display: 'flex', backgroundColor: JAUNE, width: 16, height: Math.round(H * 0.29) } }),
            e('div', { style: { display: 'flex', backgroundColor: ROUGE, width: 16, height: Math.round(H * 0.29) } }),
        ),

        // ── PANNEAU PRINCIPAL ──
        e('div', {
            style: {
                display: 'flex', flexDirection: 'column', width: L - 16 - SOUCHE, height: H,
                padding: '46px 44px 0 48px',
            },
        },
            e('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 40 } },
                e('div', { style: { display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 4, color: VERT } }, 'RETOUR GAGNANT BÉNIN'),
                e('div', { style: { display: 'flex', flexGrow: 1, height: 1, backgroundColor: '#E4E4E4', margin: '0 18px' } }),
                e('div', {
                    style: {
                        display: 'flex', border: `2px solid ${ENCRE}`, padding: '7px 18px',
                        fontSize: 15, fontWeight: 700, letterSpacing: 3, color: ENCRE,
                    },
                }, d.ticket_type.toUpperCase()),
            ),

            microTitre('Au nom de'),
            e('div', { style: { display: 'flex', fontSize: 42, fontWeight: 700, color: ENCRE, marginBottom: 10 } }, d.full_name || 'Invité'),
            e('div', { style: { display: 'flex', fontSize: 21, color: GRIS } }, d.email),
            d.phone
                ? e('div', { style: { display: 'flex', fontSize: 21, color: GRIS, marginTop: 4 } }, d.phone)
                : e('div', { style: { display: 'flex' } }),

            e('div', { style: { display: 'flex', height: 1, backgroundColor: '#E4E4E4', margin: '32px 0 30px' } }),

            // Deux colonnes : l'événement à gauche, la date à droite.
            e('div', { style: { display: 'flex', marginBottom: 26 } },
                /* LARGEURS EXPLICITES, pas `flexGrow`.
                   Avec une colonne extensible, Satori ne renvoie pas le texte à
                   la ligne : « lundi 7 septembre 2026 à 16:17 » débordait du
                   panneau et passait SOUS la souche sombre, tronqué. Une
                   largeur fixée force le retour à la ligne. */
                e('div', { style: { display: 'flex', flexDirection: 'column', width: 372, paddingRight: 22 } },
                    microTitre('Événement'),
                    e('div', { style: { display: 'flex', fontSize: 26, fontWeight: 700, color: ENCRE, lineHeight: 1.25 } }, d.event_title),
                ),
                e('div', { style: { display: 'flex', flexDirection: 'column', width: 300 } },
                    microTitre('Date'),
                    e('div', { style: { display: 'flex', fontSize: 22, fontWeight: 700, color: ENCRE, lineHeight: 1.3 } }, d.event_date),
                ),
            ),

            microTitre('Lieu'),
            e('div', { style: { display: 'flex', fontSize: 23, fontWeight: 700, color: ENCRE } }, d.event_location),

            // La mention légale ferme le panneau : c'est ce qui fait du dessin
            // un billet opposable, et non une jolie carte. `flexGrow` la
            // repousse en bas, avec une marge minimale pour qu'elle ne colle
            // jamais au lieu quand le titre tient sur une seule ligne.
            e('div', { style: { display: 'flex', flexGrow: 1, minHeight: 22 } }),
            e('div', {
                style: {
                    display: 'flex', flexDirection: 'column', borderLeft: `3px solid ${ROUGE}`,
                    paddingLeft: 12, marginBottom: 30,
                },
            },
                e('div', { style: { display: 'flex', fontSize: 13, color: '#5E6A64', lineHeight: 1.5 } },
                    'Billet nominatif, valable pour une seule entrée. Le premier scan l’invalide :'),
                e('div', { style: { display: 'flex', fontSize: 13, color: '#5E6A64', lineHeight: 1.5 } },
                    'une copie ou un second passage seront refusés à l’accueil.'),
            ),
        ),

        // ── SOUCHE DÉTACHABLE ──
        e('div', {
            style: {
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', width: SOUCHE, height: H, backgroundColor: NUIT,
                borderLeft: '3px dashed #4A554E',
            },
        },
            e('div', { style: { display: 'flex', backgroundColor: '#FFFFFF', padding: 14 } },
                e('img', { src: d.qr_uri, width: 232, height: 232 }),
            ),
            e('div', {
                style: {
                    display: 'flex', marginTop: 24, fontSize: 26, fontWeight: 700,
                    letterSpacing: 2, color: '#FFFFFF',
                },
            }, d.ticket_code),
            e('div', {
                style: {
                    display: 'flex', marginTop: 12, fontSize: 13, fontWeight: 700,
                    letterSpacing: 3, color: '#8FA396',
                },
            }, 'À SCANNER À L’ENTRÉE'),
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

    /* Le billet est en paysage : posé sur une A4 portrait, il occupe toute la
       largeur utile et se découpe d'un trait de ciseaux. */
    const margeX = 14
    const largeur = 210 - margeX * 2
    const hauteur = largeur * (H / L)
    const y = 42

    pdf.addImage(
        `data:image/png;base64,${png.toString('base64')}`,
        'PNG', margeX, y, largeur, hauteur, undefined, 'FAST',
    )
    return Buffer.from(pdf.output('arraybuffer'))
}
