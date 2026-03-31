'use client'

import React, { forwardRef, useState, useEffect } from 'react'
import QRCode from 'react-qr-code'

/* ══════════════════════════════════════════════════════════════
   PALETTE & DIMENSIONS
══════════════════════════════════════════════════════════════ */

const GOLD    = '#C9A84C'
const GOLD_L  = '#E2C97E'
const DARK    = '#03080f'
const BG_DARK = 'linear-gradient(158deg, #0b2054 0%, #163a7e 40%, #0d2d6b 70%, #071840 100%)'
const BG_CREAM = '#fdf9f2'
const TEXT_DARK  = '#1a1005'
const TEXT_MED   = '#3d2e15'
const TEXT_LIGHT = '#5c4a2a'

// A4 portrait en pixels (72 ppi de référence)
export const BASE_W = 595
export const BASE_H = 842

/* ══════════════════════════════════════════════════════════════
   IMAGES DU DÉPLIANT
   4 photos du Bénin à dispatcher sur les pages FR + EN
══════════════════════════════════════════════════════════════ */

const DEPLIANT_IMAGES = {
    ganvie: '/images/depliant/ganvie.jpg',
    pendjari: '/images/depliant/pendjari.jpg',
    amazone: '/images/depliant/amazone.jpg',
    porte: '/images/depliant/porte-non-retour.jpg',
    registre: '/images/depliant/registre-historique.jpg',
    passeport: '/images/depliant/passeport-benin.png',
}

/* ══════════════════════════════════════════════════════════════
   CONTENU TEXTUEL — FRANÇAIS
══════════════════════════════════════════════════════════════ */

const FR = {
    s1_title: 'I — PRÉSENTATION GÉNÉRALE DE L\'AGENCE',
    s1_body: 'L\'Agence Retour Gagnant Bénin est une institution privée de référence, dédiée à l\'accompagnement technique et opérationnel du retour des Afro-descendants vers le Bénin.\n\nPortée par une équipe aux compétences pluridisciplinaires — juridiques, administratives, économiques et interculturelles — l\'Agence maîtrise l\'ensemble des paramètres qui conditionnent la réussite d\'un retour : connaissance approfondie du cadre légal et foncier béninois, maîtrise des procédures administratives et consulaires, expertise en montage de projets d\'investissement, et capacité à mobiliser un réseau dense de partenaires institutionnels et privés rigoureusement sélectionnés.\n\nQu\'il s\'agisse d\'un retour définitif, d\'une installation partielle, d\'un investissement sectoriel, d\'un transfert de compétences ou d\'un partenariat économique, l\'Agence déploie une méthodologie d\'accompagnement structurée, adaptée et orientée vers des résultats concrets.\n\nAncrée dans la réalité historique et mémorielle du Bénin, pionnier de la réconciliation mémorielle, l\'Agence Retour Gagnant Bénin est l\'institution qui transforme une aspiration profonde en projet viable, un désir de réconciliation en réalité concrète, et un retour en une véritable expérience.',
    s2_title: 'II — LES SERVICES DE RGB',
    s2_items: [
        { title: '1. Accueil et orientation personnalisée', body: 'Chaque personne ou famille bénéficie d\'un interlocuteur dédié qui évalue sa situation, ses aspirations, ses ressources et son projet de retour.' },
        { title: '2. Accompagnement administratif', body: 'Obtention ou renouvellement de documents d\'identité, démarches consulaires, régularisation de la situation administrative au Bénin, obtention de la nationalité béninoise pour les Afro-descendants éligibles.' },
        { title: '3. Investissement et entrepreneuriat', body: 'Identification des secteurs porteurs, mise en relation avec les institutions financières partenaires, assistance à la création d\'entreprise et au montage de projets.' },
        { title: '4. Logement et immobilier', body: 'Réseau de promoteurs immobiliers, notaires partenaires et agences foncières fiables pour trouver, sécuriser et acquérir un logement ou un terrain dans les meilleures conditions.' },
        { title: '5. Voyages de découverte et d\'immersion', body: 'Avant de décider, il faut voir. L\'Agence organise des voyages incluant visites de sites, rencontres avec des retournants, réunions avec des institutions et entrepreneurs locaux.' },
        { title: '6. Recherche généalogique', body: 'Le retour au Bénin pour les Afro-descendants dépasse un simple projet de vie : c\'est une véritable quête identitaire. RGB les accompagne dans la redécouverte de leurs origines (lignées, territoires, noms, groupes ethniques).' },
    ],
    s3_title: 'III — NOS PARTENAIRES STRATÉGIQUES',
    s3_intro: 'Chaque partenaire est choisi sur la base de trois critères non négociables : expertise avérée, fiabilité démontrée et engagement réel en faveur de la réussite des Afro-descendants.',
    s3_items: [
        { label: 'Institutionnels', body: 'Ministères et agences publiques fournissant le cadre légal, administratif et réglementaire.' },
        { label: 'Financiers', body: 'Banques, institutions de microfinance et structures d\'investissement soutenant vos projets.' },
        { label: 'Transport aérien', body: 'Compagnies aériennes engagées à rendre le voyage vers le Bénin plus accessible et abordable.' },
        { label: 'Tourisme mémoriel', body: 'Opérateurs dédiés à une expérience mémorielle authentique et transformatrice sur le sol béninois.' },
        { label: 'Santé & Éducation', body: 'Cliniques, hôpitaux et établissements d\'enseignement prêts à accueillir les familles et professionnels.' },
    ],
    s3_cta: 'Votre retour mérite d\'être préparé, accompagné et réussi. L\'Agence Retour Gagnant Bénin est là pour cela.',
}

/* ══════════════════════════════════════════════════════════════
   CONTENU TEXTUEL — ENGLISH
══════════════════════════════════════════════════════════════ */

const EN = {
    s1_title: 'I — GENERAL PRESENTATION OF THE AGENCY',
    s1_body: 'The Agence Retour Gagnant Bénin — RGB is a leading private institution dedicated to providing technical and operational support for the return of Afro-descendants to Benin.\n\nDriven by a multidisciplinary team with expertise in legal, administrative, economic, and intercultural fields, the Agency has full command of all the key factors that determine a successful return: in-depth knowledge of Benin\'s legal and land frameworks, mastery of administrative and consular procedures, strong expertise in investment project development, and the ability to mobilize a robust network of carefully selected institutional and private partners.\n\nWhether it involves a permanent return, partial relocation, sector-specific investment, skills transfer, or economic partnership, Return Winning Benin Agency implements a structured and tailored support methodology focused on delivering concrete results.\n\nRooted in the historical and memorial reality of Benin — a pioneer in memorial reconciliation — RGB is the institution that transforms a deep aspiration into a viable project, a desire for reconciliation into tangible reality, and a return into a truly meaningful experience.',
    s2_title: 'II — RGB SERVICES',
    s2_items: [
        { title: '1. Personalized Reception & Orientation', body: 'Every individual or family is assigned a dedicated advisor who assesses their situation, aspirations, resources, and return project.' },
        { title: '2. Administrative Support', body: 'Obtaining or renewing identity documents, handling consular processes, regularizing administrative status in Benin, and acquiring Beninese nationality for eligible Afro-descendants.' },
        { title: '3. Investment & Entrepreneurship Support', body: 'Identifying high-potential sectors, connecting with partner financial institutions, and providing comprehensive assistance with business creation and project development.' },
        { title: '4. Housing & Real Estate Facilitation', body: 'A network of real estate developers, partner notaries, and trusted land agencies to help beneficiaries find, secure, and acquire housing or land under the best conditions.' },
        { title: '5. Discovery & Immersion Trips', body: 'Before making a decision, one must experience the environment. RGB organizes discovery trips including site visits, meetings with returnees, and exploration of residential areas.' },
        { title: '6. Genealogical Research', body: 'The return to Benin for Afro-descendants goes beyond a simple life project; it is a true quest for identity. RGB supports them in rediscovering their origins (lineages, territories, names, and ethnic groups).' },
    ],
    s3_title: 'III — OUR STRATEGIC PARTNERS',
    s3_intro: 'Each partner is chosen on the basis of three non-negotiable criteria: proven expertise, demonstrated reliability, and genuine commitment to the success of returning Afro-descendants.',
    s3_items: [
        { label: 'Institutional Partners', body: 'Ministries and public agencies providing the legal, administrative and policy framework for your return.' },
        { label: 'Financial Partners', body: 'Banks, microfinance institutions and investment bodies supporting your financial projects and access to capital.' },
        { label: 'Air Transport Partners', body: 'Airlines committed to making the journey to Benin more accessible, affordable and comfortable for the diaspora.' },
        { label: 'Memorial Tourism Partners', body: 'Operators dedicated to offering an authentic, meaningful and transformative memorial experience on Beninese soil.' },
        { label: 'Healthcare & Education Partners', body: 'Clinics, hospitals and educational institutions ready to welcome returning families and professionals.' },
    ],
    s3_cta: 'Your return deserves to be well prepared, well supported, and successful. Return Winning Benin Agency is here to make that happen.',
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function CornerBrackets({ s, arm = 24, col = GOLD, opacity = 1 }: { s: number; arm?: number; col?: string; opacity?: number }) {
    const a = arm * s, thick = 2.5 * s, off = 12 * s
    const bar = (st: React.CSSProperties) => (
        <div style={{ position: 'absolute', background: col, ...st }} />
    )
    return (
        <>
            <div style={{ position: 'absolute', top: off, left: off, width: a, height: a, opacity }}>
                {bar({ top: 0, left: 0, right: 0, height: thick })}
                {bar({ top: 0, left: 0, bottom: 0, width: thick })}
            </div>
            <div style={{ position: 'absolute', top: off, right: off, width: a, height: a, opacity }}>
                {bar({ top: 0, left: 0, right: 0, height: thick })}
                {bar({ top: 0, right: 0, bottom: 0, width: thick })}
            </div>
            <div style={{ position: 'absolute', bottom: off, left: off, width: a, height: a, opacity }}>
                {bar({ bottom: 0, left: 0, right: 0, height: thick })}
                {bar({ top: 0, left: 0, bottom: 0, width: thick })}
            </div>
            <div style={{ position: 'absolute', bottom: off, right: off, width: a, height: a, opacity }}>
                {bar({ bottom: 0, left: 0, right: 0, height: thick })}
                {bar({ top: 0, right: 0, bottom: 0, width: thick })}
            </div>
        </>
    )
}

function Diamond({ s }: { s: number }) {
    return <div style={{ width: 5 * s, height: 5 * s, background: GOLD, transform: 'rotate(45deg)', flexShrink: 0 }} />
}

function HRule({ s, opacity = 0.35, w = '100%' }: { s: number; opacity?: number; w?: string | number }) {
    return <div style={{ width: w, height: 0.8 * s, background: `linear-gradient(90deg, transparent, ${GOLD}${Math.round(opacity * 255).toString(16).padStart(2,'0')}, transparent)` }} />
}

function QRDisplay({ size }: { size: number }) {
    const [qrSrc, setQrSrc] = useState<string | null>(null)

    useEffect(() => {
        const img = new window.Image()
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth || img.width
                canvas.height = img.naturalHeight || img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) { setQrSrc(null); return }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                setQrSrc(canvas.toDataURL('image/png'))
            } catch {
                setQrSrc(null)
            }
        }
        img.onerror = () => setQrSrc(null)
        img.src = '/images/qr-code.png'
    }, [])

    if (qrSrc) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={qrSrc} alt="QR Code RGB" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
    }
    return <QRCode value="https://www.retourgagnantbenin.bj" size={size} fgColor={DARK} bgColor="#ffffff" level="M" />
}

/** Image encadrée dorée pour les pages intérieures — affichage complet */
function DepliantImage({ src, s, w, h, radius = 6, caption, captionSub, position = 'center' }: { src: string; s: number; w: number; h: number; radius?: number; caption?: string; captionSub?: string; position?: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 * s, flexShrink: 0 }}>
            <div style={{
                width: w * s, height: h * s, borderRadius: radius * s,
                border: `2px solid ${GOLD}70`, overflow: 'hidden', flexShrink: 0,
                boxShadow: `0 4px 16px rgba(0,0,0,0.25), 0 0 0 0.5px ${GOLD}30`,
                background: '#0b1a3a',
            }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, display: 'block' }} />
            </div>
            {caption && (
                <div style={{ textAlign: 'center', lineHeight: 1.25 }}>
                    <div style={{ color: TEXT_DARK, fontSize: 7.5 * s, fontWeight: 700, letterSpacing: '0.06em', fontStyle: 'italic', fontFamily: "'Georgia',serif" }}>
                        {caption}
                    </div>
                    {captionSub && (
                        <div style={{ color: TEXT_MED, fontSize: 6.5 * s, fontWeight: 600, letterSpacing: '0.05em', fontStyle: 'italic', fontFamily: "'Georgia',serif", marginTop: 1 * s }}>
                            {captionSub}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════
   PANEL 1 RECTO — COUVERTURE (COVER)
   Logo agrandi, nom centré, mise en page impactante
══════════════════════════════════════════════════════════════ */

export const Panel1Recto = forwardRef<HTMLDivElement, { scale?: number }>(
    ({ scale = 1 }, ref) => {
        const W = BASE_W * scale, H = BASE_H * scale, s = scale
        return (
            <div ref={ref} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: BG_DARK, fontFamily: "'Georgia',serif", flexShrink: 0 }}>

                {/* Lueur centrale élargie */}
                <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: 500 * s, height: 500 * s, background: `radial-gradient(ellipse, rgba(201,168,76,0.12) 0%, transparent 60%)`, pointerEvents: 'none' }} />
                {/* Accent vert haut droite */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: 250 * s, height: 250 * s, background: `radial-gradient(circle at 100% 0%, rgba(0,135,81,0.12) 0%, transparent 60%)`, pointerEvents: 'none' }} />
                {/* Accent bleu bas gauche */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: 200 * s, height: 200 * s, background: `radial-gradient(circle at 0% 100%, rgba(11,32,84,0.3) 0%, transparent 60%)`, pointerEvents: 'none' }} />

                <CornerBrackets s={s} arm={32} />

                {/* ── LOGO + ORG — centré verticalement ── */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 80 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 * s }}>
                    {/* Médaillon logo AGRANDI */}
                    <div style={{ width: 170 * s, height: 170 * s, borderRadius: 28 * s, border: `1.5px solid ${GOLD}40`, background: `radial-gradient(circle, rgba(201,168,76,0.08), transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 60px rgba(201,168,76,0.08)` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/logo-transparent.png" alt="RGB" style={{ width: 130 * s, height: 130 * s, objectFit: 'contain' }} />
                    </div>

                    {/* Titre AGRANDI */}
                    <div style={{ textAlign: 'center', lineHeight: 1 }}>
                        <div style={{ color: `${GOLD}cc`, fontSize: 34 * s, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif" }}>
                            RETOUR GAGNANT
                        </div>
                        <div style={{ color: GOLD_L, fontSize: 56 * s, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif", marginTop: 4 * s }}>
                            BÉNIN
                        </div>
                    </div>

                    {/* Ornement ÉLARGI */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 * s, width: 280 * s }}>
                        <div style={{ flex: 1, height: 1 * s, background: `linear-gradient(90deg, transparent, ${GOLD}70)` }} />
                        <Diamond s={s} />
                        <div style={{ flex: 1, height: 1 * s, background: `linear-gradient(270deg, transparent, ${GOLD}70)` }} />
                    </div>

                    {/* Sous-titre */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 * s }}>
                        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 * s, letterSpacing: '0.08em', fontFamily: "'Arial','Helvetica',sans-serif" }}>
                            L&apos;Agence du Retour des Afro-descendants
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 * s, letterSpacing: '0.12em', fontFamily: "'Arial','Helvetica',sans-serif" }}>
                            au Bénin
                        </div>
                    </div>
                </div>

                {/* Watermark RGB */}
                <div style={{ position: 'absolute', bottom: 100 * s, left: 0, right: 0, textAlign: 'center', color: `${GOLD}06`, fontSize: 180 * s, fontWeight: 900, letterSpacing: '-0.02em', fontFamily: "'Cinzel','Georgia',serif", pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>
                    RGB
                </div>

                {/* Bande bas — AGRANDIE + CONTRASTE AMÉLIORÉ */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 18 * s, paddingBottom: 24 * s, borderTop: `1.5px solid ${GOLD}40`, background: 'rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 * s }}>
                    <div style={{ color: GOLD, fontSize: 12 * s, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif" }}>
                        VOTRE RETOUR, NOTRE MISSION
                    </div>
                    <div style={{ color: GOLD_L, fontSize: 9.5 * s, letterSpacing: '0.12em', fontFamily: "'Arial',sans-serif", fontWeight: 600 }}>
                        www.retourgagnantbenin.bj
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9 * s, letterSpacing: '0.07em', fontFamily: "'Arial',sans-serif" }}>
                        Haie-Vive Cocotiers, Cotonou — BÉNIN
                    </div>
                </div>
            </div>
        )
    }
)
Panel1Recto.displayName = 'Panel1Recto'

/* ══════════════════════════════════════════════════════════════
   HELPER — PANNEAU TEXTE (réutilisé FR + EN)
   Avec 6 services, images du Bénin, header agrandi
══════════════════════════════════════════════════════════════ */

type ContentData = typeof FR

/** Légendes images bilingues (FR + EN sous chaque image) */
const IMG_CAPTIONS = {
    FR: {
        top:    { main: 'Cité Lacustre de Ganvié',        sub: 'Lacustrine City of Ganvié' },
        bottom: { main: 'Place de l\'Amazone',             sub: 'Amazon Square' },
    },
    EN: {
        top:    { main: 'Parc National de la Pendjari',    sub: 'Pendjari National Park' },
        bottom: { main: 'Porte du Non-Retour, Ouidah',     sub: 'Gate of No Return, Ouidah' },
    },
}

function TextPanelInner({ s, content, lang, images, imgPositions }: { s: number; content: ContentData; lang: 'FR' | 'EN'; images: { top: string; bottom: string }; imgPositions?: { top?: string; bottom?: string } }) {
    const W = BASE_W * s
    const H = BASE_H * s
    const captions = IMG_CAPTIONS[lang]

    const SH = ({ children }: { children: React.ReactNode }) => (
        <div style={{ color: TEXT_DARK, fontSize: 9 * s, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: "'Arial',sans-serif", marginBottom: 4 * s, paddingBottom: 3 * s, borderBottom: `1.5px solid ${GOLD}`, lineHeight: 1.1 }}>
            {children}
        </div>
    )

    const Body = ({ children, size = 7.8 }: { children: React.ReactNode; size?: number }) => (
        <div style={{ color: TEXT_MED, fontSize: size * s, lineHeight: 1.4, fontFamily: "'Arial',sans-serif", whiteSpace: 'pre-line' }}>
            {children}
        </div>
    )

    const ItemHead = ({ children }: { children: React.ReactNode }) => (
        <div style={{ color: TEXT_DARK, fontSize: 7.8 * s, fontWeight: 700, fontFamily: "'Arial',sans-serif", marginBottom: 1 * s, marginTop: 4 * s }}>
            {children}
        </div>
    )

    const BulletItem = ({ label, body }: { label: string; body: string }) => (
        <div style={{ marginBottom: 3 * s }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 * s, marginBottom: 1 * s }}>
                <div style={{ width: 3.5 * s, height: 3.5 * s, borderRadius: '50%', background: GOLD, flexShrink: 0 }} />
                <span style={{ color: TEXT_DARK, fontSize: 7.5 * s, fontWeight: 700, fontFamily: "'Arial',sans-serif" }}>{label}</span>
            </div>
            <div style={{ color: TEXT_LIGHT, fontSize: 7 * s, lineHeight: 1.35, fontFamily: "'Arial',sans-serif", paddingLeft: 7.5 * s }}>{body}</div>
        </div>
    )

    const colPad = 22 * s
    const colGap = 10 * s
    const colW = (W - colPad * 2 - colGap) / 2
    const headerH = 68 * s
    const footerH = 30 * s
    const imgStripH = 115 * s   // Bande images — réduite pour laisser de la place au texte agrandi
    const imgGap = 10 * s
    const textTop = 4 * s + headerH + 10 * s
    const textBottom = footerH + imgStripH + 6 * s
    const contentH = H - textTop - textBottom
    const colStyle: React.CSSProperties = { width: colW, flexShrink: 0, overflow: 'hidden', height: contentH, display: 'flex', flexDirection: 'column' }
    const imgW = (W - colPad * 2 - imgGap) / 2

    return (
        <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: BG_CREAM, fontFamily: "'Arial',sans-serif", flexShrink: 0 }}>

            {/* Bordure haut dorée */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 * s, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L}, ${GOLD})` }} />

            {/* Header — bande noire AGRANDIE */}
            <div style={{ position: 'absolute', top: 4 * s, left: 0, right: 0, height: headerH, background: TEXT_DARK, display: 'flex', alignItems: 'center', paddingLeft: colPad, paddingRight: colPad, gap: 12 * s }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo-transparent.png" alt="RGB" style={{ width: 42 * s, height: 42 * s, objectFit: 'contain', opacity: 0.95 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ color: GOLD, fontSize: 14 * s, fontWeight: 700, letterSpacing: '0.16em', fontFamily: "'Cinzel','Georgia',serif" }}>RETOUR GAGNANT BÉNIN</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 8.5 * s, letterSpacing: '0.12em', marginTop: 2 * s }}>{lang === 'FR' ? 'PRÉSENTATION & SERVICES' : 'PRESENTATION & SERVICES'}</div>
                </div>
                <div style={{ paddingLeft: 10 * s, paddingRight: 10 * s, paddingTop: 5 * s, paddingBottom: 5 * s, border: `1.5px solid ${GOLD}60`, borderRadius: 4 * s, color: GOLD, fontSize: 12 * s, fontWeight: 700, letterSpacing: '0.18em', fontFamily: "'Cinzel',serif" }}>
                    {lang}
                </div>
            </div>

            {/* Colonnes de contenu texte */}
            <div style={{ position: 'absolute', top: textTop, left: colPad, right: colPad, display: 'flex', gap: colGap, height: contentH }}>

                {/* Colonne gauche */}
                <div style={colStyle}>
                    <SH>{content.s1_title}</SH>
                    <Body>{content.s1_body}</Body>

                    <div style={{ marginTop: 5 * s }}>
                        <SH>{content.s2_title}</SH>
                        {content.s2_items.slice(0, 3).map((item, i) => (
                            <div key={i}>
                                <ItemHead>{item.title}</ItemHead>
                                <Body size={7.2}>{item.body}</Body>
                            </div>
                        ))}
                    </div>

                    {/* Image passeport béninois sous service #3 — s'adapte à l'espace disponible */}
                    <div style={{ marginTop: 4 * s, flex: '1 1 auto', minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={DEPLIANT_IMAGES.passeport} alt={lang === 'FR' ? 'Passeport République du Bénin' : 'Republic of Benin Passport'} style={{ maxWidth: 140 * s, maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>

                    {/* CTA toujours visible en bas */}
                    <div style={{ flexShrink: 0, paddingTop: 5 * s, borderTop: `1px solid ${GOLD}45`, marginTop: 4 * s }}>
                        <div style={{ color: TEXT_DARK, fontSize: 8 * s, fontWeight: 700, lineHeight: 1.4, fontFamily: "'Georgia',serif", fontStyle: 'italic' }}>
                            &ldquo;{content.s3_cta}&rdquo;
                        </div>
                    </div>
                </div>

                {/* Séparateur */}
                <div style={{ width: 0.8 * s, background: `linear-gradient(180deg, transparent, ${GOLD}40, transparent)`, flexShrink: 0 }} />

                {/* Colonne droite */}
                <div style={colStyle}>
                    {content.s2_items.slice(3).map((item, i) => (
                        <div key={i}>
                            <ItemHead>{item.title}</ItemHead>
                            <Body size={7.2}>{item.body}</Body>
                        </div>
                    ))}

                    <div style={{ marginTop: 5 * s }}>
                        <SH>{content.s3_title}</SH>
                        <div style={{ color: TEXT_MED, fontSize: 7.2 * s, lineHeight: 1.35, fontFamily: "'Arial',sans-serif", marginBottom: 4 * s }}>
                            {content.s3_intro}
                        </div>
                        {content.s3_items.map((item, i) => (
                            <BulletItem key={i} label={item.label} body={item.body} />
                        ))}
                    </div>

                    {/* Image registre historique sous Santé & Éducation */}
                    <div style={{ marginTop: 3 * s, borderRadius: 4 * s, overflow: 'hidden', border: `1px solid ${GOLD}40`, flex: '1 1 auto', minHeight: 0, background: '#f5efe4' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={DEPLIANT_IMAGES.registre} alt={lang === 'FR' ? 'Registre historique des affranchis' : 'Historical registry of freed citizens'} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>

                    {/* Contacts épinglés en bas — TOUJOURS VISIBLES */}
                    <div style={{ flexShrink: 0, paddingTop: 5 * s, borderTop: `1.5px solid ${GOLD}50`, marginTop: 4 * s }}>
                        <div style={{ color: TEXT_DARK, fontSize: 8 * s, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 2 * s }}>Contact</div>
                        <div style={{ color: TEXT_DARK, fontSize: 7.5 * s, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em' }}>+229 01 60 32 21 21 · +229 01 94 35 50 50</div>
                        <div style={{ color: TEXT_DARK, fontSize: 7.5 * s, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em' }}>contact@retourgagnantbenin.bj</div>
                        <div style={{ color: TEXT_DARK, fontSize: 7.5 * s, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em' }}>www.retourgagnantbenin.bj</div>
                    </div>
                </div>
            </div>

            {/* ══════ BANDE IMAGES PLEINE LARGEUR — Photos du Bénin ══════ */}
            <div style={{
                position: 'absolute',
                bottom: footerH,
                left: 0, right: 0,
                height: imgStripH,
                background: `linear-gradient(180deg, ${BG_CREAM} 0%, #f5efe4 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: imgGap,
                paddingLeft: colPad,
                paddingRight: colPad,
                borderTop: `1px solid ${GOLD}30`,
            }}>
                <DepliantImage src={images.top} s={s} w={imgW / s} h={90} radius={6} caption={captions.top.main} captionSub={captions.top.sub} position={imgPositions?.top || 'center'} />
                <DepliantImage src={images.bottom} s={s} w={imgW / s} h={90} radius={6} caption={captions.bottom.main} captionSub={captions.bottom.sub} position={imgPositions?.bottom || 'center'} />
            </div>

            {/* Footer — AGRANDI + plus lisible */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: footerH, background: TEXT_DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 * s }}>
                <div style={{ color: GOLD, fontSize: 7.5 * s, letterSpacing: '0.1em', fontWeight: 600 }}>contact@retourgagnantbenin.bj</div>
                <div style={{ width: 1.2 * s, height: 12 * s, background: `${GOLD}50` }} />
                <div style={{ color: GOLD, fontSize: 7.5 * s, letterSpacing: '0.1em', fontWeight: 600 }}>+229 01 60 32 21 21</div>
                <div style={{ width: 1.2 * s, height: 12 * s, background: `${GOLD}50` }} />
                <div style={{ color: GOLD, fontSize: 7.5 * s, letterSpacing: '0.1em', fontWeight: 600 }}>www.retourgagnantbenin.bj</div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════
   PANEL 1 VERSO — FRANÇAIS
   Images: Ganvié (haut) + Statue Amazone (bas)
══════════════════════════════════════════════════════════════ */

export const Panel1Verso = forwardRef<HTMLDivElement, { scale?: number }>(
    ({ scale = 1 }, ref) => (
        <div ref={ref} style={{ flexShrink: 0 }}>
            <TextPanelInner s={scale} content={FR} lang="FR" images={{ top: DEPLIANT_IMAGES.ganvie, bottom: DEPLIANT_IMAGES.amazone }} imgPositions={{ bottom: 'top center' }} />
        </div>
    )
)
Panel1Verso.displayName = 'Panel1Verso'

/* ══════════════════════════════════════════════════════════════
   PANEL 2 VERSO — ENGLISH
   Images: Éléphants Pendjari (haut) + Porte du Non-Retour (bas)
══════════════════════════════════════════════════════════════ */

export const Panel2Verso = forwardRef<HTMLDivElement, { scale?: number }>(
    ({ scale = 1 }, ref) => (
        <div ref={ref} style={{ flexShrink: 0 }}>
            <TextPanelInner s={scale} content={EN} lang="EN" images={{ top: DEPLIANT_IMAGES.pendjari, bottom: DEPLIANT_IMAGES.porte }} />
        </div>
    )
)
Panel2Verso.displayName = 'Panel2Verso'

/* ══════════════════════════════════════════════════════════════
   PANEL 2 RECTO — 4e DE COUVERTURE (BACK)
   Logo agrandi, QR centré, "SCANNEZ MOI POUR NOUS DECOUVRIR"
══════════════════════════════════════════════════════════════ */

export const Panel2Recto = forwardRef<HTMLDivElement, { scale?: number }>(
    ({ scale = 1 }, ref) => {
        const W = BASE_W * scale, H = BASE_H * scale, s = scale
        return (
            <div ref={ref} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: BG_DARK, fontFamily: "'Arial',sans-serif", flexShrink: 0 }}>

                {/* Lueur */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 450 * s, height: 450 * s, background: `radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <CornerBrackets s={s} arm={28} />

                {/* Bande haut */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4 * s, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L}, ${GOLD})` }} />

                {/* Logo + nom AGRANDIS */}
                <div style={{ position: 'absolute', top: 45 * s, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 * s }}>
                    <div style={{ width: 110 * s, height: 110 * s, borderRadius: 20 * s, border: `1.5px solid ${GOLD}35`, background: `radial-gradient(circle, rgba(201,168,76,0.07), transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px rgba(201,168,76,0.06)` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/logo-transparent.png" alt="RGB" style={{ width: 84 * s, height: 84 * s, objectFit: 'contain' }} />
                    </div>
                    <div style={{ color: GOLD, fontSize: 22 * s, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif", textAlign: 'center' }}>
                        RETOUR GAGNANT BÉNIN
                    </div>
                    <HRule s={s} w={260 * s} opacity={0.4} />
                </div>

                {/* QR Code central — bien centré */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-42%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * s }}>
                    <div style={{ padding: 14 * s, background: '#ffffff', borderRadius: 12 * s, boxShadow: `0 0 0 2px ${GOLD}40, 0 10px 50px rgba(0,0,0,0.5), 0 0 40px ${GOLD}12` }}>
                        <QRDisplay size={Math.round(165 * s)} />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5 * s, letterSpacing: '0.22em', textTransform: 'uppercase', textAlign: 'center', fontWeight: 700 }}>
                        Scannez moi pour nous découvrir
                    </div>
                </div>

                {/* Coordonnées — AGRANDIES + plus lisibles */}
                <div style={{ position: 'absolute', bottom: 65 * s, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * s }}>
                    <HRule s={s} w={320 * s} opacity={0.35} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * s }}>
                        {[
                            { icon: '📍', text: 'Haie-Vive Cocotiers, Carré N°1158, Cotonou — BÉNIN' },
                            { icon: '☎', text: '+229 01 60 32 21 21  ·  +229 01 94 35 50 50' },
                            { icon: '✉', text: 'contact@retourgagnantbenin.bj' },
                            { icon: '🌐', text: 'www.retourgagnantbenin.bj' },
                        ].map(({ icon, text }) => (
                            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 * s }}>
                                <span style={{ fontSize: 10 * s }}>{icon}</span>
                                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 * s, letterSpacing: '0.04em', fontWeight: 500 }}>{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Slogan bas — AGRANDI */}
                <div style={{ position: 'absolute', bottom: 22 * s, left: 0, right: 0, textAlign: 'center', color: GOLD, fontSize: 11 * s, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', fontFamily: "'Cinzel','Georgia',serif" }}>
                    VOTRE RETOUR, NOTRE MISSION
                </div>
            </div>
        )
    }
)
Panel2Recto.displayName = 'Panel2Recto'
